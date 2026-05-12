'use strict';
exports.main = async (event, context) => {
	// 🌟 第一步：把你刚才在 DeepSeek 申请的 API Key 填在下面！
	const API_KEY = 'sk-5918ddd7906448b59e0d1e41a60013b2'; 
	
	// 接收手机前端传过来的聊天记录上下文
	const { messages } = event;

	try {
		// 🌟 第二步：通过阿里云服务器，向 DeepSeek 发送极其稳定的 HTTPS 请求
		const res = await uniCloud.httpclient.request('https://api.deepseek.com/chat/completions', {
			method: 'POST',
			data: {
				model: 'deepseek-chat', // 使用 DeepSeek 极其聪明的对话大模型
				messages: messages,     // 包含之前所有聊天记录和系统提示词
				temperature: 0.7,       // 温度设定为 0.7，兼顾严谨兽医与温柔信箱的语气
                max_tokens: 1000
			},
			contentType: 'json',
			dataType: 'json',
			headers: {
				'Authorization': `Bearer ${API_KEY}`,
				'Content-Type': 'application/json'
			}
		});

		// 🌟 第三步：如果 AI 正常思考完毕，把结果送回手机
		if (res.data && res.data.choices && res.data.choices.length > 0) {
			return {
				code: 0,
				reply: res.data.choices[0].message.content
			}
		} else {
			return { code: -1, msg: '星空信号有些微弱，未获取到回应' }
		}
	} catch (e) {
		return { code: 500, msg: e.message }
	}
};