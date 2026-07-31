/* global describe, it, beforeEach */

import { expect } from 'chai'
import buildLocals from '../../lib/build-locals.js'
import { createAppStub, createReqStub, createReplyStub, Base } from '../unit/_stub.js'

describe('integration aspect 02 - build locals', () => {
  let app
  let plugin

  beforeEach(() => {
    app = createAppStub('/tmp/waibu-int-02')
    app.bajo.runHook = async () => {}
    app.main.config.waibuMpa = { home: '/home', menuHandler: [{ title: 'Main', href: '/', level: 1 }] }
    app.blog.config.waibuMpa = { menuHandler: [{ title: 'Blog', href: '/blog', level: 2 }] }
    app.main.getConfig = function (path, opts = {}) { return this.config?.waibuMpa?.menuHandler ?? opts.defValue }
    app.blog.getConfig = function (path, opts = {}) { return this.config?.waibuMpa?.menuHandler ?? opts.defValue }
    plugin = new Base('waibu', app)
    plugin.ns = 'waibu'
    plugin.themes = [{ name: 'default', framework: 'bootstrap' }]
    plugin.iconsets = [{ name: 'main' }]
    plugin.log.error = () => {}
  })

  it('builds menus and meta for non-partial responses', async () => {
    const req = createReqStub({ theme: 'default', iconset: 'main', routeOptions: { config: { ns: 'blog' }, url: '/blog' } })
    const reply = createReplyStub()
    const locals = await buildLocals.call(plugin, { tpl: 'home', params: {}, opts: { req, reply, theme: 'default', iconset: 'main' } })
    expect(locals.menu.pages).to.have.length.greaterThan(0)
    expect(locals._meta.template).to.equal('home')
  })
})
