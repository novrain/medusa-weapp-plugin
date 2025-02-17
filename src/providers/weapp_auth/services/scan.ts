import { MedusaError } from "@medusajs/framework/utils"
import axios from "axios"
import util from 'util'
import WeChatAuthProviderBase, { MiniAppAuthServiceInput, MiniAppUser } from "../base"

class WeChatAuthProviderScanService extends WeChatAuthProviderBase {

  static identifier = 'weapp-scan'

  constructor(_, options) {
    super(_, options)
  }
  
  async getMiniAppUser(input: MiniAppAuthServiceInput, accessToken: string): Promise<MiniAppUser> {
      throw new Error("Method not implemented.")
  }
}

export default WeChatAuthProviderScanService
