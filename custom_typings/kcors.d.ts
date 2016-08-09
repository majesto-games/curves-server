declare module "kcors" {
  import * as Koa from "koa";

  function kcors (opts?: {
    origin?: string | ((ctx: Koa.Context) => any)
    allowMethods?: string | string[]
    exposeHeaders?: string | string[]
    allowHeaders?: string | string[]
    maxAge?: string | number
    credentials?: boolean
    keepHeadersOnError?: boolean
  }): (ctx: Koa.Context, next: () => Promise<any>) => any
  namespace kcors {}
  export = kcors
}
