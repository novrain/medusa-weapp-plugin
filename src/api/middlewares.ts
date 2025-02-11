import {
  defineMiddlewares,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { WeChatAuthSchemaMini } from "./weapp_auth/validators"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/weapp_auth/mini/:actor_type",
      method: "POST",
      middlewares: [
        //@ts-ignore
        validateAndTransformBody(WeChatAuthSchemaMini),
      ],
    },
  ],
})