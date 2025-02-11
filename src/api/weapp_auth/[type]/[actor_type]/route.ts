import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { authenticateWeChatMiniAppWorkflow, WeChatMiniAppAuthInput } from "../../../../workflows/weapp_auth_mini";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const type = req.params.type
  if (type !== 'mini') { // @Todo new auth type by scan on web.
    res.status(400).json({ message: 'Invalid auth type' })
    return
  }
  const actor_type = req.params.actor_type
  if (actor_type !== 'customer') { // @Todo also support console use.
    res.status(400).json({ message: 'Invalid actor_type' })
    return
  }
  const { result } = await authenticateWeChatMiniAppWorkflow(req.scope).run({
    input: {
      url: req.url,
      headers: req.headers,
      query: req.query,
      body: req.body,
      protocol: req.protocol,
      params: req.params,
    } as WeChatMiniAppAuthInput
  })
  res.json(result)
}
