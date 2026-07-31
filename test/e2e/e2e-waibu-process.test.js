/* global describe, it */

import { expect } from 'chai'
import { runNodeInline } from './_run.js'

describe('e2e waibu process', () => {
  it('builds waibu class and executes core helpers in separate process', async function () {
    this.timeout(12000)
    const code = `
import factory from './index.js'
import { createAppStub } from './test/unit/_stub.js'
const app = createAppStub('/tmp/waibu-e2e')
const Waibu = await factory.call({ app }, 'waibu')
app.baseClass.Waibu = Waibu
const waibu = new Waibu()
app.waibu = waibu
waibu.routePathHandlers = {}
const path = waibu.routePath('blog:/post/{slug}', { params: { slug: 'hello world' }, uriEncoded: true })
const escaped = waibu.escape('<x>')
console.log('E2E_OK:' + (path === '/blog/post/hello%20world' && escaped === '&lt;x&gt;'))
`
    const res = await runNodeInline(code, '/mnt/d/Projects/Waibu/waibu')
    expect(res.code).to.equal(0)
    expect(res.stdout).to.include('E2E_OK:true')
  })
})
