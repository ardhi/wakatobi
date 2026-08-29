/**
 * @typedef TConfig
 * @type {Object}
 * @memberof Waibu
 * @property {Object} home - Home configuration
 * @property {Object} server - Server configuration
 * @property {boolean} [server.disabled=false] - Disable server
 * @property {string} [server.host='127.0.0.1'] - Server host
 * @property {number} [server.port=17845] - Server port
 * @property {Object} factory - Factory configuration. @see {@link https://fastify.dev/docs/latest/Reference/Server/#factory}
 * @property {Object} intl - Internationalization configuration
 * @property {Array<string>} [intl.detectors=['qs']] - Language detectors
 * @property {Object} log - Logging configuration
 * @property {Array<string>} [log.disabled=[]] - Disable loggers. Available values: 'req' & 'reply'
 * @property {boolean} [log.defer=false] - Defer logging
 * @property {string} prefixVirtual - Prefix for virtual routes
 * @property {Object} qsKey - Query string key configuration
 * @property {string} [qsKey.bbox='bbox'] - Bounding box key
 * @property {string} [qsKey.bboxLatField='bboxLatField'] - Bounding box latitude field key
 * @property {string} [qsKey.bboxLngField='bboxLngField'] - Bounding box longitude field key
 * @property {string} [qsKey.query='query'] - Query key
 * @property {string} [qsKey.search='search'] - Search key
 * @property {string} [qsKey.skip='skip'] - Skip key
 * @property {string} [qsKey.page='page'] - Page key
 * @property {string} [qsKey.limit='limit'] - Limit key
 * @property {string} [qsKey.sort='sort'] - Sort key
 * @property {string} [qsKey.fields='fields'] - Fields key
 * @property {string} [qsKey.lang='lang'] - Language key
 * @property {Object} [paramsCharMap={}] - Parameters character map
 * @property {Object} [route={}] - Route configuration
 * @property {boolean} [route.print=true] - Print route information
 * @property {Array<string>} [route.disabled=[]] - Disabled routes
 * @property {string} [pageTitleFormat='%s : %s'] - Page title format
 * @property {Object} [siteInfo={}] - Site information
 * @property {string} [siteInfo.title='My Website'] - Site title
 * @property {string} [siteInfo.orgName='My Organization'] - Organization name
 * @property {Object} [cors={}] - CORS configuration
 * @property {Object} [compress={}] - Compression configuration
 * @property {Object} [helmet={}] - Helmet configuration
 * @property {Object} [rateLimit={}] - Rate limit configuration
 * @property {Object} [multipart={}] - Multipart configuration
 * @property {boolean} [exposeError=false] - Expose error configuration
 * @property {boolean} [underPressure=false] - Under pressure configuration
 * @property {Object} [forwardOpts={}] - Forward options configuration
 * @property {boolean} [forwardOpts.disableRequestLogging=true] - Disable request logging for forward requests
 * @property {Object} [forwardOpts.undici={}] - Undici configuration for forward requests
 */
const config = {
  home: {},
  server: {
    disabled: false,
    host: '127.0.0.1',
    port: 17845
  },
  factory: {
    trustProxy: true,
    bodyLimit: 10485760,
    pluginTimeout: 30000,
    routerOptions: {
    }
  },
  intl: {
    detectors: ['qs']
  },
  log: {
    disabled: [],
    defer: false
  },
  prefixVirtual: '~',
  qsKey: {
    bbox: 'bbox',
    bboxLatField: 'bboxLatField',
    bboxLngField: 'bboxLngField',
    query: 'query',
    search: 'search',
    skip: 'skip',
    page: 'page',
    limit: 'limit',
    sort: 'sort',
    fields: 'fields',
    lang: 'lang'
  },
  paramsCharMap: {},
  route: {
    print: true,
    disabled: []
  },
  pageTitleFormat: '%s : %s',
  siteInfo: {
    title: 'My Website',
    orgName: 'My Organization'
  },
  cors: {},
  compress: {},
  helmet: {},
  rateLimit: {},
  multipart: {
    attachFieldsToBody: true,
    limits: {
      parts: 100,
      fileSize: 10485760
    }
  },
  exposeError: undefined,
  underPressure: false,
  forwardOpts: {
    disableRequestLogging: true,
    undici: {
      connections: 128,
      pipelining: 1,
      keepAliveTimeout: 60 * 1000,
      tls: {
        rejectUnauthorized: false
      }
    }
  }
}

export default config
