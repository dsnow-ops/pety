/**
 * uni-pay-co 统一支付云对象
 */

// 加载服务
const service = require('./service');
// 加载全局错误码
const { UniCloudError, isUniPayError, ERROR } = require('./common/error');
// 加载全局中间件
const middleware = require('./middleware/index');
// 加载uniId公共模块
const uniIdCommon = require('uni-id-common');

module.exports = {
  async _timing() {
    return require('./pety-recovery').run();
  },
	/**
	 * 中间件（请求前执行）
	 */
	async _before() {
		// Pety: official module is installed for offline integration only.
		// Do not expose its sample client-priced order API before the server-owned
		// catalog, merchant approval and business-order entry are connected.
		throw { errCode: 'pety-payment-not-configured', errMsg: '支付暂未开放。' };
		/* eslint-disable no-unreachable */
		const params = this.getParams();
		let clientInfo;
		if (params && params[0] && params[0].clientInfo) {
			clientInfo = params[0].clientInfo;
		} else {
			clientInfo = this.getClientInfo();
		}

		if (['zh-Hans', 'en'].indexOf(clientInfo.locale) === -1) {
			clientInfo.locale = 'zh-Hans';
		}

		// 挂载uni-id实例到this上，方便后续调用
		this.uniIdCommon = uniIdCommon.createInstance({
			clientInfo
		});

		// 国际化开始
		const i18n = uniCloud.initI18n({
			locale: clientInfo.locale || 'zh-Hans',
			fallbackLocale: 'zh-Hans',
			messages: require('./lang/index')
		})
		this.t = i18n.t.bind(i18n);
		// 国际化结束

		// 挂载中间件
		this.middleware = {}
		for (const mwName in middleware) {
			this.middleware[mwName] = middleware[mwName].bind(this);
		}
		const methodName = this.getMethodName();
		// 支付回调接口没有token，不需要获取用户信息
		if (methodName !== "payNotify") {
			// 尝试从token获取用户信息
			await this.middleware.auth(false);
			// 通用权限校验模块
			await this.middleware.accessControl();
		}
		// 设置全局获取userId公共函数（可在此云对象的任意其他函数内通过 this.getUserId() 获取当前登录用户的id
		this.getUserId = () => {
			return this.authInfo && this.authInfo.uid ? this.authInfo.uid : undefined;
		}
	},
	/**
	 * 中间件（请求后执行）
	 */
	_after(error, result) {
		if (error) {
			if (error.errCode) {
				let errCode = error.errCode
				if (!isUniPayError(errCode)) {
					// 如果不是插件预设的错误码，则原样返回错误信息
					return error;
				}
				return new UniCloudError({
					code: errCode,
					message: error.errMsg || this.t(errCode, error.errMsgValue),
				});
			}
			throw error
		}
		return result;
	},

	/**
	 * 创建支付订单
	 */
	async createOrder(data) {
		return require('./pety-entry').createOrder.call(this, data);
	},
	/**
	 * 接收支付异步通知
	 */
	async payNotify(data) {
		const httpInfo = this.getHttpInfo();
		const clientInfo = this.getClientInfo();
		const cloudInfo = this.getCloudInfo();
		return service.pay.paymentNotify({
			httpInfo,
			clientInfo,
			cloudInfo
		});
	},
	/**
	 * 查询支付状态
	 */
	async getOrder(data) {
		return require('./pety-entry').getOrder.call(this, data);
	},

	/**
	 * 发起退款
	 * 此api只有admin角色可以访问
	 */
	async refund(data) {
		let {
			out_trade_no, // 插件订单号
			out_refund_no, // 插件退款订单号
			refund_desc, // 退款描述
			refund_fee, // 退款金额
		} = data;

		res = await service.pay.refund({
			out_trade_no,
			out_refund_no,
			refund_desc,
			refund_fee: Number(refund_fee),
		});

		return res;
	},

	/**
	 * 查询退款（查询退款情况）
	 */
	async getRefund(data) {
		let {
			out_trade_no, // 插件订单号
		} = data;

		res = await service.pay.getRefund({
			out_trade_no,
		});

		return res;
	},

	/**
	 * 关闭订单（只有订单未支付时，才可以关闭，关闭后，用户即使在付款页面也无法付款）
	 */
	async closeOrder(data) {
		let {
			out_trade_no, // 插件订单号
		} = data;

		res = await service.pay.closeOrder({
			out_trade_no,
		});

		return res;
	},

	/**
	 * 根据code获取openid
	 */
	async getOpenid(data = {}) {
		let {
			provider,
			code,
			clientInfo, // 兼容云对象调用云对象模式
			config_directory,
			app_auth_token
		} = data;

		if (!clientInfo) clientInfo = this.getClientInfo();

		res = await service.pay.getOpenid({
			provider,
			code,
			clientInfo,
			config_directory,
			app_auth_token
		});

		return res;
	},

	/**
	 * 获取当前支持的支付方式
	 */
	async getPayProviderFromCloud() {
		return await service.pay.getPayProviderFromCloud();
	},

	/**
	 * 获取支付配置内的appid（主要用于获取获取微信公众号的appid，用以获取code）
	 */
	async getProviderAppId(data) {
		let {
			provider,
			provider_pay_type
		} = data;
		// 注意，千万不要直接把 conifg 内的所有内容返回给前端
		let conifg = service.pay.getConfig(data);
		try {
			return {
				errorCode: 0,
				appid: conifg[provider][provider_pay_type].appId,
			}
		} catch (err) {
			return {
				errorCode: 0,
				appid: null
			};
		}
	},

	/**
	 * 验证iosIap苹果内购支付凭据
	 */
	async verifyReceiptFromAppleiap(data) {
		let {
			out_trade_no,
			transaction_receipt,
			transaction_identifier,
		} = data;
		return await service.pay.verifyReceiptFromAppleiap({
			out_trade_no,
			transaction_receipt,
			transaction_identifier
		});
	},

	/**
	 * 接收微信小程序虚拟支付异步通知
	 */
	async wxpayVirtualNotify(data) {
		const httpInfo = this.getHttpInfo();
		const clientInfo = this.getClientInfo();
		const cloudInfo = this.getCloudInfo();
		return service.pay.wxpayVirtualNotify({
			httpInfo,
			clientInfo,
			cloudInfo
		});
	},
	/**
	 * 请求微信小程序虚拟支付API
	 */
	async requestWxpayVirtualApi(data) {
		const clientInfo = this.getClientInfo();
		if (clientInfo.source !== "function") {
			throw new Error("requestWxpayVirtualApi只能通过云端调云端的方式调用");
		}
		let res = await service.pay.requestWxpayVirtualApi(data);
		return res;
	},

}
