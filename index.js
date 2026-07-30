import replyFrom from '@fastify/reply-from'
import fastify from 'fastify'
import { routeHook } from './lib/webapp.js'
import config from './lib/config.js'
import sensible from '@fastify/sensible'
import underPressure from '@fastify/under-pressure'
import queryString from 'query-string'
import {
  notFound, interceptor, writeHtml, redirect, collectWebApps,
  decorate, download
} from './lib/helper.js'

/**
 * @typedef TEscapeChars
 * @type {Object}
 * @memberof Waibu
 * @property {string} &lt;=&lt;
 * @property {string} &gt;=&gt;
 * @property {string} &quot;=&quot;
 * @property {string} &apos;=&apos;
 */

/**
 * Plugin factory.
 *
 * **Never** call this function directly!!! It's only-meant to be called by the {@link https://ardhi.github.io/bajo|Bajo framework} during plugin initialization.
 *
 * @param {string} pkgName - NPM package name
 * @returns {Waibu} Waibu plugin class
 */
async function factory (pkgName) {
  const me = this
  const { fs } = this.app.lib
  const { get, pick, findIndex, orderBy, isArray, isEmpty, isString } = this.app.lib._
  const { defaultsDeep, isSet } = this.app.lib.aneka
  const { eachPlugins } = this.app.bajo

  /**
   * Waibu class definition.
   *
   * This class provides methods and properties for managing web applications, routes, and configurations within the Bajo framework.
   * You should NOT use this class to create routes etc, instead of that, use
   * the following webapps to extend your plugin:
   *
   * - {@link https://ardhi.github.io/waibu-mpa|waibuMpa} - Provide everything to serve multi-page web applications
   * - {@link https://ardhi.github.io/waibu-static|waibuStatic} - Provide everything to serve static & virtual files
   * - {@link https://ardhi.github.io/waibu-api|waibuApi} - Provide everything to serve REST API endpoints
   *
   * Only use this class if you want to create your own webapp or if you really need to use the fastify context root directly.
   *
   * @class
   */
  class Waibu extends this.app.baseClass.Base {
    /**
     * @type {string[]}
     * @default ['onRequest', 'onResponse', 'preParsing', 'preValidation', 'preHandler', 'preSerialization', 'onSend', 'onTimeout', 'onError']
     */
    static hookTypes = ['onRequest', 'onResponse', 'preParsing', 'preValidation', 'preHandler',
      'preSerialization', 'onSend', 'onTimeout', 'onError']

    /**
     * @type {Waibu.TEscapeChars}
     */
    static escapeChars = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;'
    }

    constructor () {
      super(pkgName, me.app)

      /**
       * Configuration object. To override the default configuration, you can create `data/config/waibu.json`
       * @type {Waibu.TConfig}
       */
      this.config = config

      /**
       * Query string parser and stringifier. It is a wrapper of {@link https://www.npmjs.com/package/query-string|query-string} package.
       *
       * @type {Object}
       * @property {Function} qs.parse - Query string parser
       * @property {Function} qs.parseUrl - Query string url parser
       * @property {Function} qs.stringify - Query string stringifier
       * @property {Function} qs.stringifyUrl - Query string url stringifier
       */
      this.qs = {
        parse: (item) => {
          return queryString.parse(item, {
            parseBooleans: true,
            parseNumbers: true
          })
        },
        parseUrl: queryString.parseUrl,
        stringify: queryString.stringify,
        stringifyUrl: queryString.stringifyUrl
      }
    }

    /**
     * Initialize plugin
     *
     * @method
     * @async
     */
    init = async () => {
      if (isString(this.config.log.disabled)) this.config.log.disabled = [this.config.log.disabled]
      // collect route path handlers from all plugins
      this.routePathHandlers = this.routePathHandlers ?? {}
      const me = this

      await eachPlugins(async function () {
        const { ns } = this
        if (isEmpty(this.routePathHandlers) || !this.routePath) return undefined
        for (const key of this.routePathHandlers) {
          me.routePathHandlers[key] = { handler: this.routePath, ns }
        }
      })
      if (!isSet(this.config.exposeError)) this.config.exposeError = this.app.bajo.config.env === 'dev'
    }

    /**
     * Start plugin
     *
     * @method
     * @async
     */
    start = async () => {
      const { runHook } = this.app.bajo
      const { generateId } = this.app.lib.aneka
      const cfg = this.getConfig()
      if (this.app.bajoLogger) {
        cfg.factory.loggerInstance = this.app.bajoLogger.instance.child(
          {},
          { msgPrefix: '[waibu] ' }
        )
      }
      cfg.factory.genReqId = req => generateId()
      cfg.factory.disableRequestLogging = true
      cfg.factory.routerOptions.querystringParser = str => this.qs.parse(str)

      this.instance = fastify(cfg.factory)
      this.routes = this.routes || []
      await decorate.call(this)
      await runHook('waibu:afterCreateContext', this.instance)
      await this.instance.register(sensible)
      if (cfg.underPressure) await this.instance.register(underPressure)
      await this._handleRedirect()
      await this._handleForward()
      await this._handleAppHook()
      await this._handleError()
      await routeHook.call(this, this.ns)
      await this._runWebApps()
      await this._handleHome()
      await this._handleFavicon()
      await this._handleRobotsTxt()
      await this._handleNotFound()
      await this.instance.listen(cfg.server)
      if (cfg.route.print) this._printRoutes()
    }

    /**
     * Exit handler
     *
     * @method
     * @async
     */
    exit = async () => {
      this.instance.close()
    }

    /**
     * Find route by route name
     *
     * @method
     * @param {string} name - ns based route name
     * @returns {Object} Route object
     */
    findRoute = (name, method = 'GET') => {
      const { outmatch } = this.app.lib
      const { find, isString } = this.app.lib._
      const { breakNsPath } = this.app.bajo
      let { ns, subNs = '', path } = breakNsPath(name)
      const params = path.split('|')
      if (params.length > 1) path = params[0]
      return find(this.routes, r => {
        if (r.path.startsWith('*')) return false
        r.config = r.config ?? {}
        const match = outmatch(r.config.pathSrc ?? r.path, { separator: false })
        if (!match(path)) return false
        const methods = isString(r.method) ? [r.method] : r.method
        return ns === r.config.ns && r.config.subNs === subNs && methods.includes(method)
      })
    }

    get escapeChars () {
      return this.constructor.escapeChars
    }

    /**
     * Escape text
     *
     * @method
     * @param {string} text
     * @returns {string}
     */
    escape = (text) => {
      const { isSet } = this.app.lib.aneka
      const { isArray, isPlainObject, cloneDeep } = this.app.lib._
      if (!isSet(text)) return ''
      if (isArray(text) || isPlainObject(text)) text = JSON.stringify(cloneDeep(text))
      else text = text + ''
      const { forOwn } = this.app.lib._
      forOwn(this.escapeChars, (v, k) => {
        text = text.replaceAll(k, v)
      })
      return text
    }

    /**
     * Fetch something from url. A wrapper of bajo-extra's fetchUrl which support
     * bajo's ns based url.
     *
     * @method
     * @async
     * @param {string} url - Also support ns based url
     * @param {Object} [opts={}] - node's fetch options
     * @param {Object} [extra={}] - See {@link https://ardhi.github.io/bajo-extra|bajo-extra}
     * @returns {Object}
     */
    fetch = async (url, opts = {}, extra = {}) => {
      const { fetch } = this.app.bajoExtra
      extra.rawResponse = true

      url = this.routePath(url, { guessHost: true })
      const resp = await fetch(url, opts, extra)
      const result = await resp.json()
      if (!resp.ok) {
        throw this.error(result.message, {
          statusCode: resp.status,
          success: false
        })
      }
      return result
    }

    /**
     * Get visitor IP from fastify's request object
     *
     * @method
     * @param {Object} req - request object
     * @returns {string}
     */
    getIp = (req) => {
      const { isEmpty } = this.app.lib._
      let fwd = req.headers['x-forwarded-for'] ?? ''
      if (!Array.isArray(fwd)) fwd = fwd.split(',').map(ip => ip.trim())
      return isEmpty(fwd[0]) ? req.ip : fwd[0]
    }

    /**
     * Get origin from fastify's request object
     *
     * @method
     * @param {Object} req
     * @returns {string}
     */
    getOrigin = (req) => {
      const { isEmpty } = this.app.lib._
      let host = req.host
      if (isEmpty(host) || host === ':authority') host = `${this.config.server.host}:${this.config.server.port}`
      return `${req.protocol}://${host}`
    }

    /**
     * Get hostname from fastify's request object
     *
     * @method
     * @param {Object} req
     * @returns {string}
     */
    getHostname = (req) => {
      return req.hostname.split(':')[0]
    }

    /**
     * Get plugin by prefix
     *
     * @method
     * @param {string} prefix
     * @param {boolean} nsOnly - Set ```true``` to return plugin's namespace only
     * @returns {Object}
     */
    getPluginByPrefix = (prefix, nsOnly) => {
      const { get, find } = this.app.lib._
      const ns = find(this.app.getAllNs(), p => {
        return get(this, `app.${p}.config.waibu.prefix`) === prefix
      })
      if (!ns) return
      return nsOnly ? ns : this.app[ns]
    }

    /**
     * Get plugin's prefix by name
     *
     * @method
     * @param {string} name - Plugin's name
     * @param {string} [webApp=waibuMpa] - Web app to use
     * @returns {string}
     */
    getPluginPrefix = (name, webApp = 'waibuMpa') => {
      const { get, trim } = this.app.lib._
      let prefix = get(this, `app.${name}.config.${webApp}.prefix`, get(this, `app.${name}.config.waibu.prefix`, this.app[name].alias))
      if (name === 'main') {
        const cfg = this.app[webApp].config
        if (cfg.mountMainAsRoot) prefix = ''
      }
      return trim(prefix, '/')
    }

    /**
     * Get all available routes
     *
     * @method
     * @param {boolean} [grouped=false] - Returns as groups of urls and methods
     * @param {*} [lite=false] - Retuns only urls and methods
     * @returns {Array}
     */
    getRoutes = (grouped = false, lite = false) => {
      const { groupBy, orderBy, mapValues, map, pick } = this.app.lib._
      const all = this.routes
      let routes
      if (grouped) {
        const group = groupBy(orderBy(all, ['url', 'method']), 'url')
        routes = lite ? mapValues(group, (v, k) => map(v, 'method')) : group
      } else if (lite) routes = map(all, a => pick(a, ['url', 'method']))
      else routes = all
      return routes
    }

    /**
     * Get uploaded files by request ID
     *
     * @method
     * @param {string} reqId - Request ID
     * @param {boolean} [fileUrl=false] - If ```true```, files returned as file url format (```file:///...```)
     * @param {*} returnDir - If ```true```, also return its directory
     * @returns {(Object|Array)} - Returns object if ```returnDir``` is ```true```, array of files otherwise
     */
    getUploadedFiles = async (reqId, fileUrl = false, returnDir = false) => {
      const { resolvePath } = this.app.lib.aneka
      const { fastGlob } = this.app.lib
      const dir = `${this.app.getPluginDataDir(this.ns)}/upload/${reqId}`
      const result = await fastGlob(`${dir}/*`)
      if (!fileUrl) return returnDir ? { dir, files: result } : result
      const files = result.map(f => resolvePath(f, true))
      return returnDir ? { dir, files } : files
    }

    /**
     * Is namespace's path contains language detector token?
     *
     * @method
     * @param {string} ns - Plugin name
     * @returns {boolean}
     */
    isIntlPath = (ns) => {
      const { get } = this.app.lib._
      return get(this.app[ns], 'config.intl.detectors', []).includes('path')
    }

    /**
     * Parse filter found from Fastify's request based on keys set in config object
     *
     * @method
     * @param {Object} req - Request object
     * @returns {Object}
     */
    parseFilter = (req) => {
      const result = {}
      const items = Object.keys(this.config.qsKey)
      for (const item of items) {
        result[item] = req.query[this.config.qsKey[item]]
      }
      return result
    }

    /**
     * Get route directory by plugin's name
     *
     * @method
     * @param {*} ns - Namespace
     * @param {*} [baseNs] - Base namespace. If not provided, defaults to scope's ns
     * @returns {string}
     */
    routeDir = (ns, baseNs) => {
      const { get } = this.app.lib._
      if (!baseNs) baseNs = ns
      const cfg = this.app[baseNs].config
      const prefix = get(cfg, 'waibu.prefix', this.app[baseNs].alias)
      const dir = prefix === '' ? '' : `/${prefix}`
      const cfgMpa = get(this, 'app.waibuMpa.config')
      if (ns === this.app.mainNs && cfgMpa.mountMainAsRoot) return ''
      if (ns === baseNs) return dir
      return dir + `/${get(this.app[ns].config, 'waibu.prefix', this.app[ns].alias)}`
    }

    /**
     * Get route path by route's name:
     * - If it is a ```mailto:``` or ```tel:``` url, it returns as is
     * - If it starts with ```:/```, name will be prefixed with its ```ns``` automatically
     * - If it is a ns based name, it will be parsed first
     *
     * @method
     * @param {string} name
     * @param {Object} [options={}] - Options object
     * @param {string} [options.ns=waibu] - Base namespace
     * @param {boolean} [options.guessHost] - If true, guest host if host is not set
     * @param {Object} [options.query={}] - Query string's object. If provided, it will be added to returned value
     * @param {Object} [options.params={}] - Parameter object. If provided, it will be merged to returned value
     * @returns {string}
     */
    routePath = (name = '', options = {}) => {
      const { defaultsDeep } = this.app.lib.aneka
      const { isEmpty, get, trimEnd, trimStart } = this.app.lib._
      const { breakNsPath } = this.app.bajo
      const { query = {}, ns = this.ns, params = {}, guessHost, defaults = {}, uriEncoded, throwError = false } = options

      const plugin = this.app.getPlugin(ns)
      const cfg = plugin.config ?? {}
      let info = {}
      const neg = name[0] === '!'
      if (name.startsWith('mailto:') || name.startsWith('tel:')) return name
      if (neg) name = name.slice(1)
      if (name.slice(0, 2) === ':/') name = ns + name
      if (['%', '.', '/', '?', '#'].includes(name[0]) || name.slice(1, 2) === ':') info.path = name
      else if (['~'].includes(name[0])) info.path = name.slice(1)
      else {
        info = breakNsPath(name, throwError)
      }
      if (info.path.slice(0, 2) === './') info.path = info.path.slice(2)
      if (this.routePathHandlers[info.subNs]) return (neg ? '!' : '') + this.routePathHandlers[info.subNs].handler(name, options)
      if (info.path.includes('//')) return (neg ? '!' : '') + info.path

      info.path = info.path.split('/').map(p => {
        if (!(p[0] === ':' || (p[0] === '{' && p[p.length - 1] === '}'))) return p
        const _p = p
        p = p.replace(':', '').replace('{', '').replace('}', '')
        if (params[p]) return params[p]
        if (defaults[p]) return defaults[p]
        return _p
      }).join('/')
      let url = info.path
      const langDetector = get(cfg, 'intl.detectors', [])
      if (info.ns) url = trimEnd(langDetector.includes('path') ? `/${params.lang ?? ''}${this.routeDir(info.ns)}${info.path}` : `${this.routeDir(info.ns)}${info.path}`, '/')
      if (uriEncoded) url = url.split('/').map(u => encodeURI(u)).join('/')
      info.qs = defaultsDeep({}, query, info.qs)
      if (!isEmpty(info.qs)) url += '?' + this.qs.stringify(info.qs)
      if (!url.startsWith('http') && guessHost) url = `http://${this.config.server.host}:${this.config.server.port}/${trimStart(url, '/')}`
      return (neg ? '!' : '') + url
    }

    /**
     * Recursively unescape block of texts
     *
     * @method
     * @param {string} content - Source content
     * @param {string} start - Block's start
     * @param {string} end - Block's end
     * @param {string} startReplacer - Token to use as block's start replacer
     * @param {string} endReplacer - Token to use as block's end replacer
     * @returns {string}
     */
    unescapeBlock = (content, start, end, startReplacer, endReplacer) => {
      const { extractText } = this.app.lib.aneka
      const { result } = extractText(content, start, end)
      if (result.length === 0) return content
      const unescaped = this.unescape(result)
      const token = `${start}${result}${end}`
      const replacer = `${startReplacer}${unescaped}${endReplacer}`
      const block = content.replaceAll(token, replacer)
      return this.unescapeBlock(block, start, end, startReplacer, endReplacer)
    }

    /**
     * Unescape text using {@link TEscapeChars} rules
     *
     * @method
     * @param {string} text - Text to unescape
     * @returns {string}
     */
    unescape = (text) => {
      const { forOwn, invert } = this.app.lib._
      const mapping = invert(this.escapeChars)
      forOwn(mapping, (v, k) => {
        text = text.replaceAll(k, v)
      })
      return text
    }

    arrayToAttr = (array = [], delimiter = ' ') => {
      const { isPlainObject } = this.app.lib._
      return array.map(item => {
        if (isPlainObject(item)) return this.objectToAttr(item)
        return item
      }).join(delimiter)
    }

    attrToArray = (text = '', delimiter = ' ') => {
      const { map, trim, without, isArray } = this.app.lib._
      if (text === true) text = ''
      if (isArray(text)) text = text.join(delimiter)
      return without(map(text.split(delimiter), i => trim(i)), '', undefined, null).map(item => {
        return item
      })
    }

    attrToObject = (text = '', delimiter = ';', kvDelimiter = ':') => {
      const { camelCase, isPlainObject } = this.app.lib._
      const result = {}
      if (isPlainObject(text)) text = this.objectToAttr(text)
      if (typeof text !== 'string') return text
      if (text.slice(1, 3) === '%=') return text
      const array = this.attrToArray(text, delimiter)
      array.forEach(item => {
        const [key, val] = this.attrToArray(item, kvDelimiter)
        result[camelCase(key)] = val
      })
      return result
    }

    /**
     * Decode base64 encoded json string
     *
     * @method
     * @param {string} data - Base64 encoded JSON string
     * @returns {Object} Decoded JSON object
     */
    base64JsonDecode = (data = 'e30=') => {
      return JSON.parse(Buffer.from(data, 'base64'))
    }

    /**
     * Encode JSON object to base64 string
     *
     * @method
     * @param {Object} data - JSON object to encode
     * @returns {string} Base64 encoded JSON string
     */
    base64JsonEncode = (data) => {
      return Buffer.from(JSON.stringify(data)).toString('base64')
    }

    objectToAttr = (obj = {}, delimiter = ';', kvDelimiter = ':') => {
      const { forOwn, kebabCase } = this.app.lib._
      const result = []
      forOwn(obj, (v, k) => {
        result.push(`${kebabCase(k)}${kvDelimiter}${v ?? ''}`)
      })
      return result.join(delimiter)
    }

    getSetting = (key, { defValue, req = {} } = {}) => {
      const { breakNsPath } = this.app.bajo
      const { get, isPlainObject, isArray } = this.app.lib._
      const { defaultsDeep } = this.app.lib.aneka
      let { ns, path } = breakNsPath(key)
      const paths = path.replaceAll('/', '.').split('.')
      if (paths[0] === '') paths.shift()
      path = paths.join('.')
      const cfgValue = get(this.app, `${ns}.config.${path}`, defValue)
      const reqValue = get(req, `site.setting.${ns}.${path}`, defValue)
      if (isPlainObject(cfgValue)) return defaultsDeep({}, reqValue, cfgValue)
      if (isArray(cfgValue)) return reqValue.length > 0 ? reqValue : cfgValue
      return reqValue ?? cfgValue ?? defValue
    }

    isRouteDisabled = (path, warning = true) => {
      const { outmatch } = this.app.lib
      path = this.routePath(path)
      const result = this.config.route.disabled.find(item => {
        return outmatch(this.routePath(item))(path)
      })
      if (result && warning) this.log.warn('routeDisabled%s', path)
      return result
    }

    buildSetting = (key, opts = {}) => {
      const items = get(opts, `req.site.setting.${key}`, {})
      for (const k in items) {
        opts[k] = get(opts, k, items[k])
      }
      delete opts.req
      return opts
    }

    // private methods, for internal use only
    // should be marked as private (???)

    /**
     * Create route for '/robots.txt'.
     *
     * Location of robots.txt file can be found in:
     * 1. main plugin's file; if not found, then
     * 2. site attachment; if not found, then
     * 3. default plugin's file
     *
     * @async
     * @method
     * @returns {Promise<void>}
     */
    _handleRobotsTxt = async () => {
      if (!this.config.robotsTxt) return
      const me = this
      this.instance.get('/robots.txt', async function (req, reply) {
        // 1. main robots.txt
        let file = me.app.getPluginFile('main:/robots.txt')
        // 2. site attachment
        if (!fs.existsSync(file) && me.app.dobo) {
          const dir = me.app.getPluginDataDir('dobo')
          file = `${dir}/attachment/SumbaSite/${get(req, 'site.id')}/file/robots.txt`
        }
        // 3. Default
        if (!fs.existsSync(file)) file = me.app.getPluginFile('waibu:/asset/robots.txt')
        reply.header('cache-control', 'max-age=86400')
        return await download.call(me, file, req, reply)
      })
    }

    /**
     * Create route for '/favicon.:ext'
     *
     * Location of favicon file can be found in:
     * 1. main plugin's file; if not found, then
     * 2. site attachment; if not found, then
     * 3. static dir of theme; if not found, then
     * 4. default plugin's file
     *
     * @async
     * @method
     * @returns {Promise<void>}
     */
    _handleFavicon = async () => {
      if (!this.config.favicon) return
      const me = this
      this.instance.get('/favicon.:ext', async function (req, reply) {
        // 1. main favicon
        let file = me.app.getPluginFile(`main:/favicon.${req.params.ext}`)
        // 2. site attachment
        if (!fs.existsSync(file) && me.app.dobo) {
          const dir = me.app.getPluginDataDir('dobo')
          file = `${dir}/attachment/SumbaSite/${get(req, 'site.id')}/file/favicon.${req.params.ext}`
        }
        // 3. static dir of theme
        if (!fs.existsSync(file) && me.app.waibuMpa) {
          const theme = me.app.waibuMpa.themes.find(item => item.name === get(req, 'theme'))
          if (theme) file = `${theme.plugin.dir.pkg}/extend/waibuStatic/asset/favicon.${req.params.ext}`
        }
        // 4. Default
        if (!fs.existsSync(file)) file = me.app.getPluginFile('waibu:/asset/favicon.png')
        reply.header('cache-control', 'max-age=86400')
        return await download.call(me, file, req, reply)
      })
    }

    /**
     * Create route for '/' to redirect to home path.
     *
     * @async
     * @method
     * @returns {Promise<void>}
     */
    _handleHome = async () => {
      const me = this
      this.instance.get('/', async function (req, reply) {
        const home = req.getSetting('waibu:home', {})
        if (!home.path) throw me.error('_notFound')
        home.options = home.options ?? {}
        home.options.throwError = true
        if (!home.forward) return reply.redirectTo(home.path, home.options)
        const opts = defaultsDeep(pick(req, ['params', 'query']), pick(home, ['params', 'query']))
        return reply.forwardTo(home.path, opts)
      })
    }

    /**
     * Route not found handler.
     *
     * @async
     * @method
     * @returns {Promise<void>}
     */
    _handleNotFound = async () => {
      const me = this
      this.instance.setNotFoundHandler(async function (req, reply) {
        return await notFound.call(me, null, req, reply)
      })
    }

    /**
     * Route error handler.
     *
     * @async
     * @method
     * @returns {Promise<void>}
     */
    _handleError = async () => {
      const me = this

      this.instance.setErrorHandler(async function (err, req, reply) {
        if (err.message === '_notFound' || err.statusCode === 404) return await notFound.call(me, err, req, reply)
        if (err.message === '_redirect' && err.path) return redirect.call(me, err, req, reply)
        this.log.error(err)
        const resp = await interceptor.call(me, 'error', err, req, reply)
        if (resp) return resp
        const payload = {
          text: me.app.log.getErrorMessage(err),
          title: req.t('internalServerError')
        }
        return writeHtml.call(me, req, reply, `${me.ns}:/lib/template/500.html`, payload)
      })
    }

    /**
     * Handle redirect. It will decorate reply object with ```redirectTo``` method.
     *
     * @async
     * @method
     * @param {object} options
     * @returns {Promise<void>}
     */
    _handleRedirect = async (options) => {
      const me = this
      this.instance.decorateReply('redirectTo', function (path, options = {}) {
        return redirect.call(me, { path, options }, null, this)
      })
    }

    /**
     * Handle forward. It will decorate reply object with ```forwardTo``` method.
     *
     * @async
     * @method
     * @returns {Promise<void>}
     */
    _handleForward = async () => {
      const { defaultsDeep } = this.app.lib.aneka
      const me = this

      function rewriteHeaders (headers, req) {
        return {
          ...headers,
          'X-Fwd-To': true
        }
      }

      const base = `http://${this.config.server.host}:${this.config.server.port}`
      const options = defaultsDeep({ base }, this.config.forwardOpts)
      this.instance.register(replyFrom, options)
      this.instance.decorateReply('forwardTo', function (url, options = {}) {
        if (url.startsWith('http')) return this.redirectTo(url)
        this.from(me.routePath(url, options), {
          rewriteHeaders
        })
        return this
      })
    }

    /**
     * Handle app hooks. It will run hooks for each web app and main app.
     *
     * @async
     * @method
     * @returns {Promise<void>}
     */
    _handleAppHook = async () => {
      const { runHook } = this.app.bajo
      const hooks = ['onReady', 'onClose', 'preClose', 'onRoute', 'onRegister']
      const me = this
      for (const hook of hooks) {
        me.instance.addHook(hook, async function (...args) {
          args.push(this)
          if (['onClose', 'onReady'].includes(hook)) await runHook(`${me.ns}:${hook}`, ...args)
          else await runHook(`${me.ns}:${hook}`, ...args)
        })
      }
    }

    /**
     * Print all registered routes.
     *
     * @method
     * @returns {void}
     */
    _printRoutes = () => {
      let items = []
      this.routes.forEach(r => {
        const idx = findIndex(items, { url: r.url })
        if (idx < 0) items.push({ url: r.url, methods: isArray(r.method) ? r.method : [r.method] })
        else {
          if (isArray(r.method)) items[idx].methods.push(...r.method)
          else items[idx].methods.push(r.method)
        }
      })
      items = orderBy(items, ['url'])
      this.log.trace('loaded%s', this.t('routesL'))
      items.forEach(item => {
        this.log.trace('- %s (%s)', item.url, item.methods.join('|'))
      })
    }

    /**
     * Run web applications.
     *
     * @async
     * @method
     * @returns {Promise<void>}
     */
    async _runWebApps () {
      const { runHook } = this.app.bajo
      this.webApps = await collectWebApps.call(this)
      await runHook(`${this.ns}:beforeAppBoot`)
      // build routes
      for (const m of this.webApps) {
        const plugin = this.app[m.ns]
        await runHook(`${this.ns}.${m.ns}:beforeAppBoot`)
        this.log.debug('bootApp%s', m.ns)
        await this.instance.register(async (ctx) => {
          plugin.webAppCtx = ctx
          plugin.webAppFactory = m
          await runHook(`${plugin.ns}:afterCreateContext`, ctx)
          await m.handler.call(plugin, m.prefix)
        }, { prefix: m.prefix })
        await runHook(`${this.ns}.${m.ns}:afterAppBoot`)
      }
      await runHook(`${this.ns}:afterAppBoot`)
    }
  }

  return Waibu
}

export default factory
