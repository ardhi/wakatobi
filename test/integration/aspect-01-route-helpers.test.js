/* global describe, it, beforeEach */

import { expect } from 'chai'
import factory from '../../index.js'
import { createAppStub } from '../unit/_stub.js'

describe('integration aspect 01 - route helpers', () => {
  let app
  let waibu

  beforeEach(async () => {
    app = createAppStub('/tmp/waibu-int-01')
    const Waibu = await factory.call({ app }, 'waibu')
    app.baseClass.Waibu = Waibu
    waibu = new Waibu()
    app.waibu = waibu
    waibu.routePathHandlers = {}
    waibu.routes = [
      { path: '/blog', method: ['GET', 'POST'], url: '/blog', config: { ns: 'blog', subNs: '' } }
    ]
  })

  it('builds paths and resolves routes consistently', () => {
    const path = waibu.routePath('blog:/post/{slug}', { params: { slug: 'hello world' }, query: { page: 1 }, uriEncoded: true })
    expect(path).to.equal('/blog/post/hello%20world?page=1')
    const route = waibu.findRoute('blog:/blog', 'POST')
    expect(route.url).to.equal('/blog')
  })
})
