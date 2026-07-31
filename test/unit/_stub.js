import fs from 'fs'
import path from 'path'

export const isPlainObject = (v) => Object.prototype.toString.call(v) === '[object Object]'
export const isArray = Array.isArray
export const isString = (v) => typeof v === 'string'
export const isFunction = (v) => typeof v === 'function'
export const isEmpty = (v) => {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  if (isPlainObject(v)) return Object.keys(v).length === 0
  return false
}
export const isSet = (v) => v !== undefined && v !== null
export const trim = (s = '', chars = ' ') => String(s).replace(new RegExp(`^[${chars}]+|[${chars}]+$`, 'g'), '')
export const trimStart = (s = '', chars = ' ') => String(s).replace(new RegExp(`^[${chars}]+`, 'g'), '')
export const trimEnd = (s = '', chars = ' ') => String(s).replace(new RegExp(`[${chars}]+$`, 'g'), '')
export const camelCase = (s = '') => String(s)
  .replace(/^[\s_-]+|[\s_-]+$/g, '')
  .split(/[\s_.:/-]+/)
  .map((p, i) => i === 0 ? (p[0] ? p[0].toLowerCase() + p.slice(1) : '') : (p[0] ? p[0].toUpperCase() + p.slice(1) : ''))
  .join('')
export const pascalCase = (s = '') => {
  const cc = camelCase(s)
  return cc[0] ? cc[0].toUpperCase() + cc.slice(1) : cc
}
export const kebabCase = (s = '') => String(s).replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_./:]+/g, '-').toLowerCase()
export const invert = (obj = {}) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]))
export const forOwn = (obj = {}, fn) => { for (const k of Object.keys(obj)) fn(obj[k], k) }
export const find = (arr = [], matcher = {}) => {
  if (typeof matcher === 'function') return arr.find(matcher)
  return arr.find(item => Object.keys(matcher).every(k => item?.[k] === matcher[k]))
}
export const findIndex = (arr = [], matcher = {}) => {
  if (typeof matcher === 'function') return arr.findIndex(matcher)
  return arr.findIndex(item => Object.keys(matcher).every(k => item?.[k] === matcher[k]))
}
export const map = (arr = [], fn) => {
  if (typeof fn === 'function') return arr.map(fn)
  if (typeof fn === 'string') return arr.map(item => item?.[fn])
  return [...arr]
}
export const last = (arr = []) => arr[arr.length - 1]
export const mapValues = (obj = {}, fn) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v, k)]))
export const groupBy = (arr = [], key) => arr.reduce((acc, item) => {
  const k = typeof key === 'function' ? key(item) : item?.[key]
  acc[k] = acc[k] ?? []
  acc[k].push(item)
  return acc
}, {})
export const orderBy = (arr = [], fields = []) => {
  const [field] = fields
  return [...arr].sort((a, b) => {
    if (a[field] === b[field]) return 0
    return a[field] > b[field] ? 1 : -1
  })
}
export const pick = (obj = {}, keys = []) => keys.reduce((a, k) => { if (Object.prototype.hasOwnProperty.call(obj, k)) a[k] = obj[k]; return a }, {})
export const omit = (obj = {}, drop = []) => {
  const items = Array.isArray(drop) ? drop : [drop]
  const out = {}
  for (const k in obj) if (!items.includes(k)) out[k] = obj[k]
  return out
}
export const without = (arr = [], ...vals) => {
  const flat = vals.flat()
  return arr.filter(item => !flat.includes(item))
}
export const merge = (...items) => {
  const apply = (target, src) => {
    if (!isPlainObject(src)) return target
    for (const k of Object.keys(src)) {
      const sv = src[k]
      if (isPlainObject(sv) && isPlainObject(target[k])) apply(target[k], sv)
      else if (isPlainObject(sv)) target[k] = apply({}, sv)
      else target[k] = sv
    }
    return target
  }
  const [target = {}, ...rest] = items
  for (const item of rest) apply(target, item)
  return target
}
export const defaultsDeep = (...items) => {
  const out = {}
  const apply = (target, src) => {
    if (!isPlainObject(src)) return target
    for (const k of Object.keys(src)) {
      const sv = src[k]
      if (isPlainObject(sv)) {
        target[k] = apply(isPlainObject(target[k]) ? target[k] : {}, sv)
      } else if (target[k] === undefined) target[k] = sv
    }
    return target
  }
  for (const item of items) apply(out, item)
  return out
}
export const cloneDeep = (obj) => JSON.parse(JSON.stringify(obj))
export const get = (obj, p, fallback) => {
  const parts = String(p).split('.')
  let cur = obj
  for (const part of parts) {
    if (cur == null) return fallback
    cur = cur[part]
  }
  return cur === undefined ? fallback : cur
}
export const set = (obj, p, val) => {
  const parts = String(p).split('.')
  let cur = obj
  while (parts.length > 1) {
    const part = parts.shift()
    cur[part] = cur[part] ?? {}
    cur = cur[part]
  }
  cur[parts[0]] = val
  return obj
}
export const template = (content) => (payload) => content.replace(/<%=\s*([\w.]+)\s*%>/g, (_m, key) => get(payload, key, ''))
export const extractText = (content, start, end) => {
  const startIdx = content.indexOf(start)
  if (startIdx < 0) return { result: [] }
  const endIdx = content.indexOf(end, startIdx + start.length)
  if (endIdx < 0) return { result: [] }
  return { result: content.slice(startIdx + start.length, endIdx) }
}

