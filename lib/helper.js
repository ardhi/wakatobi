import path from 'path'

/**
 * @module Helper
 */

/**
 * Write HTML content to the reply object. It will read the template file,
 * compile it with the provided payload, and send the resulting HTML as the response.
 *
 * @param {object} req - The request object
 * @param {object} reply - The reply object
 * @param {string} tpl - The template file path
 * @param {object} payload - The data to be injected into the template
 * @returns {string} - The compiled HTML content
 */
export function writeHtml (req, reply, tpl, payload) {
  const { fs } = this.app.lib
  const { template } = this.app.lib._
  reply.header('Content-Type', 'text/html')
  reply.header('Content-Language', req.lang)
  const file = this.app.getPluginFile(tpl)
  const content = fs.readFileSync(file, 'utf8')
  const compiled = template(content)
  return compiled(payload)
}

/**
 * Interceptor for handling payload/task and delegating to specific web app handlers if available.
 *
 * @async
 * @param {string} name - The name of the error handler to invoke
 * @param {object} payload - The payload object
 * @param {object} req - The request object
 * @param {object} reply - The reply object
 * @returns {Promise<any>} - The result of the invoked handler, if any
 */
export async function interceptor (name, payload, req, reply) {
  const { get, trim } = this.app.lib._
  const { pascalCase } = this.app.lib.aneka
  let webApp = get(req, 'routeOptions.config.webApp')
  const all = this.webApps.map(item => item.ns)
  if (!webApp) {
    const url = req.url ?? req.raw.url
    const [prefix] = trim(url, '/').split('/')
    const ns = this.getPluginByPrefix(prefix, true)
    if (all.includes(ns)) webApp = ns
  }
  if (!webApp) {
    const wa = this.webApps.find(item => item.prefix === '')
    if (wa) webApp = wa.ns
  }
  if (webApp) {
    const plugin = this.app[webApp]
    const handler = plugin['_handle' + pascalCase(name)] ?? get(plugin, `webAppFactory.${name}Handler`)
    if (handler) return await handler.call(plugin, payload, req, reply)
  }
}

/**
 * Determine the redirect route based on the request object.
 *
 * @private
 * @param {object} req - The request object
 * @returns {string|boolean} - The redirect route or false if not found
 */
function redirSvc (req) {
  const { trim, get } = this.app.lib._
  const { outmatch } = this.app.lib

  const matchRoute = (path, items) => {
    let match = false
    for (const k in items) {
      const isMatch = outmatch(k)
      if (isMatch(path)) {
        match = items[k]
        const parts = path.split('/')
        const patterns = k.split('/')
        for (const idx in patterns) {
          if (patterns[idx] === '*') match = match.replace(`{${idx}}`, parts[idx])
        }
        break
      }
    }
    return match
  }

  const [prefix, subPrefix, ...args] = trim(req.url.split('?')[0].split('#')[0], '/').split('/')
  let plugin = this.getPluginByPrefix(prefix)
  const subPlugin = this.getPluginByPrefix(subPrefix)
  if (!plugin && !subPlugin) plugin = this.app.main
  let route = false
  if (plugin && subPlugin) {
    const items = get(this, `app.${subPlugin.ns}.config.waibuMpa.redirectSubRoute.${plugin.ns}`, {})
    route = matchRoute(`/${args.join('/')}`, items)
    if (route) return route
  }
  if (plugin) {
    const items = get(this, `app.${plugin.ns}.config.waibuMpa.redirect`, {})
    route = matchRoute(subPrefix ? `/${subPrefix}/${args.join('/')}` : '/', items)
    if (route) return route
  }
  return route
}

/**
 * Handle 404 Not Found errors. It will check for a redirect route, and if found, redirect the user.
 * If no redirect route is found, it will render a 404 error page using the specified template.
 *
 * @async
 * @param {Error} err - The error object
 * @param {object} req - The request object
 * @param {object} reply - The reply object
 * @returns {Promise<any>} - The result of the handler, if any
 */
