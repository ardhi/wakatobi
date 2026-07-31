/* global describe, it, beforeEach */

import fs from 'fs'
import path from 'path'
import { expect } from 'chai'
import factory from '../../index.js'
import { createAppStub, createReqStub, createReplyStub } from './_stub.js'

describe('waibu class (unit)', () => {
  let app
  let Waibu
  let waibu

  beforeEach(async () => {
    app = createAppStub('/tmp/waibu-unit')
    app.waibu = undefined
    Waibu = await factory.call({ app }, 'waibu')
    app.baseClass.Waibu = Waibu
    waibu = new Waibu()
    app.waibu = waibu
    waibu.config.server.host = '127.0.0.1'
    waibu.config.server.port = 17845
    waibu.routes = [
      { path: '/users/:id', method: 'GET', url: '/users/:id', config: { ns: 'main', subNs: '', pathSrc: '/users/:id' } },
      { path: '/blog', method: ['GET', 'POST'], url: '/blog', config: { ns: 'blog', subNs: '' } }
    ]
    waibu.routePathHandlers = {}
  })

  it('static values and qs helpers are initialized', () => {
    expect(Waibu.hookTypes).to.include('preHandler')
    expect(waibu.escapeChars['<']).to.equal('&lt;')
    const parsed = waibu.qs.parse('a=1&b=true')
    expect(parsed.a).to.equal(1)
    expect(parsed.b).to.equal(true)
  })

  it('init collects route path handlers and exposeError fallback', async () => {
    const plugin = { ns: 'blog', routePathHandlers: ['api'], routePath: (name) => `/x/${name}` }
    app.bajo.eachPlugins = async (handler) => {
      await handler.call(plugin)
    }
    const FreshWaibu = await factory.call({ app }, 'waibu')
    app.baseClass.Waibu = FreshWaibu
    waibu = new FreshWaibu()
    app.waibu = waibu
    waibu.config.log.disabled = 'req'
    await waibu.init()
    expect(waibu.config.log.disabled).to.deep.equal(['req'])
    expect(waibu.routePathHandlers.api.ns).to.equal('blog')
    expect(waibu.routePathHandlers.api.handler('abc')).to.equal('/x/abc')
    expect(waibu.config.exposeError).to.equal(true)
  })

  it('finds routes and supports route matching helpers', () => {
    const route = waibu.findRoute('main:/users/:id', 'GET')
    expect(route.url).to.equal('/users/:id')
    expect(waibu.findRoute('blog:/blog', 'POST').url).to.equal('/blog')
  })

  it('escape/unescape helpers work', () => {
    expect(waibu.escape('<a>')).to.equal('&lt;a&gt;')
    expect(waibu.unescape('&lt;a&gt;')).to.equal('<a>')
    expect(waibu.unescapeBlock('Hello {{&lt;x&gt;}}', '{{', '}}', '[[', ']]')).to.equal('Hello [[<x>]]')
  })

  it('request helpers work', () => {
    expect(waibu.getIp(createReqStub({ headers: { 'x-forwarded-for': '8.8.8.8, 1.1.1.1' }, ip: '127.0.0.1' }))).to.equal('8.8.8.8')
    expect(waibu.getOrigin(createReqStub({ protocol: 'https', host: '' }))).to.equal('https://127.0.0.1:17845')
    expect(waibu.getHostname(createReqStub({ hostname: 'demo.test:8080' }))).to.equal('demo.test')
  })

  it('plugin prefix and route listing helpers work', () => {
    expect(waibu.getPluginByPrefix('blog', true)).to.equal('blog')
    expect(waibu.getPluginPrefix('blog')).to.equal('blog')
    app.waibuMpa = { config: { mountMainAsRoot: true } }
    expect(waibu.getPluginPrefix('main')).to.equal('')
    expect(waibu.getRoutes(true, true)['/blog'][0]).to.include('GET')
    expect(waibu.getRoutes(false, true)[0]).to.have.property('url')
  })

  it('path and filter helpers work', async () => {
    app.lib.fastGlob = async () => ['/tmp/a', '/tmp/b']
    const uploaded = await waibu.getUploadedFiles('r1')
    expect(uploaded).to.have.length(2)
    const uploadedUrl = await waibu.getUploadedFiles('r1', true, true)
    expect(uploadedUrl.files[0]).to.match(/^file:\/\//)

    app.blog.config.intl.detectors = ['path']
    expect(waibu.isIntlPath('blog')).to.equal(true)
    expect(waibu.parseFilter(createReqStub({ query: { bbox: '1,2,3,4', page: 3 } })).page).to.equal(3)
    expect(waibu.routeDir('blog')).to.equal('/blog')
    app.waibuMpa = { config: { mountMainAsRoot: true } }
    expect(waibu.routeDir('main')).to.equal('')
  })

  it('routePath supports ns names, params, query, handler shortcuts and special urls', () => {
    app.blog.config.intl.detectors = ['path']
    waibu.routePathHandlers.api = { handler: (name) => `/api/${name}`, ns: 'blog' }
    expect(waibu.routePath('mailto:test@example.com')).to.equal('mailto:test@example.com')
    expect(waibu.routePath(':/users/:id', { ns: 'main', params: { id: 7 } })).to.equal('/users/7')
    expect(waibu.routePath('blog.api:items', {})).to.equal('/api/blog.api:items')
    expect(waibu.routePath('blog:/post/{slug}', { params: { slug: 'hello world', lang: 'id' }, query: { page: 2 }, uriEncoded: true })).to.equal('/blog/post/hello%20world?page=2')
    expect(waibu.routePath('blog:/post', { guessHost: true })).to.equal('http://127.0.0.1:17845/blog/post')
  })

  it('attr/base64/settings helpers work', () => {
    expect(waibu.arrayToAttr(['a', { fooBar: 'x' }])).to.equal('a foo-bar:x')
    expect(waibu.attrToArray('a  b')).to.deep.equal(['a', 'b'])
    expect(waibu.attrToObject('foo-bar:x;baz:y')).to.deep.equal({ fooBar: 'x', baz: 'y' })
    const encoded = waibu.base64JsonEncode({ a: 1 })
    expect(waibu.base64JsonDecode(encoded).a).to.equal(1)
    expect(waibu.objectToAttr({ fooBar: 'x' })).to.equal('foo-bar:x')

    app.main.config.site = { title: 'Cfg' }
    const req = createReqStub({ site: { setting: { main: { site: { title: 'Req' } } } } })
    expect(waibu.getSetting('main:/site/title', { req, defValue: 'D' })).to.equal('Req')
    waibu.config.route.disabled = ['main:/secret']
    expect(waibu.isRouteDisabled('main:/secret', false)).to.equal('main:/secret')
    const built = waibu.buildSetting('main', { req })
    expect(built.site.title).to.equal('Req')
  })

  it('fetch wraps routePath and throws on non-ok response', async () => {
    let called
    waibu.routePath = (name) => `http://x/${name}`
    app.bajoExtra.fetch = async (url) => {
      called = url
      return { ok: true, status: 200, json: async () => ({ ok: true }) }
    }
    const ok = await waibu.fetch('demo:path')
    expect(ok.ok).to.equal(true)
    expect(called).to.equal('http://x/demo:path')

    app.bajoExtra.fetch = async () => ({ ok: false, status: 500, json: async () => ({ message: 'boom' }) })
    let err
    try { await waibu.fetch('demo:path') } catch (e) { err = e }
    expect(err).to.be.instanceOf(Error)
    expect(err.statusCode).to.equal(500)
  })

  it('prints routes and exit closes instance', async () => {
    const traces = []
    waibu.log.trace = (...args) => traces.push(args)
    waibu._printRoutes()
    expect(traces.length).to.be.greaterThan(0)
    let closed = false
    waibu.instance = { close: () => { closed = true } }
    await waibu.exit()
    expect(closed).to.equal(true)
  })

  it('handles home redirect and forward routes', async () => {
    let rootHandler
    waibu.instance = {
      get: (url, handler) => {
        if (url === '/') rootHandler = handler
      }
    }
    await waibu._handleHome()

    const req = createReqStub({
      getSetting: () => ({ path: 'blog:/home', options: {}, forward: false })
    })
    const reply = {
      redirectTo: (path, opts) => ({ path, opts }),
      forwardTo: (path, opts) => ({ path, opts })
    }
    const resp = await rootHandler(req, reply)
    expect(resp.path).to.equal('blog:/home')

    const req2 = createReqStub({
      params: { id: '1' },
      query: { q: 'a' },
      getSetting: () => ({ path: 'blog:/home', forward: true, params: { slug: 'x' }, query: { page: 2 } })
    })
    const resp2 = await rootHandler(req2, reply)
    expect(resp2.path).to.equal('blog:/home')
    expect(resp2.opts.query.page).to.equal(2)
  })

  it('registers redirect and forward reply decorators', async () => {
    let redirectTo
    let forwardTo
    const registered = []
    waibu.instance = {
      decorateReply: (name, fn) => {
        if (name === 'redirectTo') redirectTo = fn
        if (name === 'forwardTo') forwardTo = fn
      },
      register: (...args) => { registered.push(args) }
    }
    waibu.routePath = (p) => `/r/${p}`
    await waibu._handleRedirect()
    await waibu._handleForward()
    expect(registered).to.have.length(1)

    const reply = {
      redirected: null,
      fromArgs: null,
      redirect (path, code) { this.redirected = { path, code }; return this },
      from (path, opts) { this.fromArgs = { path, opts }; return this }
    }
    const redirected = redirectTo.call(reply, 'main:/x', {})
    expect(redirected.redirected.path).to.equal('/r/main:/x')

    const forwardedHttp = forwardTo.call({ ...reply, redirectTo: (url) => ({ redirected: url }) }, 'http://x')
    expect(forwardedHttp.redirected).to.equal('http://x')

    const forwardedLocal = forwardTo.call(reply, 'main:/y', {})
    expect(forwardedLocal.fromArgs.path).to.equal('/r/main:/y')
    expect(forwardedLocal.fromArgs.opts.rewriteHeaders({}, {})['X-Fwd-To']).to.equal(true)
  })

  it('registers not-found and error handlers', async () => {
    let notFoundHandler
    let errorHandler
    const tpl404 = '/tmp/waibu-unit/lib/template/404.html'
    const tpl500 = '/tmp/waibu-unit/lib/template/500.html'
    fs.mkdirSync(path.dirname(tpl404), { recursive: true })
    fs.writeFileSync(tpl404, '<%= title %>|<%= text %>', 'utf8')
    fs.mkdirSync(path.dirname(tpl500), { recursive: true })
    fs.writeFileSync(tpl500, '<%= title %>|<%= text %>', 'utf8')
    waibu.webApps = [{ ns: 'blog', prefix: 'blog' }, { ns: 'main', prefix: '' }]
    waibu.instance = {
      setNotFoundHandler: (fn) => { notFoundHandler = fn },
      setErrorHandler: (fn) => { errorHandler = fn }
    }
    app.blog._handleError = async () => 'HANDLED'
    await waibu._handleNotFound()
    await waibu._handleError()

    const reply = { ...createReqStub(), ...{ headers: {}, header (k, v) { this.headers[k] = v; return this }, code (c) { this.statusCode = c; return this } } }
    const nf = await notFoundHandler(createReqStub({ url: '/x' }), createReplyStub())
    expect(nf).to.include('pageNotFound')

    const errResp = await errorHandler.call({ log: { error: () => {} } }, { message: '_redirect', path: 'http://x' }, createReqStub({ routeOptions: { config: { webApp: 'blog' } } }), createReplyStub())
    expect(errResp.redirected.path).to.equal('http://x')

    const handled = await errorHandler.call({ log: { error: () => {} } }, new Error('boom'), createReqStub({ routeOptions: { config: { webApp: 'blog' } } }), createReplyStub())
    expect(handled).to.equal('HANDLED')
  })

  it('registers app hooks and runs web apps in order', async () => {
    const hooks = []
    const regs = []
    const runHooks = []
    app.bajo.runHook = async (...args) => runHooks.push(args)
    waibu.instance = {
      addHook: (name, fn) => hooks.push({ name, fn }),
      register: async (fn, opts) => {
        regs.push(opts)
        await fn({ ctx: true })
      }
    }
    await waibu._handleAppHook()
    expect(hooks.map(h => h.name)).to.include('onReady')

    waibu.log.debug = () => {}
    waibu.app.blog.handlerRan = false
    waibu.app.main.handlerRan = false
    app.bajo.eachPlugins = async (handler) => {
      await handler.call(app.main, { file: '/tmp/waibu-unit/main/webapp/boot.js' })
      await handler.call(app.blog, { file: '/tmp/waibu-unit/blog/webapp/boot.js' })
    }
    app.bajo.importModule = async (file) => ({
      level: file.includes('/main/') ? 1 : 2,
      handler: async function () { this.handlerRan = true }
    })
    await waibu._runWebApps()
    expect(regs).to.have.length(2)
    expect(app.main.handlerRan).to.equal(true)
    expect(app.blog.handlerRan).to.equal(true)
  })

  it('handles favicon and robots routes using file fallbacks', async () => {
    let faviconHandler
    let robotsHandler
    const favicon = '/tmp/waibu-unit/favicon.png'
    const robots = '/tmp/waibu-unit/robots.txt'
    fs.writeFileSync(favicon, 'x', 'utf8')
    fs.writeFileSync(robots, 'y', 'utf8')
    waibu.instance = {
      get: (url, fn) => {
        if (url === '/favicon.:ext') faviconHandler = fn
        if (url === '/robots.txt') robotsHandler = fn
      }
    }
    await waibu._handleFavicon()
    await waibu._handleRobotsTxt()
    const rep1 = createReplyStub()
    await faviconHandler(createReqStub({ params: { ext: 'png' } }), rep1)
    expect(rep1.headers['cache-control']).to.equal('max-age=86400')
    const rep2 = createReplyStub()
    await robotsHandler(createReqStub(), rep2)
    expect(rep2.headers['cache-control']).to.equal('max-age=86400')
  })
})
