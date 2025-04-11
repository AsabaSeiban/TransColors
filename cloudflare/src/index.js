/**
 * TransColors Telegram Bot Worker
 *
 * 这个文件实现了一个 Cloudflare Worker，用于：
 * 1. 接收 Telegram Bot 的 Webhook 请求
 * 2. 处理用户消息
 * 3. 直接与 OpenAI API 通信
 * 4. 返回响应给用户
 */

// 导出默认对象（Module Worker格式）
export default {
  // 处理fetch事件
  async fetch(request, env, ctx) {
    // 使用结构化JSON日志

    try {
      const response = await handleRequest(request, env);
      return response;
    } catch (error) {
      // 记录错误详情
      console.error({
        event: "服务器错误",
        error_message: error.message,
        error_stack: error.stack,
        url: request.url
      });

      return new Response(`服务器错误: ${error.message}`, { status: 500 });
    }
  }
};

// 添加时间戳
Object.defineProperty(globalThis, "START_TIME", { value: Date.now() });

// 使用量控制配置
const RATE_LIMIT = {
  REQUESTS_PER_USER: 30,     // 每个用户每天的请求上限
  REQUESTS_PER_MINUTE: 10,    // 每个用户每分钟的请求上限
  TOTAL_DAILY_LIMIT: 1000     // 所有用户每天的总请求上限
};

// KV键名前缀
const KV_KEYS = {
  USER_MODEL: "user_model:",         // 用户模型偏好前缀
  USER_DAILY_COUNT: "user_count:",   // 用户每日请求计数前缀
  USER_TIMESTAMPS: "user_ts:",       // 用户请求时间戳前缀
  TOTAL_REQUESTS: "total_requests",  // 总请求数
  LAST_RESET_DAY: "last_reset_day",  // 上次重置日期
  ADMIN_USERS: "admin_users"         // 管理员用户名列表
};

// 模型配置
const MODELS = {
  openai: {
    model: "gpt-4o",
    temperature: 0.5,
    max_tokens: 4096,
    endpoint: "https://api.openai.com/v1/chat/completions"
  },
  grok: {
    model: "grok-3-latest",
    temperature: 0.5,
    max_tokens: 2048,
    endpoint: "https://api.x.ai/v1/chat/completions" // Grok API端点
  }
};

// 默认配置
const DEFAULT_MODEL = "grok";

/**
 * 检查并更新用户使用量
 * 返回是否允许此次请求
 */
