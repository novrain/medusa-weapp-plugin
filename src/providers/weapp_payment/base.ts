import { AbstractPaymentProvider, BigNumber, isDefined, MedusaError, PaymentActions, PaymentEvents } from "@medusajs/framework/utils"
import {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  BigNumberInput,
  BigNumberRawValue,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  ICacheService,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  PaymentSessionStatus,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult
} from "@medusajs/types"
import { BigNumber as BigNumberJS } from "bignumber.js"
import fs from 'fs'
import WxPay from 'wechatpay-node-v3'
import { Ijsapi, Inative } from "wechatpay-node-v3/dist/lib/interface"

type InjectedDependencies = {
  logger: Logger
  cache: ICacheService
}

type WeChatMiniAppPaymentOptions = {
  appid: string
  mchid: string
  publicKey: string
  privateKey: string
  v3key: string
  defaultDescription?: string
  domain: string
}

type BNInput = BigNumberInput | BigNumber

export type WeParams = Ijsapi & Inative

abstract class WeChatPaymentProviderBase extends AbstractPaymentProvider<WeChatMiniAppPaymentOptions> {

  protected _options: WeChatMiniAppPaymentOptions
  protected _logger: Logger
  protected _cache: ICacheService
  protected _wepay: WxPay

  static convert(num: BNInput): BigNumberJS {
    if (num == null) {
      return new BigNumberJS(0)
    }

    if (num instanceof BigNumber) {
      return num.bigNumber!
    } else if (num instanceof BigNumberJS) {
      return num
    } else if (isDefined((num as BigNumberRawValue)?.value)) {
      return new BigNumberJS((num as BigNumberRawValue).value)
    }

    return new BigNumberJS(num as BigNumberJS | number)
  }

