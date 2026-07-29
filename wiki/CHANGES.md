# Changes

## 2026-07-29

- [2.26.0] Change in `config.log.disabled` to accept array of values: `req` and `reply`. Defaults to empty values

## 2026-07-26

- [2.25.1] Bug fix in `helper.download()` function

## 2026-07-13

- [2.25.0] Add `forceDownload` parameter to the `helper.download()` function

## 2026-07-08

- [2.24.0] Update on waibu boot process
- [2.24.0] Update documentations

## 2026-07-06

- [2.23.0] Update all fastify-family packages to the latest versions
- [2.23.0] Update documentations

## 2026-07-04

- [2.22.0] Reorganize projects to reduce boot time

## 2026-06-29

- [2.21.0] Add `config.exposeError`

## 2026-06-20

- [2.20.0] Add `req.webApp` decorator
- [2.20.0] Rename wrongly `400.html` to `404.html` template file

## 2026-06-19

- [2.18.1] Bug fix in `routePath()`
- [2.18.1] Bug fix in `req.getSetting()`
- [2.19.0] Add feature to read `config.home` from `req.getSetting()`
- [2.19.0] Simplify `config.home` to only accept object
- [2.19.0] Add `options.redirectCode` to `reply.redirectTo()`
- [2.19.0] Home route config now read from `req.getSetting()`
- [2.19.1] Bug fix in `handle-error.js`

## 2026-06-12

- [2.18.0] Necessary updates to `bajo@2.18.0` specs

## 2026-06-10

- [2.17.0] Add `config.print`
- [2.17.0] Bug fix in `factory.routeOptions`
- [2.17.0] Add support for inversed route in `routePath()`
- [2.17.0] Disabled routes now handled directly by `waibu`, not its web apps

## 2026-06-05

- [2.16.2] Bug fix in `build-locals.js`
- [2.16.2] Bug fix in `handle-not-found.js`

## 2026-06-03

- [2.16.1] Bug fix in `handle-redirect.js`

## 2026-05-30

- [2.16.0] Change `config.log.[noReq|noReply]` to array `config.log.disable` with possible values: `request` and `response`. Defaults to empty values

## 2026-05-29

- [2.15.1] Bug fix in `build-locals.js`
- [2.15.2] Bug fix in `hook.js`

## 2026-05-28

- [2.15.0] Change hooks to be written in one `hook.js` file
- [2.15.0] Change model schemas to be written in one `model.js` file

## 2026-05-24

- [2.14.0] Add auto detection of theme & iconset for all widgets incl the dynamic one
- [2.14.0] Bug fix in `handle-error.js`

## 2026-05-22

- [2.13.0] Add `config.log.noReq` & `config.log.noReply`
- [2.13.0] Change `config.deferLog` to `config.log.defer`
- [2.13.0] Bug fix in `build-Locals.js`
- [2.13.0] Add `decorator.te`
- [2.13.0] Bug fix in `handle-error.js`

## 2026-05-16

- [2.12.0] Change in `routeDir()`
- [2.12.0] Change in `routePath()`

## 2026-05-11

- [2.11.4] Bug fix in `handle-not-found.js`

## 2026-05-03

- [2.11.2] Bug fix in `handle-not-found.js`
- [2.11.3] Bug fix in `escape()`

## 2026-04-19

- [2.11.1] Bug fix in `getSetting()`
- [2.11.1] Bug fix in `decorate.js`

## 2026-04-13

- [2.11.0] Add `getSetting()`
- [2.11.0] `req.getSetting()` now accept setting `site.setting` too

## 2026-04-11

- [2.10.0] Move all decorator to own file `decorator.js`
- [2.10.0] Add new decorator `req.getSetting()`

## 2026-03-15

- [2.9.2] Bug fix missing default `favicon.png`

## 2026-03-12

- [2.9.1] Bug fix in `req.body` parsing with multipart body parser

## 2026-03-07

- [2.9.0] Change logo
- [2.9.0] Remove favicon handler

## 2026-03-06

- [2.8.1] Bug fix in `req.body` parsing
- [2.8.2] Bug fix in `preValidation`

## 2026-03-02

- [2.8.0] Remove `sendMail()` as from now on it will be using sumba's `sendMail()`
- [2.8.0] Remove mail templates

## 2026-02-21

- [2.7.1] Bug fix in `errorHandler`
- [2.7.1] Bug fix in `notFoundHandler`
- [2.7.1] Add fallback template for both handlers above


## 2026-02-20

- [2.7.0] Add `req.te()` decorator
- [2.7.0] Bug fix in `getPluginByPrefix()`
- [2.7.0] Bug fix in `notFoundHandler.interceptor()`

## 2026-02-18

- [2.6.0] Move attribute functions from `waibu-mpa`

## 2026-02-17

- [2.5.0] Add `getHostname()`

## 2026-02-16

- [2.4.1] Bug fix in page with features

## 2026-02-09

- [2.3.4] Bug fix in error handling
- [2.3.4] Bug fix in not found handling
- [2.3.4] Bug fix in redirection handling
- [2.4.0] Accept path parameter as in `{param}` to complement `:param` in `routePath()`

## 2026-02-08

- [2.3.0] Simplify all common handler calls
- [2.3.0] All `webApp` now have it's assigned fastify context `plugin.webAppCtx`
- [2.3.0] Simplify & unite error handler & not found handler
- [2.3.0] Add `options.timeZone` in `req.format()`

## 2026-02-01

- [2.2.0] Change query string token `match` to `search` for fulltext search

## 2026-01-21

- [2.1.3] Rework on all title handlers
- [2.1.4] Faviocn handling

## 2026-01-19

- [2.1.2] Bug fix in `getAppTitle()`
- [2.1.2] Add missing some translation

## 2025-12-28

- [2.1.0] Ported to `bajo@2.2.x` specs
- [2.1.0] Upgrade to `fastify@5.6.2`
- [2.1.0] Upgrade to `query-string@9.3.1`
- [2.1.0] Upgrade to `@fastify/accepts@5.0.4`
- [2.1.0] Upgrade to `@fastify/compress@8.3.1`
- [2.1.0] Upgrade to `@fastify/cors@11.2.0`
- [2.1.0] Upgrade to `@fastify/helmet@13.0.2`
- [2.1.0] Upgrade to `@fastify/multipart@9.3.0`
- [2.1.0] Upgrade to `@fastify/rate-limit@10.3.0`
- [2.1.0] Upgrade to `@fastify/reply-from@12.5.0`
- [2.1.0] Upgrade to `@fastify/sensible@6.0.4`
- [2.1.0] Upgrade to `@fastify/session@11.1.1`
