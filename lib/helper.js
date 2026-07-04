import path from 'path'

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

export async function interceptor (name, err, req, reply) {
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
    if (handler) return await handler.call(plugin, err, req, reply)
  }
}

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

export function redirect (err = {}, req, reply) {
  if (err.path.startsWith('http') || path.isAbsolute(err.path)) reply.redirect(err.path)
  else reply.redirect(this.routePath(err.path, err.options), err.redirectCode)
  return reply
}

export async function collectWebApps (glob = 'boot.js', baseNs) {
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

export async function decorate () {
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
 * @method
 * @async
 * @param {string|Function} input - File path or function that returns file path. If it is a function, it will be called with ```this``` context and ```req``` as parameter
 * @param {object} req - The request object_handleNot
 * @param {object} reply - The reply object
 * @returns {Promise<object>} - The reply object
 */
export async function download (input, req, reply) {
  const { importPkg } = this.app.bajo
  const { fs } = this.app.lib
  const { isFunction } = this.app.lib._
  const mime = await importPkg('waibu:mime')
  const file = isFunction(input) ? (await input.call(this, req)) : input
  if (!fs.existsSync(file)) throw this.error('_notFound')
  const mimeType = mime.getType(path.extname(file))
  reply.header('Content-Type', mimeType)
  const stream = fs.createReadStream(file)
  reply.send(stream)
  return reply
}
