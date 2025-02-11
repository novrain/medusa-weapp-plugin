import { MedusaError } from "@medusajs/framework/utils"
import axios from "axios"
import util from 'util'
import WeChatAuthProviderBase, { MiniAppAuthServiceInput, MiniAppUser } from "../base"

class WeChatAuthProviderMiniService extends WeChatAuthProviderBase {

  static identifier = 'weapp-mini'

  constructor(_, options) {
    super(_, options)
  }

  public async getMiniAppUser(input: MiniAppAuthServiceInput, accessToken: string): Promise<MiniAppUser> {
    const { phoneCode, loginCode } = input

    const { appId, appSecret } = this._options

    // Call WeChat API to get phone number
    const phoneResponse = await axios.post(util.format(WeChatAuthProviderBase.getPhoneNumberApi, accessToken, phoneCode), {
      code: phoneCode
    })
    if (phoneResponse.data.errcode !== 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        phoneResponse.data.errmsg
      )
    }
    const phoneNumber = phoneResponse.data.phone_info.phoneNumber

    // Call WeChat API to get user info
    const userInfoResponse = await axios.get(util.format(WeChatAuthProviderBase.code2SessionApi, appId, appSecret, loginCode))
    const userInfo = userInfoResponse.data

    return {
      phoneNumber: phoneNumber,
      userInfo: {
        phoneInfo: {
          phoneNumber: phoneResponse.data.phone_info.phoneNumber,
          purePhoneNumber: phoneResponse.data.phone_info.purePhoneNumber,
          countryCode: phoneResponse.data.phone_info.countryCode
        },
        openid: userInfo.openid,
        unionid: userInfo.unionid
      }
    }
  }
}

export default WeChatAuthProviderMiniService