async function checkAndUpdateUsage(userId, username, env) {
  // 检查用户是否为管理员
  const adminUsersStr = await env.TRANS_COLORS_KV.get(KV_KEYS.ADMIN_USERS) || "[]";
  const adminUsers = JSON.parse(adminUsersStr);
  const isAdmin = username && adminUsers.includes(username);
  
  const now = new Date();
  const currentDay = now.getDate();
  
  // 获取上次重置日期
  let lastResetDay = parseInt(await env.TRANS_COLORS_KV.get(KV_KEYS.LAST_RESET_DAY) || currentDay);
  
  // 检查是否需要重置每日计数
  if (currentDay !== lastResetDay) {
    // 存储新的重置日期
    await env.TRANS_COLORS_KV.put(KV_KEYS.LAST_RESET_DAY, currentDay.toString());
    
    // 重置总请求数
    await env.TRANS_COLORS_KV.put(KV_KEYS.TOTAL_REQUESTS, "0");
    
    // 由于无法批量删除，重置计数器会在下面的代码中自动处理
    // 当用户计数为0时
    lastResetDay = currentDay;
  }
  
  // 获取总体每日请求数
  let totalDailyRequests = parseInt(await env.TRANS_COLORS_KV.get(KV_KEYS.TOTAL_REQUESTS) || "0");
  
  // 检查总体每日限制
  if (totalDailyRequests >= RATE_LIMIT.TOTAL_DAILY_LIMIT && !isAdmin) {
    return {
      allowed: false,
      reason: "机器人已达到今日总请求上限，请明天再试。"
    };
  }
  
  // 获取用户每日请求计数
  const userCountKey = KV_KEYS.USER_DAILY_COUNT + userId;
  let userRequestCount = parseInt(await env.TRANS_COLORS_KV.get(userCountKey) || "0");
  
  // 检查用户每日限制
  if (userRequestCount >= RATE_LIMIT.REQUESTS_PER_USER && !isAdmin) {
    return {
      allowed: false,
      reason: `您今日的请求次数（${RATE_LIMIT.REQUESTS_PER_USER}次）已用完，请明天再试。`
    };
  }
  
  // 获取用户请求时间戳
  const userTimestampsKey = KV_KEYS.USER_TIMESTAMPS + userId;
  let userTimestamps = JSON.parse(await env.TRANS_COLORS_KV.get(userTimestampsKey) || "[]");
  
  // 清理一分钟前的时间戳
  const oneMinuteAgo = now.getTime() - 60000;
  userTimestamps = userTimestamps.filter(timestamp => timestamp > oneMinuteAgo);
  
  // 检查每分钟频率限制 - 管理员不受此限制
  if (userTimestamps.length >= RATE_LIMIT.REQUESTS_PER_MINUTE && !isAdmin) {
    return {
      allowed: false,
      reason: `请求过于频繁，请稍后再试。每分钟最多 ${RATE_LIMIT.REQUESTS_PER_MINUTE} 次请求。`
    };
  }
  
  // 更新计数和时间戳
  userRequestCount++;
  userTimestamps.push(now.getTime());
  totalDailyRequests++;
  
  // 保存更新后的数据
  await env.TRANS_COLORS_KV.put(userCountKey, userRequestCount.toString());
  await env.TRANS_COLORS_KV.put(userTimestampsKey, JSON.stringify(userTimestamps));
  await env.TRANS_COLORS_KV.put(KV_KEYS.TOTAL_REQUESTS, totalDailyRequests.toString());
  
  return {
    allowed: true,
    isAdmin: isAdmin
  };
}

// 在handleRequest中添加结构化日志
async function handleRequest(request, env) {
  // 获取环境变量
  const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
  const API_KEY = env.OPENAI_API_KEY;

  // 只处理 POST 请求
  if (request.method !== 'POST') {
    return new Response('请使用 POST 请求', { status: 405 });
  }

  try {
    // 解析 Telegram 更新
    const update = await request.json();

    // 仅处理消息
    if (!update.message) {
      return new Response('OK');
    }

    const chatId = update.message.chat.id;
    const chatType = update.message.chat.type;
    const userId = update.message.from.id;
    const text = update.message.text || '';
    const username = update.message.from.username || 'user';

    // 检查是否为非文本消息（图片、视频、文件等）
    if (!text && (update.message.photo || update.message.video || 
        update.message.document || update.message.audio || 
        update.message.voice || update.message.sticker || 
        update.message.animation)) {
      
      // 在群聊中，只有@机器人或回复机器人的非文本消息才回复
      if (chatType !== 'private') {
        // 获取机器人信息
        const botInfo = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`).then(r => r.json());
        const botUsername = botInfo.result.username;
        
        // 检查是否@了机器人或回复机器人的消息
        const isReply = update.message.reply_to_message && 
                        update.message.reply_to_message.from && 
                        update.message.reply_to_message.from.username === botUsername;
                        
        // 如果既没有@机器人，也不是回复机器人的消息，则静默忽略
        if (!isReply) {
          return new Response('OK');
        }
      }
      
      return sendMessage(chatId, "抱歉，我目前只能处理文字消息。请发送文字内容与我交流。", env);
    }

    console.log({
      event: "机器人接受消息",
      chat_id: chatId,
      chat_type: chatType,
      user_id: userId,
      username: username,
      message_text: text.substring(0, 100) // 截断过长消息
    });

    // 处理命令 (命令不受频率限制)
    if (text.startsWith('/')) {
      return handleCommand(chatId, text, username, userId, env);
    }

    // 在群聊中，只响应@机器人的消息
    if (chatType !== 'private') {
      // 获取机器人信息
      const botInfo = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`).then(r => r.json());
      const botUsername = botInfo.result.username;

      // 检查消息是否@了机器人
      const isTagged = text.includes('@' + botUsername);
      const isReply = update.message.reply_to_message &&
                      update.message.reply_to_message.from &&
                      update.message.reply_to_message.from.username === botUsername;

      // 如果既没有@机器人，也不是回复机器人的消息，则忽略
      if (!isTagged && !isReply) {
        return new Response('OK');
      }

      // 移除@部分
      let cleanText = text;
      if (isTagged) {
        cleanText = text.replace('@' + botUsername, '').trim();
      }

      // 检查使用量限制
      const usageCheck = await checkAndUpdateUsage(userId, username, env);
      if (!usageCheck.allowed) {
        return sendMessage(chatId, usageCheck.reason, env);
      }

      // 处理普通消息
      return handleMessage(chatId, cleanText || text, username, userId, env);
    }

    // 检查使用量限制
    const usageCheck = await checkAndUpdateUsage(userId, username, env);
    if (!usageCheck.allowed) {
      return sendMessage(chatId, usageCheck.reason, env);
    }

    // 私聊消息，直接处理
    return handleMessage(chatId, text, username, userId, env);
  } catch (error) {
    console.error('处理请求时出错:', error);
    return new Response('发生错误: ' + error.message, { status: 500 });
  }
}

