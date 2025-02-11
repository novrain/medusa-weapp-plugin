import {
  AuthenticationInput,
  AuthIdentityDTO,
  ConfigModule,
  IAuthModuleService
} from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  generateJwtToken,
  MedusaError,
  Modules
} from "@medusajs/framework/utils";
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse
} from "@medusajs/framework/workflows-sdk";
import { UserInfo } from "../types";

// copy from medusa-auth/src/utils.ts
export function generateJwtTokenForAuthIdentity(
  {
    authIdentity,
    actorType,
  }: { authIdentity: AuthIdentityDTO; actorType: string },
  {
    secret,
    expiresIn,
  }: { secret: string | undefined; expiresIn: string | undefined }
) {
  const entityIdKey = `${actorType}_id`
  const entityId = authIdentity?.app_metadata?.[entityIdKey] as
    | string
    | undefined

  return generateJwtToken(
    {
      actor_id: entityId ?? "",
      actor_type: actorType,
      auth_identity_id: authIdentity?.id ?? "",
      app_metadata: {
        [entityIdKey]: entityId,
      },
    },
    {
      secret,
      expiresIn,
    }
  )
}

export type WeChatMiniAppAuthInput = AuthenticationInput & {
  params?: any
}

const authenticateWeChatMiniAppStep = createStep(
  'authenticate-wechat-miniapp-step',
  async (input: WeChatMiniAppAuthInput, { container }): Promise<StepResponse<any>> => {
    const { actor_type } = input.params

    const service: IAuthModuleService = container.resolve(Modules.AUTH)

    const authData = input

    const { success, error, authIdentity } = await service.authenticate(
      "weapp-auth",
      authData
    )

    if (success && authIdentity) {
      // check if we have a customer instance
      if (actor_type === "customer" && !authIdentity?.app_metadata?.customer_id) {
        // transaction, move to workflow
        const metaData = authIdentity?.provider_identities?.find(p => p.provider === "weapp-auth")
        const userInfo = metaData?.provider_metadata as UserInfo
        const customerService = container.resolve(Modules.CUSTOMER)
        const customer = await customerService.createCustomers({ phone: userInfo.phoneInfo.phoneNumber as string, metadata: { openid: userInfo.openid, unionid: userInfo.unionid } })
        const authService = container.resolve(Modules.AUTH)
        authService.updateAuthIdentities({ id: authIdentity.id, app_metadata: { customer_id: customer.id } })
      }
      else if (actor_type === "user") { //@Todo 
        // 
      }

      const config: ConfigModule = container.resolve(
        ContainerRegistrationKeys.CONFIG_MODULE
      )
      const { http } = config.projectConfig

      const token = generateJwtTokenForAuthIdentity(
        {
          authIdentity,
          actorType: actor_type,
        },
        {
          secret: http.jwtSecret,
          expiresIn: http.jwtExpiresIn,
        }
      )

      return new StepResponse({ token })
    }

    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      error || "Authentication failed"
    )
  }
)

export const authenticateWeChatMiniAppWorkflow = createWorkflow(
  'authenticate-wechat-miniapp-flow',
  (input: WeChatMiniAppAuthInput) => {
    const result = authenticateWeChatMiniAppStep(input)
    return new WorkflowResponse(result)
  }
)