export async function notFound (err, req, reply) {
  const { getMethod } = this.app.bajo
  let redirectTo = await redirSvc.call(this, req, reply)
  if (redirectTo !== false) {
    const fn = getMethod(redirectTo, false)
    if (fn) redirectTo = await fn(req)
    if (redirectTo) return reply.redirectTo(redirectTo)
  }
  reply.code(404)
  const resp = await interceptor.call(this, 'notFound', err, req, reply)
  if (resp) return resp
  if (err && err.noContent) return ''
  const payload = {
    text: req.t('notFound%s%s', req.t('route'), req.url),
    title: req.t('pageNotFound')
  }
  return writeHtml.call(this, req, reply, `${this.ns}:/lib/template/404.html`, payload)
}

/**
 * Handle redirection based on the error object. It will redirect to the specified path or URL.
 *
 * @param {Error} err - The error object
 * @param {object} req - The request object
 * @param {object} reply - The reply object
 * @returns {object} - The reply object
 */
export function redirect (err = {}, req, reply) {
  if (err.path.startsWith('http') || path.isAbsolute(err.path)) reply.redirect(err.path)
  else reply.redirect(this.routePath(err.path, err.options), err.redirectCode)
  return reply
}

/**
 * Collect web apps by scanning for files that match the specified glob pattern. It will import the modules and gather their metadata.
 *
 * @async
 * @param {string} glob - The glob pattern to match files
 * @param {string} baseNs - The base namespace
 * @returns {Promise<Array<TWaibuWebappBoot>>} - The collected web apps
 */
export async function collectWebApps (glob = 'webapp/boot.js', baseNs) {
  const { eachPlugins, importModule } = this.app.bajo
  const { orderBy, get } = this.app.lib._
  if (!baseNs) baseNs = this.ns
  const mods = []

  await eachPlugins(async function ({ file }) {
    const { ns, alias, config } = this
    const mod = await importModule(file, { asHandler: true })
    mod.prefix = get(config, 'waibu.prefix', alias)
    if (get(config, 'intl.detectors', []).includes('path')) mod.prefix = `:lang${mod.prefix === '' ? '' : ('/' + mod.prefix)}`
    mod.ns = ns
    mod.alias = alias
    mods.push(mod)
  }, { glob, prefix: baseNs })
  const prefixes = {}
  mods.forEach(m => {
    if (!prefixes[m.prefix]) prefixes[m.prefix] = []
    prefixes[m.prefix].push(m.plugin)
    if (prefixes[m.prefix].length > 1) this.fatal('pluginPrefixConflic%s%s%s', m.prefix, prefixes[m.prefix][0], prefixes[m.prefix][1])
  })
  return orderBy(mods, ['level'])
}

/**
 * Decorate the request object with additional properties and methods for handling language, translation, formatting, and settings retrieval.
 */
export function decorate () {
  const me = this
  this.instance.decorateRequest('lang', null)
  this.instance.decorateRequest('t', () => {})
  this.instance.decorateRequest('te', () => {})
  this.instance.decorateRequest('format', () => {})
  this.instance.decorateRequest('langDetector', null)
  this.instance.decorateRequest('site', null)
  this.instance.decorateRequest('ns', null)
  this.instance.decorateRequest('webApp', null)
  this.instance.decorateRequest('getSetting', function (key, defValue) {
    return me.app.waibu.getSetting(key, { req: this, defValue })
  })
}

/**
 * Helper to handle file download. It will set proper content-type based on file extension.
 *
 * @async
 * @param {string|Function} input - File path or function that returns file path. If it is a function, it will be called with ```this``` context and ```req``` as parameter
 * @param {object} req - The request object_handleNot
 * @param {object} reply - The reply object
 * @param {string|boolean} [forceDownload] - If set, it will force the browser to download the file with the given name instead of displaying it. If set `true`, use input's basename
 * @returns {Promise<object>} - The reply object
 */
export async function download (input, req, reply, forceDownload) {
  const { importPkg } = this.app.bajo
  const { fs } = this.app.lib
  const { isFunction } = this.app.lib._
  const mime = await importPkg('waibu:mime')
  const file = isFunction(input) ? (await input.call(this, req)) : input
  if (!fs.existsSync(file)) throw this.error('_notFound', { noContent: true })
  const mimeType = mime.getType(path.extname(file))
  if (forceDownload === true) forceDownload = path.basename(file)
  if (forceDownload) reply.header('Content-Disposition', `attachment; filename="${forceDownload}"`)
  reply.header('Content-Type', mimeType)
  const stream = fs.createReadStream(file)
  reply.send(stream)
  return reply
}
