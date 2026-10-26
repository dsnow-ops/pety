const {
  verifyCaptcha
} = require('../../lib/utils/captcha')
const {
  EMAIL_SCENE
} = require('../../common/constants')
const {
  ERROR
} = require('../../common/error')
/**
 * 发送邮箱验证码，可用于登录、注册、绑定邮箱、修改密码等操作
 * @tutorial
 * @param {Object} params
 * @param {String} params.email     邮箱
 * @param {String} params.captcha   图形验证码
 * @param {String} params.scene     使用场景
 * @returns
 */
module.exports = async function (params = {}) {
  const schema = {
    email: 'email',
    captcha: 'string',
    scene: 'string'
  }
  this.middleware.validate(params, schema)

  const {
    email,
    captcha,
    scene
  } = params

  if (!(Object.values(EMAIL_SCENE).includes(scene))) {
    throw {
      errCode: ERROR.INVALID_PARAM
    }
  }

  await verifyCaptcha.call(this, {
    scene: 'send-email-code',
    captcha
  })

  // Pety RC: no mail transport is configured. Fail closed without issuing a code.
  return {
    errCode: 'uni-id-invalid-mail-template',
    errMsg: '邮箱验证码服务尚未配置。'
  }
}
