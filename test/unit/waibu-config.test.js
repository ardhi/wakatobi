/* global describe, it */

import { expect } from 'chai'
import config from '../../lib/config.js'

describe('waibu config module (unit)', () => {
  it('exports expected defaults', () => {
    expect(config.server.host).to.equal('127.0.0.1')
    expect(config.server.port).to.equal(17845)
    expect(config.intl.detectors).to.include('qs')
    expect(config.route.print).to.equal(true)
    expect(config.multipart.attachFieldsToBody).to.equal(true)
    expect(config.forwardOpts.disableRequestLogging).to.equal(true)
  })
})