  static validateOptions(options: WeChatMiniAppPaymentOptions) {
    if (!options.appid || !options.mchid || !options.publicKey || !options.privateKey || !options.domain || !options.v3key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "appid, mchid, publickKey, privateKey, domain and v3key are required in the provider's options."
      )
    }
    if (!fs.existsSync(options.publicKey)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "publickKey file does not exist."
      )
    }
    if (!fs.existsSync(options.privateKey)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "privateKey file does not exist"
      )
    }
  }

  constructor(container: InjectedDependencies, options: WeChatMiniAppPaymentOptions) {
    //@ts-ignore
    super(...arguments)
    this._options = options || {}
    this._logger = container.logger
    // this._cache = container.cache
    this._wepay = new WxPay({
      appid: options.appid,
      mchid: options.mchid,
      publicKey: fs.readFileSync(options.publicKey),
      privateKey: fs.readFileSync(options.privateKey)
    })
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const { data } = input
    const session_id = data?.session_id as string
    const out_trade_no = this.sessinIdToTradeNo(session_id)
    const params = {
      description: data?.description as string || this._options.defaultDescription || 'weapp_payment',
      out_trade_no: out_trade_no,
      notify_url: this.getNotifyHookUrl(),
      amount: {
        total: WeChatPaymentProviderBase.convert(input.amount).toNumber() * 100, // 没有小数
        currency: input.currency_code.toUpperCase()
      },
      attach: session_id,
    }
    const result = await this.createWepayTransaction(input, params)
    const error = JSON.parse(result.error || '{}')
    if (error.message) {
      throw this.buildError(error.message, error.code, error.detail)
    }
    else {
      return {
        id: out_trade_no, // useless
        data: { ...result.data, out_trade_no, amount: params.amount }
      }
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return { ...input }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const out_trade_no = input.data?.out_trade_no as string
    if (!out_trade_no) {
      throw this.buildError("Invalid payment", "no out_trade_no", "")
    }
    const { transaction_id, success_time } = (await this.retrievePayment(input)) as any;
    return { status: "captured", data: { ...input.data, transaction_id, success_time } } // auto captured.
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const out_trade_no = input.data?.out_trade_no as string
    if (!out_trade_no) {
      return { ...input, reason: 'no out_trade_no' } as CancelPaymentOutput
    }
    const result = await this._wepay.close(out_trade_no)
    const error = JSON.parse(result.error || '{}')
    if (error.message) {
      throw this.buildError(error.message, error.code, error.detail)
    } else {
      return { ...input }
    }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input)
  }

  /**
   * 
   *【wechat交易状态]
   * SUCCESS：支付成功
   * REFUND：转入退款
   * NOTPAY：未支付
   * CLOSED：已关闭
   * REVOKED：已撤销（仅付款码支付会返回）
   * USERPAYING：用户支付中（仅付款码支付会返回）
   * PAYERROR：支付失败（仅付款码支付会返回）
   * @param paymentSessionData 
   * @returns 
   */
  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const out_trade_no = input.data?.out_trade_no as string
    if (!out_trade_no) {
      throw this.buildError("Invalid payment", "no out_trade_no", "")
    }
    const result = await this._wepay.query({ out_trade_no: out_trade_no })
    if (result.status === 200) {
      let status: PaymentSessionStatus = 'pending'
      switch (result.data.trade_state) {
        case "SUCCESS":
          status = 'captured'
          break;
        case "REVOKED":
        case "NOTPAY":
        case 'REFUND':
        case 'CLOSED':
          status = 'canceled'
          break;
        case "USERPAYING":
          status = 'pending'
          break;
        case "PAYERROR":
          status = 'error'
          break;
        default:
          break;
      }
      return { status: status }
    } else {
      return { status: 'error' }
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const { data, amount: refund } = input
    const {
      openid,
      code_url,
      out_trade_no,
      transaction_id,
      amount,
    } = data as any
    const result = await this._wepay.refunds({
      out_refund_no: out_trade_no,
      out_trade_no: out_trade_no,
      amount: {
        refund: (refund as any).value * 100,
        ...amount
      },
      notify_url: this.getNotifyHookUrl(),
    } as any)
    const error = JSON.parse(result.error || '{}')
    if (error.message) {
      throw this.buildError(error.message, error.code, error.detail)
    } else {
      return {
        data: {
          ...data,
          amount: result.data?.amount,
          out_refund_no: result.data?.out_refund_no,
          refund_id: result.data?.refund_id
        }
      }
    }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const out_trade_no = input.data?.out_trade_no as string
    if (!out_trade_no) {
      return { ...input }
    }
    const result = await this._wepay.query({ out_trade_no: out_trade_no })
    const error = JSON.parse(result.error || '{}')
    if (error.message) {
      throw this.buildError(error.message, error.code, error.detail)
    } else {
      return result.data
    }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const {
      amount,
      currency_code,
      context: customerDetails,
      data
    } = input
    const id = data?.id
    return { data: { ...data } }
  }

  /**
   * {
    "id": "EV-2018022511223320873",
    "create_time": "2015-05-20T13:29:35+08:00",
    "resource_type": "encrypt-resource",
    "event_type": "TRANSACTION.SUCCESS",
    "summary": "支付成功",
    "resource": {
        "original_type": "transaction",
        "algorithm": "AEAD_AES_256_GCM",
        "ciphertext": "",
        "associated_data": "",
        "nonce": ""
    }
   }
   * @param payload 
   * @returns 
   */
  async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    const {
      data,
      rawData,
      headers
    } = payload
    const { resource } = data as any
    const deResouce = this._wepay.decipher_gcm(resource.ciphertext, resource.associated_data, resource.nonce, this._options.v3key) as any
    const { trade_state, transaction_id, out_trade_no, amount, attach, refund_id } = deResouce
    if (refund_id) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }
    if (!out_trade_no) {
      throw this.buildError("Invalid payment", "no out_trade_no", "")
    }
    const r = {
      transaction_id: transaction_id,
      session_id: this.tradeNoToSessionId(out_trade_no), // or attach
      out_trade_no: out_trade_no,
      amount: amount.total / 100, // 转回去
    }
    let action = PaymentActions.NOT_SUPPORTED
    switch (trade_state) {
      case "SUCCESS":
        action = PaymentActions.AUTHORIZED
        break;
      case "REVOKED":
      case "NOTPAY":
      case 'REFUND':
      case 'CLOSED':
        action = PaymentActions.CANCELED
        break;
      case "USERPAYING":
        action = PaymentActions.PENDING
        break;
      case "PAYERROR":
        action = PaymentActions.FAILED
        break;
      default:
        break;
    }
    return { action, data: r }
  }

  protected buildError(message: string, code: string, detail: any): Error {
    return new Error(
      `${message}. 
        "code:" ${code}
        "detail: " ${JSON.stringify(detail || '')}
      `.trim()
    )
  }

  public getNotifyHookUrl(): string {
    const id = 'weapp-payment' // should get id from medusa-config
    return `${this._options.domain}/hooks/payment/${this.getIdentifier()}_${id}`
  }

  abstract tradeNoToSessionId(out_trade_no: string): string
  abstract sessinIdToTradeNo(out_trade_no: string): string
  abstract createWepayTransaction(input: InitiatePaymentInput, params: Partial<WeParams>): Promise<any>
}

export default WeChatPaymentProviderBase