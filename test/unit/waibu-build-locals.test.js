/* global describe, it, beforeEach */

import { expect } from 'chai'
import buildLocals from '../../lib/build-locals.js'
import { createAppStub, createReqStub, createReplyStub, Base } from './_stub.js'

describe('waibu build-locals module (unit)', () => {
  let app
  let plugin
  let hookCalls

  beforeEach(() => {
    app = createAppStub('/tmp/waibu-locals')
    hookCalls = []
    app.bajo.runHook = async (...args) => hookCalls.push(args)
    app.bajo.callHandler = async (scope, handler) => handler.call(scope)
    app.main.config.waibuMpa = { home: '/home', menuHandler: [{ title: 'Home', href: '/', level: 1 }] }
    app.main.config.waibu = { title: 'Main Title' }
    app.blog.config.waibuMpa = {
      homeHandler: function () { return '/blog-home' },
      menuHandler: function () { return [{ title: 'Blog', href: '/blog', level: 2, children: [{ title: 'Child', href: '/blog/c', visible: 'anon' }] }] }
    }
    app.blog.config.waibu = { title: 'Blog Title' }
      app.main.getConfig = function (path, opts = {}) { return this.config?.waibuMpa?.menuHandler ?? opts.defValue }
      app.blog.getConfig = function (path, opts = {}) { return this.config?.waibuMpa?.menuHandler ?? opts.defValue }
    app.blog.sanitizeError = (err) => { err.cleaned = true }
    plugin = new Base('waibu', app)
    plugin.ns = 'waibu'
    plugin.themes = [{ name: 'default', framework: 'bootstrap' }]
    plugin.iconsets = [{ name: 'main' }]
    plugin.log.error = () => {}
  })

  it('builds locals with meta, menus, theme/icon info and hook calls', async () => {
    const req = createReqStub({
      ns: 'blog',
      lang: 'id',
      url: '/blog?a=1#x',
      flash: () => ({}),
      theme: 'default',
      iconset: 'main',
      query: { page: 2 },
      params: { id: '10' },
      routeOptions: { config: { ns: 'blog' }, url: '/blog' },
      site: { id: 's1', createdAt: 'x', setting: {} },
      user: { username: 'joe', apiKey: 'secret' }
    })
    const reply = createReplyStub()
    const result = await buildLocals.call(plugin, { tpl: 'page', params: {}, opts: { req, reply, theme: 'default', iconset: 'main' } })
    expect(result._meta.template).to.equal('page')
    expect(result._meta.theme.name).to.equal('default')
    expect(result._meta.iconset.name).to.equal('main')
    expect(result.menu.homes).to.have.length(2)
    expect(result.menu.pages[0].href).to.equal('/')
    expect(result._meta.url).to.equal('/blog')
    expect(result._meta.flash.ok).to.equal(true)
    expect(hookCalls.some(c => c[0] === 'waibu:afterBuildLocals')).to.equal(true)
  })

  it('handles partial mode and sanitizes errors', async () => {
    const req = createReqStub({ ns: 'blog', routeOptions: { config: { ns: 'blog' }, url: '/x' } })
    const err = { message: 'boom', ns: 'blog' }
    const result = await buildLocals.call(plugin, { tpl: 'err', params: { error: err }, opts: { req, partial: true } })
    expect(result.error.cleaned).to.equal(true)
    expect(result.page.ns).to.equal('blog')
    expect(result._meta.template).to.equal('err')
  })
})
