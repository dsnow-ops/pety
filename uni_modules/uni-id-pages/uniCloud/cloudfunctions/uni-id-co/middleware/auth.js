module.exports = async function () {
  if (this.authInfo) { // 多次执行auth时如果第一次成功后续不再执行
    return
  }
  const token = this.getUniversalUniIdToken()
  const payload = await this.uniIdCommon.checkToken(token, {autoRefresh:false})
  if (payload.errCode) {
    throw payload
  }
  const verified = await require('pety-auth').verifyRequest({uniIdToken:token,petySession:this.petySessionProof},this.getUniversalClientInfo())
  this.authInfo = { ...payload, role: verified.roles, permission: verified.permissions }
  if (payload.token) {
    this.response.newToken = {
      token: payload.token,
      tokenExpired: payload.tokenExpired
    }
  }
}
