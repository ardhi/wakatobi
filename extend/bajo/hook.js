export const methodColor = {
  GET: 'blue',
  POST: 'green',
  UPDATE: 'yellow',
  PATCH: 'yellow',
  DELETE: 'red'
}

const stateColor = {
  2: 'green',
  3: 'yellow',
  4: 'red',
  5: 'red'
}

async function hook () {
  return [{
    name: 'waibu:onClose',
    handler: async function () {
      this.log.info('serverIs%s', this.t('closedL'))
    }
  }, {
    name: 'waibu:onReady',
    handler: async function () {
      this.log.info('serverIs%s', this.t('readyL'))
    }
  }, {
    level: 5,
    name: 'waibu:onRequest',
    handler: async function onRequest (req, reply) {
      const { importPkg } = this.app.bajo
      const { get } = this.app.lib._
      const chalk = await importPkg('bajo:chalk')
      const { plain } = this.app.bajo.config.log

      req.site = this.config.siteInfo
      req.ns = get(reply.request, 'routeOptions.config.ns') ?? this.ns
      const ns = get(reply.request, 'routeOptions.config.webApp') ?? this.ns
      const arrow = plain ? '<' : chalk.bold('🡨')
      const c = methodColor[req.method] ?? 'gray'
      const method = plain ? req.method : chalk[c](req.method)
      const url = plain ? (':' + req.url) : chalk.gray(':' + req.url)
      const ip = plain ? this.getIp(req) : chalk.magenta(this.getIp(req))
      let msg = this.app[ns].t('httpReq%s%s%s%s', arrow, method, url.replaceAll('%', '%%'), ip)
      if (req.headers['content-length']) msg += this.app[ns].t('httpReqExt%s', req.headers['content-length'])
      if (this.config.log.defer) {
        this.reqLog = this.reqLog ?? {}
        this.reqLog[req.id] = msg
      } else if (!this.config.log.disable.includes('request')) this.app[ns].log.info(msg)
      if (Object.keys(this.config.paramsCharMap).length === 0) return
      for (const key in req.params) {
        let val = req.params[key]
        if (typeof val !== 'string') continue
        for (const char in this.config.paramsCharMap) {
          val = val.replaceAll(char, this.config.paramsCharMap[char])
        }
        req.params[key] = val
      }
    }
  }, {
    level: 5,
    name: 'waibu:onResponse',
    handler: async function onResponse (req, reply) {
      const { importPkg } = this.app.bajo
      const { get } = this.app.lib._
      const { plain } = this.app.bajo.config.log
      const chalk = await importPkg('bajo:chalk')
      let level = 'info'
      if (reply.statusCode >= 300 && reply.statusCode < 400) level = 'warn'
      else if (reply.statusCode >= 400) level = 'error'
      const ns = get(reply.request, 'routeOptions.config.webApp') ?? this.ns
      const arrow = plain ? '>' : chalk.bold('🡪')
      const mc = methodColor[req.method] ?? 'gray'
      const method = plain ? req.method : chalk[mc](req.method)
      const url = plain ? (':' + req.url) : chalk.gray(':' + req.url)
      let state = plain ? reply.statusCode : chalk.gray(reply.statusCode)
      const sc = stateColor[Math.floor(reply.statusCode / 100)]
      if (!plain && sc) state = chalk[sc](reply.statusCode)
      const elapsed = reply.elapsedTime ?? 0
      let tc = 'red'
      if (elapsed < 1000) tc = 'yellow'
      if (elapsed < 500) tc = 'green'
      const time = plain ? elapsed.toFixed(2) : chalk[tc](elapsed.toFixed(2))
      if (this.config.log.defer) {
        this.reqLog = this.reqLog ?? {}
        if (this.reqLog[req.id] && !this.config.log.disable.includes('request')) this.app[ns].log.info(this.reqLog[req.id])
        delete this.reqLog[req.id]
      }
      if (!this.config.log.disable.includes('response')) this.app[ns].log[level]('httpResp%s%s%s%s%s', arrow, method, url, state, time)
    }
  }, {
    level: 5,
    name: 'waibu:onRoute',
    handler: async function (opts) {
      this.routes.push(opts)
    }
  }, {
    level: 9,
    name: 'waibu:preParsing',
    handler: async function (req, reply) {
      const { importModule } = this.app.bajo
      const { attachIntl } = await importModule('waibu:/lib/webapp.js', { asDefaultImport: false })
      await attachIntl.call(this, this.config.intl.detectors, req, reply)
    }
  }]
}

export default hook
