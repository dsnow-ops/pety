const {
  setMobileVerifyCode
} = require('./verify-code')
const {
  getVerifyCode
} = require('../../common/utils')

/**
 * 发送短信
 * @param {object} param
 * @param {string} param.mobile       手机号
 * @param {object} param.code         可选，验证码
 * @param {object} param.scene        短信场景
 * @param {object} param.templateId   可选，短信模板id
 * @returns
 */
async function sendSmsCode ({
  mobile,
  code,
  scene,
  templateId
} = {}) {
  const requiredParams = [
    'name',
    'codeExpiresIn'
  ]
  const smsConfig = (this.config.service && this.config.service.sms) || {}
  for (let i = 0; i < requiredParams.length; i++) {
    const key = requiredParams[i]
    if (!smsConfig[key]) {
      throw new Error(`Missing config param: service.sms.${key}`)
    }
  }
  if (!code) {
    code = getVerifyCode()
  }
  let action
  switch (scene) {
    case 'login-by-sms':
      action = this.t('login')
      break
    default:
      action = this.t('verify-mobile')
      break
  }
  const sceneConfig = (smsConfig.scene || {})[scene] || {}
  if (!templateId) {
    templateId = sceneConfig.templateId
  }
  if (!templateId) {
    throw new Error('"templateId" is required')
  }
  const codeExpiresIn = sceneConfig.codeExpiresIn || smsConfig.codeExpiresIn
  // One persistent reservation covers every code purpose and all instances.
  // Neither a captcha nor a client supplied device id substitutes for a budget.
  await require('pety-auth/sms-budget').reserve.call(this, { mobile })
  await setMobileVerifyCode.call(this, {
    mobile,
    code,
    expiresIn: codeExpiresIn,
    scene
  })
  const sendResult = await uniCloud.sendSms({
    smsKey: smsConfig.smsKey,
    smsSecret: smsConfig.smsSecret,
    phone: mobile,
    templateId,
    data: {
      name: smsConfig.name,
      code,
      action,
      expMinute: '' + Math.round(codeExpiresIn / 60)
    }
  })
  // Acceptance is not delivery. An unknown response may already have sent;
  // retain the budget/code and do not automatically resend or report success.
  if (!sendResult || sendResult.errCode !== 0 || sendResult.error ||
    (sendResult.code !== undefined && sendResult.code !== 0 && sendResult.code !== '0')) {
    throw {
      errCode: 'pety-sms-response-unconfirmed',
      errMsg: '暂时无法确认短信发送结果，请稍后再试。'
    }
  }
  return {
    errCode: 0
  }
}

module.exports = {
  sendSmsCode
}