export class Base {
  constructor (pkgName, app) {
    this.pkgName = pkgName
    this.app = app
    this.ns = camelCase(pkgName)
    this.alias = this.ns
    this.config = {}
    this.log = {
      trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}
    }
  }

  t = (text, ...args) => args.length ? `${text}${args.join('')}` : text
  te = () => true
  getConfig = (pathLike, opts = {}) => pathLike ? get(this.config, pathLike, opts.defValue) : this.config
  error = (msg, payload) => {
    const err = new Error(msg)
    Object.assign(err, payload ?? {})
    return err
  }
}

export const outmatch = (pattern = '', opts = {}) => {
  return (input = '') => {
    if (pattern === input) return true
    const esc = String(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
    return new RegExp(`^${esc}$`).test(input)
  }
}

export const breakNsPath = (name = '', throwError = false) => {
  if (name.includes(':')) {
    const [rawNs, ...rest] = name.split(':')
    const parts = rawNs.split('.')
    return { ns: parts[0], subNs: parts[1] ?? '', path: rest.join(':'), qs: {} }
  }
  return { ns: '', subNs: '', path: name, qs: {} }
}

export const createReplyStub = () => {
  return {
    headers: {},
    sent: null,
    redirected: null,
    statusCode: 200,
    header (k, v) { this.headers[k] = v; return this },
    send (v) { this.sent = v; return this },
    redirect (path, code) { this.redirected = { path, code }; return this },
    code (c) { this.statusCode = c; return this },
    flash () { return { ok: true } }
  }
}

export const createReqStub = (overrides = {}) => ({
  url: '/',
  raw: { url: '/' },
  query: {},
  params: {},
  headers: {},
  protocol: 'http',
  host: 'example.test',
  hostname: 'example.test',
  ip: '127.0.0.1',
  lang: 'en-US',
  id: 'req-1',
  session: { prevUrl: '/prev' },
  site: { id: 'site1', setting: {} },
  user: null,
  t: (text, ...args) => args.length ? `${text}${args.join('')}` : text,
  te: () => true,
  getSetting: () => ({}),
  isMultipart: () => false,
  routeOptions: { config: {}, url: '/' },
  ...overrides
})

export const createAppStub = (root = '/tmp/waibu-test') => {
  const app = {
    dir: root,
    mainNs: 'main',
    baseClass: { Base, Waibu: { hookTypes: ['onRequest', 'onResponse', 'preParsing', 'preValidation', 'preHandler', 'preSerialization', 'onSend', 'onTimeout', 'onError'] } },
    lib: {
      fs,
      outmatch,
      fastGlob: async (pattern) => [],
      _: {
        get, set, pick, omit, findIndex, orderBy, isArray, isEmpty, isString, find, map, mapValues, groupBy, cloneDeep, trim, trimEnd, trimStart, forOwn, invert, without, merge, isPlainObject, camelCase, kebabCase, isFunction, template, last
      },
      aneka: {
        defaultsDeep,
        isSet,
        pascalCase,
        extractText,
        resolvePath: (f, asFileUrl) => asFileUrl ? `file://${f}` : f,
        generateId: () => 'generated-id'
      }
    },
    bajo: {
      config: { env: 'dev', lang: 'en-US', intl: { supported: ['en-US', 'id'], fallback: 'en-US' } },
      eachPlugins: async () => {},
      breakNsPath,
      runHook: async () => {},
      getMethod: () => undefined,
      importModule: async () => {},
      importPkg: async (name) => {
        if (name === 'waibu:mime') return { getType: () => 'text/plain' }
        if (name === 'bajoExtra:fast-xml-parser') {
          return {
            XMLParser: class { parse (body) { return { parsed: body } } },
            XMLValidator: { validate: () => true }
          }
        }
      },
      callHandler: async (scope, handler, ...args) => typeof handler === 'function' ? handler.call(scope, ...args) : (typeof scope?.[handler] === 'function' ? scope[handler](...args) : []),
      join: (arr = []) => arr.join(', ')
    },
    log: { getErrorMessage: (err) => err.message },
    getPluginFile: (tpl) => tpl.replace(/^\w+:/, `${root}/`),
    getPluginDataDir: (ns) => `${root}/data/${ns}`,
    getAllNs: () => ['main', 'blog'],
    getPlugin: (ns) => app[ns],
    bajoExtra: { fetch: async (url, opts, extra) => ({ ok: true, status: 200, json: async () => ({ url, ok: true }) }) }
  }
  app.main = { ns: 'main', alias: 'main', config: { waibu: { prefix: '' }, intl: { detectors: [] } }, title: 'Main', t: (x) => x, te: () => true }
  app.blog = { ns: 'blog', alias: 'blog', config: { waibu: { prefix: 'blog' }, waibuMpa: { prefix: 'blog', menuHandler: [] }, intl: { detectors: [] } }, title: 'Blog', t: (x) => x, te: () => true }
  app.waibu = { config: { qsKey: { lang: 'lang' }, compress: {}, cors: {}, helmet: {}, multipart: { attachFieldsToBody: true }, rateLimit: {} }, buildSetting: (_key, opts) => opts }
  app.waibuMpa = { config: { mountMainAsRoot: false } }
  return app
}
