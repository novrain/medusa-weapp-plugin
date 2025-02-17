import {
  InitiatePaymentInput
} from "@medusajs/types"
import WeChatPaymentProviderBase, { WeParams } from "../base"

class WeChatPaymentProviderMiniService extends WeChatPaymentProviderBase {

  static identifier = 'weapp-mini'

  constructor(_, options) {
    super(_, options)
  }

  public async createWepayTransaction(input: InitiatePaymentInput, params: WeParams): Promise<any> {
    const { data } = input
    params.payer = {
      openid: data?.openid as string,
    }
    return this._wepay.transactions_jsapi(params)
  }

  public tradeNoToSessionId(out_trade_no: string): string {
    return out_trade_no.replaceAll('m_', 'payses_')
  }

  public sessinIdToTradeNo(session_id: string): string {
    return session_id.replaceAll('payses_', 'm_')
  }

}

export default WeChatPaymentProviderMiniService