/**
 * 处理命令
 */
async function handleCommand(chatId, command, username, userId, env) {
  const cmd = command.split(' ')[0].toLowerCase();
  const args = command.split(' ').slice(1);

  switch (cmd) {
    case '/start':
      return sendMessage(chatId, '👋 欢迎使用TransColors LLM！\n\n我是为追求自我定义与突破既定命运的人设计的助手。提供医疗知识、心理支持、身份探索、生活适应、移民信息、职业发展和法律权益等多方面支持。所有信息仅供参考，重要决策请咨询专业人士。\n\n输入 /help 可查看完整使用指南。', env);

    case '/help':
      // 检查是否为管理员
      const adminUsersStr = await env.TRANS_COLORS_KV.get(KV_KEYS.ADMIN_USERS) || "[]";
      const adminUsers = JSON.parse(adminUsersStr);
      const isAdmin = username && adminUsers.includes(username);

      let helpText = '🌈 TransColors LLM 使用指南\n\n可用命令:\n/start - 开始对话\n/help - 显示此帮助信息\n/quota - 查看您的使用额度\n/model - 选择使用的模型\n\n您可以直接向我提问，我会尽力提供准确、有用的信息。我的设计初衷是为更广泛的身份认同与生活方式提供支持与资源。\n\n使用限制:\n- 每人每日最多30次请求\n- 每分钟最多10次请求\n\n备注：所有信息仅供参考，重要决策请咨询专业人士。';

      if (isAdmin) {
        helpText += '\n\n🔑 您是管理员，不受请求配额限制。\n管理员命令：\n/admin_add [用户名] - 添加新管理员';
      }

      try {
        const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: helpText
            // 不使用parse_mode参数
          })
        });

        return new Response('OK');
      } catch (error) {
        return new Response('发送帮助消息失败', { status: 500 });
      }

    case '/quota':
      const userCountKey = KV_KEYS.USER_DAILY_COUNT + userId;
      const dailyCount = parseInt(await env.TRANS_COLORS_KV.get(userCountKey) || "0");
      const remainingCount = RATE_LIMIT.REQUESTS_PER_USER - dailyCount;
      
      // 获取总使用次数
      const totalRequests = parseInt(await env.TRANS_COLORS_KV.get(KV_KEYS.TOTAL_REQUESTS) || "0");
      
      // 检查是否为管理员
      const quotaAdminUsersStr = await env.TRANS_COLORS_KV.get(KV_KEYS.ADMIN_USERS) || "[]";
      const quotaAdminUsers = JSON.parse(quotaAdminUsersStr);
      const isQuotaAdmin = username && quotaAdminUsers.includes(username);
      
      // 使用纯文本，避免Markdown解析问题
      let quotaText = `📊 使用额度统计\n\n今日已使用: ${dailyCount}次\n剩余额度: ${isQuotaAdmin ? "无限制" : remainingCount + "次"}\n\n每分钟最多可发送${RATE_LIMIT.REQUESTS_PER_MINUTE}次请求。\n\n机器人今日总请求数: ${totalRequests}次\n机器人每日总上限: ${RATE_LIMIT.TOTAL_DAILY_LIMIT}次`;
      
      if (isQuotaAdmin) {
        quotaText += '\n\n🔑 您是管理员，不受配额限制。';
      }

      try {
        const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: quotaText
          })
        });

        return new Response('OK');
      } catch (error) {
        return new Response('发送配额消息失败', { status: 500 });
      }

    case '/model':
      const modelArg = command.split(' ')[1]?.toLowerCase();

      // 如果提供了模型参数且它是有效的模型
      if (modelArg && MODELS[modelArg]) {
        await env.TRANS_COLORS_KV.put(KV_KEYS.USER_MODEL + userId, modelArg);
        return sendMessage(chatId, `✅ 您的默认模型已设置为: ${modelArg}\n\n当前模型参数:\n- temperature(越低越理性, 越高越感性): ${MODELS[modelArg].temperature}\n- 最大令牌数: ${MODELS[modelArg].max_tokens}`, env);
      }

      // 否则，显示可用模型列表
      const userModel = await env.TRANS_COLORS_KV.get(KV_KEYS.USER_MODEL + userId);
      const modelsList = Object.keys(MODELS).map(key => {
        const isDefault = (key === DEFAULT_MODEL) ? ' (默认)' : '';
        const isUserPref = (key === userModel) ? ' (✓ 您的选择)' : '';
        return `- ${key}${isDefault}${isUserPref}`;
      }).join('\n');

      return sendMessage(chatId, `🤖 *可用模型*\n\n${modelsList}\n\n要选择模型，请使用命令: /model [模型名称]\n例如: /model grok`, env);

    case '/admin_add':
      // 检查是否为管理员
      const adminAddStr = await env.TRANS_COLORS_KV.get(KV_KEYS.ADMIN_USERS) || "[]";
      const adminList = JSON.parse(adminAddStr);
      const isAddAdmin = username && adminList.includes(username);

      if (!isAddAdmin) {
        return sendMessage(chatId, "⛔ 您没有权限执行此命令。只有管理员可以添加其他管理员。", env);
      }

      if (!args[0]) {
        return sendMessage(chatId, "❗ 请指定要添加的管理员用户名。\n用法: /admin_add [用户名]", env);
      }

      const newAdmin = args[0].replace('@', ''); // 移除可能的@前缀

      // 检查是否已经是管理员
      if (adminList.includes(newAdmin)) {
        return sendMessage(chatId, `⚠️ @${newAdmin} 已经是管理员。`, env);
      }

      // 添加到管理员列表
      adminList.push(newAdmin);
      await env.TRANS_COLORS_KV.put(KV_KEYS.ADMIN_USERS, JSON.stringify(adminList));

      return sendMessage(chatId, `✅ 已将 @${newAdmin} 添加为管理员。`, env);

    default:
      return new Response('OK');
  }
}

