import {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityDTO,
  AuthIdentityProviderService,
  ICacheService,
  Logger
} from "@medusajs/framework/types"

import { AbstractAuthModuleProvider, MedusaError } from "@medusajs/framework/utils"
import axios from 'axios'
import util from 'util'
import { UserInfo } from "../../types"

type InjectedDependencies = {
  logger: Logger
  cache: ICacheService
}

type MiniAppAuthServiceOptions = {
  appId: string
  appSecret: string
}

const WECHAT_AUTH_TOKEN_CACHE_KEY = 'wechat-auth-token-cache-key'

export type MiniAppAuthServiceInput = {
  phoneCode?: string,
  loginCode?: string,
}

export type MiniAppUser = {
  phoneNumber: string,
  userInfo: UserInfo
}

abstract class WeChatAuthProviderBase extends AbstractAuthModuleProvider {

  static tokenApi = 'https://api.weixin.qq.com/cgi-bin/token?appid=%s&secret=%s&grant_type=client_credential'
  static code2SessionApi = 'https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code'
  static getPhoneNumberApi = 'https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=%s&code=%s'

  protected _options: MiniAppAuthServiceOptions
  protected _logger: Logger
  protected _cache: ICacheService

  static validateOptions(options: MiniAppAuthServiceOptions) {
    if (!options.appId || !options.appSecret) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "appId and appSecret are required in the provider's options."
      )
    }
  }

  constructor(container: InjectedDependencies, options: MiniAppAuthServiceOptions) {
    //@ts-ignore
    super(...arguments)
    this._options = options || {}
    this._logger = container.logger
    this._cache = container.cache
  }

  private async getWeChatAccessToken(): Promise<{ accessToken: string }> {
    let accessToken = await this._cache.get<string>(WECHAT_AUTH_TOKEN_CACHE_KEY)
    if (accessToken) {
      return {
        accessToken
      }
    }
    const { appId, appSecret } = this._options
    const response = await axios.get(util.format(WeChatAuthProviderBase.tokenApi, appId, appSecret))
    accessToken = response.data.access_token as string
    await this._cache.set(WECHAT_AUTH_TOKEN_CACHE_KEY, accessToken)
    return {
      accessToken
    }
  }



  private async _registerMiniAppUser(miniAppUser: MiniAppUser, authIdentityProviderService: AuthIdentityProviderService): Promise<AuthIdentityDTO> {
    let authIdentity: AuthIdentityDTO
    try {
      authIdentity = await authIdentityProviderService.retrieve({
        entity_id: miniAppUser.phoneNumber,
      })
    } catch (error) {
      if (error.type === MedusaError.Types.NOT_FOUND) {
        authIdentity = await authIdentityProviderService.create({ entity_id: miniAppUser.phoneNumber, provider_metadata: miniAppUser.userInfo })
      } else {
        throw error
      }
    }
    return authIdentity
  }

  async authenticate(input: AuthenticationInput, authIdentityProviderService: AuthIdentityProviderService): Promise<AuthenticationResponse> {
    let miniAppUser: MiniAppUser
    let codes = input.body as MiniAppAuthServiceInput
    if (!codes.phoneCode || !codes.loginCode) {
      return {
        success: false,
        error: 'phoneCode and loginCode are required'
      }
    }
    try {
      const { accessToken } = await this.getWeChatAccessToken()
      miniAppUser = await this.getMiniAppUser(codes, accessToken)
      let authIdentity: AuthIdentityDTO = await this._registerMiniAppUser(miniAppUser, authIdentityProviderService)
      return {
        success: true,
        authIdentity
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async register(input: AuthenticationInput, authIdentityProviderService: AuthIdentityProviderService): Promise<AuthenticationResponse> {
    return this.authenticate(input, authIdentityProviderService)
  }


  abstract getMiniAppUser(input: MiniAppAuthServiceInput, accessToken: string): Promise<MiniAppUser>
}

export default WeChatAuthProviderBase