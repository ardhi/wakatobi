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

/**
 * @external THook
 * @see {@link https://ardhi.github.io/bajo/docs/module-Hook.html#~THook|Bajo.THook}
 */

/**
 * @async
 * @memberof module:Hook
 * @callback onCloseHandler
 */

/**
 * Hook object for the 'waibu:onClose' event. The handler is invoked when the server is closed and logs a message indicating that the server has been closed.
 *
 * @type {external:THook}
 * @memberof module:Hook
 * @name waibu:onClose
 * @property {string} [name='waibu:onClose'] - The name of the hook
 * @property {onCloseHandler} handler - The handler function for the hook
 */
const waibuOnClose = {
  name: 'waibu:onClose',
  handler: async function () {
    this.log.info('serverIs%s', this.t('closedL'))
  }
}

/**
 * @async
 * @memberof module:Hook
 * @callback onReadyHandler
 */

/**
 * Hook object for the 'waibu:onReady' event. The handler is invoked when the server is ready and logs a message indicating that the server is ready.
 *
 * @type {external:THook}
 * @memberof module:Hook
 * @property {string} [name='waibu:onReady'] - The name of the hook
 * @property {onReadyHandler} handler - The handler function for the hook
 * @name waibu:onReady
 */
const waibuOnReady = {
  name: 'waibu:onReady',
  handler: async function () {
    this.log.info('serverIs%s', this.t('readyL'))
  }
}

/**
 * @async
 * @memberof module:Hook
 * @callback onRequestHandler
 * @param {object} req - The request object
 * @param {object} reply - The reply object
 */
/**
 * Hook object for the 'waibu:onRequest' event. The handler is invoked when a request is received and logs the request details, including the method, URL, and IP address.
 *
 * @type {external:THook}
 * @memberof module:Hook
 * @property {number} [level=5] - The level of the hook
 * @property {string} [name='waibu:onRequest'] - The name of the hook
 * @property {onRequestHandler} handler - The handler function for the hook
 * @name waibu:onRequest
 */
const waibuOnRequest = {
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
}

/**
 * @callback onResponseHandler
 * @memberof module:Hook
 * @async
 * @param {object} req - The request object
 * @param {object} reply - The reply object
 */

/**
 * Hook object for the 'waibu:onResponse' event. The handler is invoked when a response is sent and logs the response details, including the method, URL, status code, and elapsed time.
 *
 * @type {external:THook}
 * @memberof module:Hook
 * @property {number} [level=5] - The level of the hook
 * @property {string} [name='waibu:onResponse'] - The name of the hook
 * @property {onResponseHandler} handler - The handler function for the hook
 * @name waibu:onResponse
 */
const waibuOnResponse = {
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
}

/**
 * @async
 * @memberof module:Hook
 * @callback waibuPreParsingHandler
 * @param {object} req - The request object
 * @param {object} reply - The reply object
 */

/**
 * Hook object for the 'waibu:preParsing' event. The handler is invoked before parsing the request and attaches internationalization (i18n) support to the request and reply objects.
 *
 * @type {external:THook}
 * @memberof module:Hook
 * @property {number} [level=9] - The level of the hook
 * @property {string} [name='waibu:preParsing'] - The name of the hook
 * @property {onPreParsingHandler} handler - The handler function for the hook
 * @name waibu:preParsing
 */
const waibuPreParsing = {
  level: 9,
  name: 'waibu:preParsing',
  handler: async function (req, reply) {
    const { importModule } = this.app.bajo
    const { attachIntl } = await importModule('waibu:/lib/webapp.js', { asDefaultImport: false })
    await attachIntl.call(this, this.config.intl.detectors, req, reply)
  }
}

/**
 * @async
 * @memberof module:Hook
 * @callback onRouteHandler
 * @param {object} options - The route options object
 */

/**
 * Hook object for the 'waibu:onRoute' event. The handler is invoked when a new route is registered and adds the route options to the list of routes.
 *
 * @type {external:THook}
 * @memberof module:Hook
 * @property {number} [level=5] - The level of the hook
 * @property {string} [name='waibu:onRoute'] - The name of the hook
 * @property {onRouteHandler} handler - The handler function for the hook
 * @name waibu:onRoute
 */
const waibuOnRoute = {
  level: 5,
  name: 'waibu:onRoute',
  handler: async function (options) {
    this.routes.push(options)
  }
}

/**
 * Register the following hooks to the application:
 *
 * - {@link module:Hook.waibu:onClose}
 * - {@link module:Hook.waibu:onReady}
 * - {@link module:Hook.waibu:onRequest}
 * - {@link module:Hook.waibu:onResponse}
 * - {@link module:Hook.waibu:preParsing}
 * - {@link module:Hook.waibu:onRoute}
 *
 * @module Hook
 * @async
 * @returns {Promise<Array<external:THook>>} - The list of hooks to be registered
 */
async function hook () {
  return [waibuOnClose, waibuOnReady, waibuOnRequest, waibuOnResponse, waibuPreParsing, waibuOnRoute]
}

export default hook
