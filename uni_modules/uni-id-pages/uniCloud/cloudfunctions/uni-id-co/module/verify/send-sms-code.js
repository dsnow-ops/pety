const {
  sendSmsCode
} = require('../../lib/utils/sms')
const {
  verifyCaptcha
} = require('../../lib/utils/captcha')
const {
  SMS_SCENE
} = require('../../common/constants')
const {
  ERROR
} = require('../../common/error')

/**
 * 发送短信验证码
 * @tutorial https://uniapp.dcloud.net.cn/uniCloud/uni-id-pages.html#send-sms-code
 * @param {Object} params
 * @param {String} params.mobile    手机号
 * @param {String} params.captcha   图形验证码
 * @param {String} params.scene     短信验证码使用场景
 * @returns
 */
module.exports = async function (params = {}) {
  const schema = {
    mobile: 'mobile',
    captcha: 'string',
    scene: 'string'
  }
  this.middleware.validate(params, schema)
  const {
    mobile,
    captcha,
    scene
  } = params
  if (!(Object.values(SMS_SCENE).includes(scene))) {
    throw {
      errCode: ERROR.INVALID_PARAM
    }
  }
  await verifyCaptcha.call(this, {
    scene: 'send-sms-code',
    captcha
  })

  // Pety RC hardening: missing delivery configuration must never mint a code.
  const {
    templateId
  } = (this.config.service &&
    this.config.service.sms &&
    this.config.service.sms.scene &&
    this.config.service.sms.scene[scene]) || {}
  if (!templateId || !templateId.replace(/[^0-9a-zA-Z]/g, '')) {
    return {
      errCode: 'uni-id-invalid-sms-template-id',
      errMsg: '短信服务尚未配置，请稍后再试。'
    }
  }

  return sendSmsCode.call(this, {
    mobile,
    scene
  })
}
