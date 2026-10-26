/**
 * 刷新token
 * @tutorial https://uniapp.dcloud.net.cn/uniCloud/uni-id-pages.html#refresh-token
 */
module.exports = async function () {
  await this.middleware.auth()
  const sessions=require('pety-auth/sessions');if(sessions.enabled())await sessions.service().renew(this.authInfo.uid,this.petySessionProof)
  const refreshTokenRes = await this.uniIdCommon.refreshToken({
    token: this.getUniversalUniIdToken()
  })
  const {
    errCode,
    token,
    tokenExpired
  } = refreshTokenRes
  if (errCode) {
    throw refreshTokenRes
  }
  if(sessions.enabled())await sessions.assertCurrent(this.authInfo.uid,this.petySessionProof)
  return {
    errCode: 0,
    [sessions.enabled()?'petyRefreshedToken':'newToken']: {
      token,
      tokenExpired
    }
  }
}
