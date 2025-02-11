import { z } from "zod"

export const WeChatAuthSchemaMini = z.object({
  phoneCode: z.string(),
  loginCode: z.string(),
})