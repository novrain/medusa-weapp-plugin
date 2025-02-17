import {
  ModuleProvider,
  Modules
} from "@medusajs/framework/utils"
import WeChatPaymentProviderMiniService from "./services/mini"
import WeChatPaymentProviderNativeService from "./services/native"

export default ModuleProvider(Modules.PAYMENT, {
  services: [
    WeChatPaymentProviderMiniService,
    WeChatPaymentProviderNativeService
  ],
})