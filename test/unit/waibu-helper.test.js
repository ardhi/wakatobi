/* global describe, it, beforeEach */

import fs from 'fs'
import path from 'path'
import { expect } from 'chai'
import { writeHtml, interceptor, notFound, redirect, collectWebApps, decorate, download } from '../../lib/helper.js'
import { createAppStub, createReqStub, createReplyStub, Base } from './_stub.js'

describe('waibu helper module (unit)', () => {
  let app
  let waibu
  let root

  beforeEach(() => {
    root = fs.mkdtempSync(path.join('/tmp', 'waibu-helper-'))
    app = createAppStub(root)
    waibu = new Base('waibu', app)
    waibu.ns = 'waibu'
    waibu.webApps = [{ ns: 'blog', prefix: 'blog' }, { ns: 'main', prefix: '' }]
    waibu.getPluginByPrefix = (prefix, nsOnly) => prefix === 'blog' ? (nsOnly ? 'blog' : app.blog) : undefined
    waibu.routePath = (p) => `/r/${p}`
    waibu.fatal = (msg, ...args) => { throw new Error(`${msg}:${args.join(',')}`) }
    app.blog._handleError = async () => 'HANDLED'
    app.blog.webAppFactory = {}
  })

  it('writeHtml renders template file and sets headers', () => {
    const file = path.join(root, 'hello.html')
    fs.writeFileSync(file, 'Hello <%= name %>', 'utf8')
    const req = createReqStub({ lang: 'id' })
    const reply = createReplyStub()
    const html = writeHtml.call(waibu, req, reply, file, { name: 'Joe' })
    expect(html).to.equal('Hello Joe')
    expect(reply.headers['Content-Type']).to.equal('text/html')
    expect(reply.headers['Content-Language']).to.equal('id')
  })

  it('interceptor resolves handler from matched web app', async () => {
    const req = createReqStub({ url: '/blog/post', routeOptions: { config: {} } })
    const resp = await interceptor.call(waibu, 'error', new Error('x'), req, createReplyStub())
    expect(resp).to.equal('HANDLED')
  })

  it('redirect handles absolute and relative paths', () => {
    const reply = createReplyStub()
    redirect.call(waibu, { path: 'http://site/x' }, null, reply)
    expect(reply.redirected.path).to.equal('http://site/x')
    const reply2 = createReplyStub()
    redirect.call(waibu, { path: 'main:/x', options: {}, redirectCode: 301 }, null, reply2)
    expect(reply2.redirected.path).to.equal('/r/main:/x')
    expect(reply2.redirected.code).to.equal(301)
  })

  it('notFound uses interceptor fallback and renders 404 template', async () => {
    const file404 = path.join(root, 'lib/template/404.html')
    fs.mkdirSync(path.dirname(file404), { recursive: true })
    fs.writeFileSync(file404, '<%= title %>|<%= text %>', 'utf8')
    const req = createReqStub({ url: '/missing', routeOptions: { config: {} } })
    const reply = createReplyStub()
    const html = await notFound.call(waibu, { noContent: false }, req, reply)
    expect(reply.statusCode).to.equal(404)
    expect(html).to.include('pageNotFound')
  })

  it('collectWebApps imports and sorts web app boot modules', async () => {
    app.bajo.eachPlugins = async (handler) => {
      await handler.call({ ns: 'blog', alias: 'blog', config: { waibu: { prefix: 'blog' }, intl: { detectors: [] } } }, { file: '/x/blog/webapp/boot.js' })
      await handler.call({ ns: 'main', alias: 'main', config: { waibu: { prefix: '' }, intl: { detectors: ['path'] } } }, { file: '/x/main/webapp/boot.js' })
    }
    app.bajo.importModule = async (file) => ({ plugin: file, level: file.includes('main') ? 1 : 2, handler: async () => {} })
    const mods = await collectWebApps.call(waibu)
    expect(mods[0].ns).to.equal('main')
    expect(mods[0].prefix).to.equal(':lang')
  })

  it('decorate extends request object and download streams files', async () => {
    const reqDeco = {}
    waibu.instance = { decorateRequest: (k, v) => { reqDeco[k] = v } }
    decorate.call(waibu)
    expect(reqDeco.lang).to.equal(null)
    expect(reqDeco.getSetting).to.be.a('function')

    const file = path.join(root, 'a.txt')
    fs.writeFileSync(file, 'abc', 'utf8')
    const reply = createReplyStub()
    const req = createReqStub()
    await download.call(waibu, file, req, reply, true)
    expect(reply.headers['Content-Type']).to.equal('text/plain')
    expect(reply.headers['Content-Disposition']).to.include('a.txt')
    expect(reply.sent).to.be.an('object')
  })
})
