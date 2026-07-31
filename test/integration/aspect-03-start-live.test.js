/* global describe, it, beforeEach, afterEach */

import fs from 'fs'
import path from 'path'
import { expect } from 'chai'
import factory from '../../index.js'
import config from '../../lib/config.js'
import { createAppStub } from '../unit/_stub.js'

describe('integration aspect 03 - live start', () => {
  let root
  let app
  let waibu
  let configSnapshot

  beforeEach(async () => {
    configSnapshot = JSON.parse(JSON.stringify(config))
    root = fs.mkdtempSync(path.join('/tmp', 'waibu-live-start-'))
    fs.mkdirSync(path.join(root, 'lib', 'template'), { recursive: true })
    fs.writeFileSync(path.join(root, 'lib', 'template', '404.html'), '<%= title %>|<%= text %>', 'utf8')
    fs.writeFileSync(path.join(root, 'lib', 'template', '500.html'), '<%= title %>|<%= text %>', 'utf8')

    app = createAppStub(root)
    app.bajo.eachPlugins = async () => {}
    app.bajo.runHook = async () => {}

    const Waibu = await factory.call({ app }, 'waibu')
    app.baseClass.Waibu = Waibu
    waibu = new Waibu()
    app.waibu = waibu

    waibu.config.server.host = '127.0.0.1'
    waibu.config.server.port = 0
    waibu.config.route.print = false
    waibu.config.favicon = false
    waibu.config.robotsTxt = false
    waibu.config.home = { path: 'main:/landing' }
    waibu.routePathHandlers = {}
  })

  afterEach(async () => {
    try {
      if (waibu?.instance) await waibu.instance.close()
    } catch (err) {}
    Object.keys(config).forEach(k => { delete config[k] })
    Object.assign(config, JSON.parse(JSON.stringify(configSnapshot)))
    if (root) fs.rmSync(root, { recursive: true, force: true })
  })

  it('starts a live fastify instance, redirects home, and serves 404 page', async function () {
    this.timeout(15000)

    await waibu.start()
    const address = waibu.instance.server.address()
    const base = `http://127.0.0.1:${address.port}`

    const homeResp = await fetch(`${base}/`, { redirect: 'manual' })
    expect(homeResp.status).to.equal(302)
    expect(homeResp.headers.get('location')).to.equal('/landing')

    const missingResp = await fetch(`${base}/missing`, { redirect: 'manual' })
    expect(missingResp.status).to.equal(404)
    const html = await missingResp.text()
    expect(html).to.equal('|')
  })
})
