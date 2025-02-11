import {
  ModuleProvider,
  Modules
} from "@medusajs/framework/utils"
import WeChatAuthProviderMiniService from "./services/mini"

export default ModuleProvider(Modules.AUTH, {
  services: [WeChatAuthProviderMiniService],
})