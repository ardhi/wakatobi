/* global describe, it, beforeEach */

import { expect } from 'chai'
import {
  attachIntl, handleCompress, handleCors, handleHelmet, handleMultipartBody,
  handleRateLimit, handleXmlBody, mergeRouteHooks, reroutedPath, routeHook
} from '../../lib/webapp.js'
import { createAppStub, createReqStub, createReplyStub, Base } from './_stub.js'

describe('waibu webapp module (unit)', () => {
  let app
  let plugin
  let calls

  beforeEach(() => {
    app = createAppStub('/tmp/waibu-webapp')
    calls = []
    plugin = new Base('blog', app)
    plugin.webAppCtx = {
      register: async (...args) => calls.push(['register', ...args]),
      addHook: (name, fn) => calls.push(['hook', name, fn]),
      addContentTypeParser: (...args) => calls.push(['parser', ...args])
    }
    plugin.app.waibu = { config: { qsKey: { lang: 'lang' }, compress: { global: true }, cors: { c: true }, helmet: { h: true }, multipart: { attachFieldsToBody: true }, rateLimit: { max: 10 } }, buildSetting: (_k, opts) => opts, routePath: (p) => `/r/${p}` }
    plugin.app.baseClass.Waibu = { hookTypes: ['onRequest', 'preHandler'] }
  })

  it('attachIntl decorates request translation and formatting helpers', async () => {
    app.bajo.config.intl.supported = ['en-US', 'id']
    app.bajo.config.intl.fallback = 'en-US'
    app.blog.t = (text, ...args) => `${text}:${args.at(-1).lang}`
    app.blog.te = () => true
    app.bajo.format = (value, type, opts) => `${value}:${type}:${opts.lang}`
    const req = createReqStub({ query: { lang: 'id' }, routeOptions: { config: { ns: 'blog' } } })
    const reply = createReplyStub()
    await attachIntl.call(plugin, ['qs'], req, reply)
    expect(req.lang).to.equal('id')
    expect(req.t('hello')).to.equal('hello:id')
    expect(req.format(5, 'integer')).to.equal('5:integer:id')
  })

  it('registers common middleware and supports disabled switches', async () => {
    await handleCompress.call(plugin, {})
    await handleCors.call(plugin, {})
    await handleHelmet.call(plugin, {})
    await handleRateLimit.call(plugin, {})
    expect(calls.filter(c => c[0] === 'register')).to.have.length(4)

    calls.length = 0
    await handleCompress.call(plugin, false)
    await handleCors.call(plugin, false)
    await handleHelmet.call(plugin, false)
    await handleRateLimit.call(plugin, false)
    expect(calls.filter(c => c[0] === 'register')).to.have.length(0)
  })

  it('handles multipart body normalization', async () => {
    await handleMultipartBody.call(plugin, {})
    const hook = calls.find(c => c[0] === 'hook' && c[1] === 'preValidation')[2]
    const req = createReqStub({ isMultipart: () => true, body: { a: { value: '1' }, 'tags[]': [{ value: 'x' }, { value: 'null' }] } })
    await hook(req, createReplyStub())
    expect(req.body.a).to.equal('1')
    expect(req.body.tags).to.deep.equal(['x', null])
  })

  it('handles xml body registration and warnings', async () => {
    await handleXmlBody.call(plugin, { contentTypes: ['application/xml'] })
    expect(calls.find(c => c[0] === 'parser')).to.exist

    calls.length = 0
    delete app.bajoExtra
    await handleXmlBody.call(plugin, { contentTypes: ['application/xml'] })
    expect(calls.find(c => c[0] === 'parser')).to.equal(undefined)
  })

  it('wraps route hooks, reroutes path and registers route hooks', async () => {
    const def = {
      preHandler: async function (req, reply, done) { return this.ns },
      handler: async function () { return this.ns }
    }
    await mergeRouteHooks.call(plugin, def, true)
    const got = await def.preHandler('req', 'reply', () => {})
    expect(got).to.equal('blog')

    const routed = await reroutedPath.call(plugin, '/r/main:/from', { 'main:/from': 'main:/to' })
    expect(routed).to.equal('/r/main:/to')

    calls.length = 0
    app.waibu.instance = { addHook: (name, fn) => calls.push(['hook', name, fn]) }
    await routeHook.call(plugin, 'waibu')
    expect(calls).to.have.length(2)
  })
})
