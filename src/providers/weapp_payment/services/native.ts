import {
  InitiatePaymentInput
} from "@medusajs/framework/types";
import WeChatPaymentProviderBase, { WeParams } from "../base";

class WeChatPaymentProviderNativeService extends WeChatPaymentProviderBase {
  static identifier = 'weapp-native'

  constructor(_, options) {
    super(_, options)
  }

  public async createWepayTransaction(input: InitiatePaymentInput, params: Partial<WeParams>): Promise<any> {
    return this._wepay.transactions_native(params as WeParams)
  }

  public tradeNoToSessionId(out_trade_no: string): string {
    return out_trade_no.replaceAll('p_', 'payses_')
  }
  public sessinIdToTradeNo(session_id: string): string {
    return session_id.replaceAll('payses_', 'p_')
  }

}

export default WeChatPaymentProviderNativeService
