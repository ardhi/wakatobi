/**
 * Build the homes menu by iterating through all namespaces and collecting their home routes and titles.
 *
 * @async
 * @private
 * @param {object} req - The request object
 * @returns {Promise<Array>} - The list of home routes and titles
 */
async function buildHomesMenu (req) {
  const { callHandler } = this.app.bajo
  const { get, find, orderBy } = this.app.lib._
  const routes = []
  for (const ns of this.app.getAllNs()) {
    let home = get(this, `app.${ns}.config.waibuMpa.home`)
    const homeHandler = get(this, `app.${ns}.config.waibuMpa.homeHandler`)
    if (homeHandler) home = await callHandler(this.app[ns], homeHandler)
    if (!home) continue
    const item = { href: home, ns, title: get(this, `app.${ns}.config.waibu.title`, this.app[ns].title) }
    if (!find(routes, { href: home })) routes.push(item)
  }
  return orderBy(routes, ['title'])
}

/**
 * Build the pages menu by iterating through all namespaces and collecting their page routes and titles.
 *
 * @async
 * @private
 * @param {object} req - The request object
 * @returns {Promise<Array>} - The list of page routes and titles
 */
async function buildPagesMenu (req) {
  const { find, orderBy, merge, isString } = this.app.lib._
  const { callHandler, runHook } = this.app.bajo
  const all = [{ icon: 'house', href: '/', level: 1 }]
  for (const ns of this.app.getAllNs()) {
    const items = []
    let pages = this.app[ns].getConfig('waibuMpa.menuHandler', { defValue: [] })
    if (isString(pages)) pages = await callHandler(this.app[ns], pages, req)
    if (pages.length === 0) continue
    await runHook(`${this.ns}.${ns}:afterBuildPagesMenu`, pages, req)
    for (const page of pages) {
      const existing = find(all, { title: page.title })
      page.level = page.level ?? 1000
      if (page.visible === 'auth' && !req.user) continue
      if (page.visible === 'anon' && req.user) continue
      if (!page.children) {
        const item = { menu: page, result: true }
        await runHook(`${this.ns}:checkMenuItemOnBuildPagesMenu`, item, req)
        if (!item.result) continue
        if (existing) merge(existing, page)
        else items.push(page)
        continue
      }
      const children = []
      for (const child of page.children) {
        if (child.visible === 'auth' && !req.user) continue
        if (child.visible === 'anon' && req.user) continue
        const item = { menu: child, result: true }
        await runHook(`${this.ns}:checkMenuItemOnBuildPagesMenu`, item, req)
        if (!item.result) continue
        children.push(child)
      }
      if (children.length > 0) {
        page.children = children
        if (existing) existing.children.push(...page.children)
        else items.push(page)
      }
    }
    all.push(...items)
  }
  return orderBy(all, ['level', 'title'])
}

const omitted = ['createdAt', 'updatedAt', '_immutable']

/**
 * Build the locals object for the template rendering.
 *
 * @memberof module:Helper
 * @async
 * @param {object} options - The options for building locals
 * @param {string} options.tpl - The template name
 * @param {object} options.params - The parameters for the template
 * @param {object} options.opts - Additional options
 * @returns {Promise<object>} - The locals object
 */
async function buildLocals (options = {}) {
  const { tpl, params, opts } = options
  const { runHook } = this.app.bajo
  const { set, merge, pick, get, isEmpty, find, cloneDeep, omit, isFunction } = this.app.lib._
  const { req, reply } = opts

  const _meta = { template: tpl }
  params.page = merge(params.page ?? {}, { ns: req.ns, features: [] })
  params.sidebar = params.sidebar ?? []
  if (params.error) {
    for (const ns of this.app.getAllNs()) {
      if (isFunction(this.app[ns].sanitizeError)) this.app[ns].sanitizeError(params.error)
    }
    if (params.error.ns) params.page.ns = params.error.ns
    this.log.error('error%s', params.error.message)
    if (this.app.bajo.config.env === 'dev') console.log(params.error)
  }
  if (!opts.partial) {
    merge(_meta, pick(req, ['site', 'user', 'lang', 'darkMode', 'url']))
    _meta.params = cloneDeep(req.params)
    _meta.query = cloneDeep(req.query)
    _meta.site = omit(req.site, omitted)
    _meta.user = omit(req.user, [...omitted, 'apiKey', 'salt', 'token'])
    _meta.theme = pick(find(this.themes, { name: opts.theme ?? req.theme }) ?? {}, ['name', 'framework'])
    _meta.iconset = pick(find(this.iconsets, { name: opts.iconset ?? req.iconset }) ?? {}, ['name'])
    _meta.routeOpts = get(req, 'routeOptions.config', {})
    set(params, 'menu.homes', await buildHomesMenu.call(this, req))
    set(params, 'menu.pages', await buildPagesMenu.call(this, req))
    _meta.env = this.app.bajo.config.env
    _meta.url = _meta.url.split('?')[0].split('#')[0]
    if (req.session) _meta.prevUrl = req.session.prevUrl
    _meta.route = get(req, 'routeOptions.url')
    _meta.hostHeader = req.headers.host
    _meta.statusCode = 200
    _meta.reqId = req.id
    _meta.flash = reply && req.session && req.flash && !opts.noFlash ? reply.flash() : {}
  }
  const merged = merge({}, params, { _meta })
  if (!opts.partial) {
    await runHook(`${this.ns}:afterBuildLocals`, merged, req, opts)
    if (!isEmpty(merged._meta.routeOpts.ns)) await runHook(`${this.ns}.${merged._meta.routeOpts.ns}:afterBuildLocals`, merged, req, opts)
  }
  return merged
}

export default buildLocals
