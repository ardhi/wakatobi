import compress from '@fastify/compress'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import { promisify } from 'util'
import { pipeline } from 'stream'
import path from 'path'
import rateLimit from '@fastify/rate-limit'
const pump = promisify(pipeline)

function detect (detector = [], req, reply) {
  const { get, map, trim, orderBy } = this.app.lib._
  const supported = get(this, 'app.bajo.config.intl.supported', [this.app.bajo.config.lang])
  const defLang = get(this, 'app.bajo.config.intl.fallback', this.app.bajo.config.lang)
  let lang = null
  // by route path
  if (detector.includes('path')) {
    lang = req.params.lang
    if (lang && supported.includes(lang)) {
      req.lang = lang
      req.langDetector = 'path'
      return
    }
    const length = req.url.split('/').length
    let url = req.url.replace(`/${lang}`, `/${defLang}`)
    if (length > 2) url = req.url.replace(`/${lang}/`, `/${defLang}/`)
    return reply.redirectTo(url)
  }
  // by query string
  lang = null
  if (detector.includes('qs')) {
    lang = req.query[this.app.waibu.config.qsKey.lang]
    if (lang && supported.includes(lang)) {
      req.lang = lang
      req.langDetector = 'qs'
      return
    }
  }
  // by header
  if (detector.includes('header')) {
    lang = null
    const accepteds = orderBy(map((req.headers['accept-language'] || '').split(','), a => {
      const [name, qty] = trim(a || '').split(';').map(i => trim(i))
      return { name, qty: parseFloat((qty || '').split('=')[1]) || 1 }
    }), ['qty'], ['desc'])
    for (const a of accepteds) {
      if (supported.includes(a.name)) {
        lang = a.name
        break
      }
    }
    if (lang) {
      req.lang = lang
      req.langDetector = 'header'
      return
    }
  }
  req.lang = lang ?? defLang
}

export async function attachIntl (detector = [], req, reply) {
  const { get } = this.app.lib._
  detect.call(this, detector, req, reply)
  const defNs = get(req, 'routeOptions.config.ns', this.ns)
  req.t = (text, ...args) => {
    args.push({ lang: req.lang })
    return this.app[defNs].t(text, ...args)
    // return result.replaceAll("'", '&apos;').replaceAll('"', '&quot;')
  }
  req.te = (text, ...args) => {
    args.push({ lang: req.lang })
    return this.app[defNs].te(text, ...args)
  }
  req.format = (value, type = 'auto', opts = {}) => {
    opts.lang = opts.lang ?? req.lang
    const timeZone = get(req, 'site.setting.sumba.timeZone', this.app.bajo.config.intl.format.datetime.timeZone)
    opts.datetime = opts.datetime ?? { timeZone }
    opts.date = opts.date ?? { timeZone }
    opts.time = opts.time ?? { timeZone }
    return this.app.bajo.format(value, type, opts)
  }
}

export async function handleCompress (options = {}) {
  const { defaultsDeep } = this.app.lib.aneka
  if (options === false) return this.log.warn('middlewareDisabled%s', 'compress')
  const opts = defaultsDeep(options, this.app.waibu.config.compress)
  await this.webAppCtx.register(compress, opts)
}

export async function handleCors (options = {}) {
  const { defaultsDeep } = this.app.lib.aneka
  if (options === false) return this.log.warn('middlewareDisabled%s', 'cors')
  const opts = defaultsDeep(options, this.app.waibu.config.cors)
  await this.webAppCtx.register(cors, opts)
}

export async function handleHelmet (options = {}) {
  const { defaultsDeep } = this.app.lib.aneka
  if (options === false) return this.log.warn('middlewareDisabled%s', 'helmet')
  const opts = defaultsDeep(options, this.app.waibu.config.helmet)
  await this.webAppCtx.register(helmet, opts)
}

function normalizeValue (value) {
  const { isSet } = this.app.lib.aneka
  if (!isSet(value)) return
  if (value === 'null') value = null
  else if (value === 'undefined') value = undefined
  return value
}

async function onFileHandler () {
  const { fs } = this.app.lib
  const dir = `${this.app.getPluginDataDir('waibu')}/upload`
  return async function (part) {
    // 'this' is the fastify context here
    const filePath = `${dir}/${this.id}/${part.fieldname}@${part.filename}`
    await fs.ensureDir(path.dirname(filePath))
    await pump(part.file, fs.createWriteStream(filePath))
  }
}