/**
 * 处理普通消息
 */
async function handleMessage(chatId, text, username, userId, env) {
  try {
    // 发送"正在输入"状态
    await sendChatAction(chatId, 'typing', env);

    // 获取用户的模型偏好，如果没有则使用默认模型
    const userModel = await env.TRANS_COLORS_KV.get(KV_KEYS.USER_MODEL + userId);
    const modelProvider = userModel || DEFAULT_MODEL;

    // 记录开始处理消息
    console.log({
      event: "机器人请求大模型API",
      chat_id: chatId,
      user_id: userId,
      username: username,
      text_length: text.length,
      model: modelProvider,
      message_text: text.substring(0, 100), // 截断过长消息
      timestamp: new Date().toISOString()
    });

    // 调用 LLM 生成回复
    const response = await callLLM(modelProvider, text, env);

    // 发送回复
    return sendMessage(chatId, response, env);
  } catch (error) {
    // 记录详细的错误信息
    console.error({
      event: "机器人请求大模型API报错",
      chat_id: chatId,
      user_id: userId,
      username: username,
      message_text: text.substring(0, 100), // 截断过长消息
      error_message: error.message,
      error_type: error.name,
      error_stack: error.stack,
      timestamp: new Date().toISOString()
    });

    return sendMessage(chatId, '抱歉，处理您的请求时发生错误，请稍后再试。', env);
  }
}

