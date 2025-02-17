
## Medusa (>=2.5.0) Weapp Plugin

This plugin is created for Medusa to support Weapp (WeChat Mini Program) functionality.

See [Medusa Plugin](https://github.com/medusajs/medusa-starter-plugin).

Medusa introduced breaking changes to the payment provider interfaces in version 2.5.0.

As a result, this package requires Medusa >= 2.5.0.


***!!!WIP!!!***

## Authentication 

Currently, only customer authentication is supported. This is because Medusa requires an email to create a new user.

Weapp login is supported via phone number and 'wx.login'.

### Login Flow

See docs:

- [Login flow](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)
- [Phone number](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html)

Phone Number Authentication:

- Auth Route: POST /weapp_auth/mini/customer
  - Creates a provider_identity and customer with the provided phone number and openid/unionid if the customer does not already exist.
  - Logs in the customer if they already exist.
  - Note: This behavior is different from Medusa's built-in auth-email provider, which does not automatically create a customer.
- Options: See the example code below.

## Payment

Weapp payment is implemented using the [WeChat Pay V3 API](https://pay.weixin.qq.com/doc/v3/merchant/4012791870) with the [wechatpay-node-v3](https://github.com/klover2/wechatpay-node-v3-ts) library.

- Options: See the example code below.


## Usage

### Installation

Run the following command in your Medusa application to install the plugin:

```shell
npx medusa plugin:add @novrain/medusa-weapp-plugin
```

### Environment Variables

```
WECHAT_APP_ID
WECHAT_APP_SECRET
WECHAT_MCH_ID
STORE_DOMAIN
```

### Configuration

Edit the medusa-config.ts file in your Medusa application and update the options as follows, need public/private key files:

```ts
...
  plugins: [
    {
      resolve: "@novrain/medusa-weapp-plugin",
      options: {},
    }
  ],
  modules: [
    {
      resolve: "@medusajs/medusa/auth",
      options: {
        providers: [
          // default provider
          {
            resolve: "@medusajs/medusa/auth-emailpass",
            dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER],
            id: "emailpass",
          },
          {
            resolve: "@novrain/medusa-weapp-plugin/providers/weapp_auth",
            id: "weapp-auth",
            dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER],
            options: {
              appId: process.env.WECHAT_APP_ID || 'appid',
              appSecret: process.env.WECHAT_APP_SECRET || 'appSecret',
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "@novrain/medusa-weapp-plugin/providers/weapp_payment",
            id: "weapp-payment",
            dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER],
            options: {
              domain: process.env.STORE_DOMAIN,
              appid: process.env.WECHAT_APP_ID || 'appid',
              mchid: process.env.WECHAT_MCH_ID || 'mchid',
              publicKey: './assets/weapp/apiclient_cert.pem',
              privateKey: './assets/weapp/apiclient_key.pem',
              v3key: 'v3key',
            }
          }
        ]
      }
    }
...
```