export async function handleMultipartBody (options = {}) {
  const { defaultsDeep } = this.app.lib.aneka
  const { isArray, map, isEmpty } = this.app.lib._
  const me = this

  if (options === false) return this.log.warn('middlewareDisabled%s', 'multipart')
  const opts = defaultsDeep(options, this.app.waibu.config.multipart)
  const onFile = await onFileHandler.call(this)
  opts.onFile = onFile
  await this.webAppCtx.register(multipart, opts)

  this.webAppCtx.addHook('preValidation', async function (req, reply) {
    if (req.isMultipart() && opts.attachFieldsToBody === true) {
      const body = Object.fromEntries(
        Object.keys(req.body || {}).map((key) => {
          let item = req.body[key]
          let value
          if (key.endsWith('[]') && !isArray(item)) item = [item]
          if (isArray(item)) {
            value = map(item, i => normalizeValue.call(me, i.value))
          } else {
            value = normalizeValue.call(me, item.value)
          }
          key = key.replace('[]', '')
          return [key, value]
        })
      )
      const newBody = {}
      for (const k in body) {
        if (isEmpty(k)) continue
        newBody[k] = body[k]
      }
      req.body = newBody
    }
  })
}

export async function handleRateLimit (options = {}) {
  const { cloneDeep } = this.app.lib._
  const { defaultsDeep } = this.app.lib.aneka
  if (options === false) return this.log.warn('middlewareDisabled%s', 'rateLimit')
  const opts = defaultsDeep(options, this.app.waibu.config.rateLimit)
  await this.webAppCtx.register(rateLimit, cloneDeep(opts))
}

// based on: https://github.com/NaturalIntelligence/fastify-xml-body-parser/blob/master/index.js
export async function handleXmlBody (opts = {}) {
  if (!this.app.bajoExtra) {
    this.log.warn('cantParseXmlBodyWithout%s', 'bajo-extra')
    return
  }
  const { importPkg } = this.app.bajo
  const fxp = await importPkg('bajoExtra:fast-xml-parser')

  function contentParser (req, payload, done) {
    const xmlParser = new fxp.XMLParser(opts)
    const parsingOpts = opts
    let body = ''
    payload.on('error', errorListener)
    payload.on('data', dataListener)
    payload.on('end', endListener)

    function errorListener (err) {
      done(err)
    }
    function endListener () {
      if (parsingOpts.validate) {
        const result = fxp.XMLValidator.validate(body, parsingOpts)
        if (result.err) {
          const invalidFormat = new Error('Invalid Format: ' + result.err.msg)
          invalidFormat.statusCode = 400
          payload.removeListener('error', errorListener)
          payload.removeListener('data', dataListener)
          payload.removeListener('end', endListener)
          done(invalidFormat)
        } else {
          handleParseXml(body)
        }
      } else {
        handleParseXml(body)
      }
    }
    function dataListener (data) {
      body = body + data
    }
    function handleParseXml (body) {
      try {
        done(null, xmlParser.parse(body))
      } catch (err) {
        done(err)
      }
    }
  }

  this.webAppCtx.addContentTypeParser(opts.contentTypes, contentParser)
}

export async function mergeRouteHooks (def, withHandler = true) {
  const { last, isFunction } = this.app.lib._
  const { hookTypes } = this.app.baseClass.Waibu
  const hooks = [...hookTypes]
  const me = this
  if (withHandler) hooks.push('handler')
  for (const h of hooks) {
    const oldH = def[h]
    if (!oldH) continue
    def[h] = async function (...args) {
      // TODO: hooks can be array of functions
      if (isFunction(last(args))) args.pop()
      args.push(this)
      return await oldH.call(me, ...args)
    }
  }
}

export async function reroutedPath (path, mapper = {}) {
  const { routePath } = this.app.waibu
  let result
  for (let k in mapper) {
    const v = routePath(mapper[k])
    k = routePath(k)
    if (k === path) result = v
  }
  return result
}

export async function routeHook (ns) {
  const webAppCtx = ns === 'waibu' ? this.app.waibu.instance : this.app[ns].webAppCtx
  const { runHook } = this.app.bajo
  const { hookTypes } = this.app.baseClass.Waibu
  for (const hook of hookTypes) {
    webAppCtx.addHook(hook, async function (...args) {
      args.push(this)
      await runHook(`${ns}:${hook}`, ...args)
    })
  }
}