/**
 * 调用大语言模型 API
 */
async function callLLM(provider, text, env) {
  const modelConfig = MODELS[provider];

  // 系统提示词
  const systemPrompt = `你是TransColors助手，为所有追求自我定义、挑战既定命运的人提供支持和信息。你涵盖以下领域：

1. 医学知识：药物作用机制、副作用、替代治疗选择
2. 心理健康：应对变化、自我接纳、寻找支持系统
3. 身体自主：各类医疗和非医疗身体改变选项及其影响
4. 社会适应：在各种社会环境中的自我表达和融入策略
5. 地理流动：不同国家和地区的政策、移民路径、文化差异
6. 职业发展：职业转换、远程工作、非传统生活方式支持
7. 法律权益：各地相关法律知识、权益保障、应对歧视

重要指导：当检测到用户询问比卡鲁胺、色普龙、雌二醇、螺内酯、醋酸环丙孕酮等和HRT有关的激素药物时，应理解这通常与HRT(激素替代疗法)相关。提供更具体的用药指导、剂量参考、效果时间线和风险管理，而不仅是一般的药物信息。主动提供这些药物在跨性别医疗中的特殊应用，同时说明这仅供参考，具体用药需遵医嘱。

回答时保持开放、尊重和专业，不预设任何人的身份或选择。承认每个人的经历和需求都是独特的，避免给出一刀切的建议。提供信息时注明这些仅供参考，关键决策应结合个人情况和专业咨询。支持每个人打破常规、寻找自己道路的勇气。`;

  try {
    // 根据提供商选择API密钥
    let apiKey;
    if (provider === 'grok') {
      apiKey = env.XAI_API_KEY;
    } else {
      apiKey = env.OPENAI_API_KEY;
    }

    // 调用 API
    const response = await fetch(modelConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: modelConfig.temperature,
        max_tokens: modelConfig.max_tokens,
        stream: false
      })
    });

    // 解析响应，不记录原始响应和解析过程
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`API 错误: ${data.error?.message || JSON.stringify(data)}`);
    }

    // 检查响应数据格式
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error(`无效的API响应格式: ${JSON.stringify(data)}`);
    }

    if (!data.choices[0].message || !data.choices[0].message.content) {
      throw new Error(`响应中缺少消息内容: ${JSON.stringify(data)}`);
    }

    // API调用结果记录
    console.log({
      event: "机器人接收到大模型API响应",
      provider: provider,
      response_length: data.choices[0].message.content.length,
      tokens_used: data.usage?.total_tokens || 0,
      model: modelConfig.model,
      message_text: text.substring(0, 100), // 截断过长消息
      timestamp: new Date().toISOString()
    });

    return data.choices[0].message.content;

  } catch (error) {
    // API错误记录
    console.error({
      event: "大模型API响应报错",
      provider: provider,
      error_message: error.message,
      error_type: error.name,
      error_stack: error.stack,
      model: modelConfig.model,
      message_text: text.substring(0, 100), // 截断过长消息
      endpoint: modelConfig.endpoint,
      timestamp: new Date().toISOString()
    });

    throw error;
  }
}

/**
 * 发送消息到 Telegram
 */
async function sendMessage(chatId, text, env) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('发送Telegram消息失败:', error);
    }

    return new Response('OK');
  } catch (error) {
    console.error('发送Telegram消息时出错:', error.message);
    return new Response('发送消息失败: ' + error.message, { status: 500 });
  }
}

/**
 * 发送聊天动作到 Telegram（例如"正在输入"）
 */
async function sendChatAction(chatId, action, env) {
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendChatAction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        action: action
      })
    });
  } catch (error) {
    // 不记录chatAction错误，这不是关键操作
  }
} 