/**
 * MedLLM Telegram Bot Worker
 * 
 * 这个文件实现了一个 Cloudflare Worker，用于：
 * 1. 接收 Telegram Bot 的 Webhook 请求
 * 2. 处理用户消息
 * 3. 直接与 OpenAI API 通信
 * 4. 返回响应给用户
 */

// 配置常量
const BOT_TOKEN = TELEGRAM_BOT_TOKEN; // 从环境变量中获取
const API_KEY = OPENAI_API_KEY; // 从环境变量中获取

// 使用量控制配置
const RATE_LIMIT = {
  REQUESTS_PER_USER: 30,     // 每个用户每天的请求上限
  REQUESTS_PER_MINUTE: 10,    // 每个用户每分钟的请求上限
  TOTAL_DAILY_LIMIT: 1000     // 所有用户每天的总请求上限
};

// 内存缓存（实际应用中应使用KV存储）
const userRequestCounts = {};       // 用户每日请求计数
const userRequestTimestamps = {};   // 用户请求时间戳记录
let totalDailyRequests = 0;         // 总体每日请求计数
let lastResetDay = new Date().getDate(); // 上次重置计数的日期

// 模型配置
const MODELS = {
  openai: {
    model: "gpt-4o",
    temperature: 0.7,
    max_tokens: 1000,
    endpoint: "https://api.openai.com/v1/chat/completions"
  }
};

// 默认配置
const DEFAULT_MODEL = "openai";
const MAX_CONTEXT_LENGTH = 4000;

// 处理传入的请求
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

/**
 * 检查并更新用户使用量
 * 返回是否允许此次请求
 */
async function checkAndUpdateUsage(userId) {
  const now = new Date();
  const currentDay = now.getDate();
  
  // 检查是否需要重置每日计数
  if (currentDay !== lastResetDay) {
    // 重置所有计数器
    Object.keys(userRequestCounts).forEach(key => userRequestCounts[key] = 0);
    totalDailyRequests = 0;
    lastResetDay = currentDay;
  }
  
  // 初始化用户的计数和时间戳数组
  if (!userRequestCounts[userId]) {
    userRequestCounts[userId] = 0;
  }
  if (!userRequestTimestamps[userId]) {
    userRequestTimestamps[userId] = [];
  }
  
  // 检查总体每日限制
  if (totalDailyRequests >= RATE_LIMIT.TOTAL_DAILY_LIMIT) {
    return {
      allowed: false,
      reason: "机器人已达到今日总请求上限，请明天再试。"
    };
  }
  
  // 检查用户每日限制
  if (userRequestCounts[userId] >= RATE_LIMIT.REQUESTS_PER_USER) {
    return {
      allowed: false,
      reason: `您今日的请求次数（${RATE_LIMIT.REQUESTS_PER_USER}次）已用完，请明天再试。`
    };
  }
  
  // 清理一分钟前的时间戳
  const oneMinuteAgo = now.getTime() - 60000;
  userRequestTimestamps[userId] = userRequestTimestamps[userId].filter(
    timestamp => timestamp > oneMinuteAgo
  );
  
  // 检查每分钟频率限制
  if (userRequestTimestamps[userId].length >= RATE_LIMIT.REQUESTS_PER_MINUTE) {
    return {
      allowed: false,
      reason: `请求过于频繁，请稍后再试。每分钟最多 ${RATE_LIMIT.REQUESTS_PER_MINUTE} 次请求。`
    };
  }
  
  // 更新计数和时间戳
  userRequestCounts[userId]++;
  userRequestTimestamps[userId].push(now.getTime());
  totalDailyRequests++;
  
  return {
    allowed: true
  };
}

/**
 * 处理 HTTP 请求
 */
async function handleRequest(request) {
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
    
    // 处理命令 (命令不受频率限制)
    if (text.startsWith('/')) {
      return handleCommand(chatId, text, username, userId);
    }
    
    // 在群聊中，只响应@机器人的消息
    if (chatType !== 'private') {
      // 获取机器人信息
      const botInfo = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`).then(r => r.json());
      const botUsername = botInfo.result.username;
      
      // 检查消息是否@了机器人
      if (!text.includes('@' + botUsername) && !update.message.reply_to_message?.from?.username === botUsername) {
        // 未@机器人，不回复
        return new Response('OK');
      }
      
      // 移除@部分
      const cleanText = text.replace('@' + botUsername, '').trim();
      
      // 检查使用量限制
      const usageCheck = await checkAndUpdateUsage(userId);
      if (!usageCheck.allowed) {
        return sendMessage(chatId, usageCheck.reason);
      }
      
      // 处理普通消息
      return handleMessage(chatId, cleanText || text, username);
    }
    
    // 检查使用量限制
    const usageCheck = await checkAndUpdateUsage(userId);
    if (!usageCheck.allowed) {
      return sendMessage(chatId, usageCheck.reason);
    }
    
    // 私聊消息，直接处理
    return handleMessage(chatId, text, username);
  } catch (error) {
    console.error('处理请求时出错:', error);
    return new Response('发生错误: ' + error.message, { status: 500 });
  }
}

/**
 * 处理命令
 */
async function handleCommand(chatId, command, username, userId) {
  const cmd = command.split(' ')[0].toLowerCase();
  
  switch (cmd) {
    case '/start':
      return sendMessage(chatId, '👋 欢迎使用TransColors LLM！\n\n我是为追求自我定义与突破既定命运的人设计的助手。提供医疗知识、心理支持、身份探索、生活适应、移民信息、职业发展和法律权益等多方面支持。所有信息仅供参考，重要决策请咨询专业人士。');
    
    case '/help':
      return sendMessage(chatId, '🔍 **使用指南**\n\n' +
        '我能回答关于医疗（包括HRT详情）、心理健康、社会适应、移民、职业和法律等方面的问题。\n\n' +
        '**命令**：\n' +
        '/start - 查看介绍\n' +
        '/help - 显示此帮助\n' + 
        '/quota - 查询您的使用限额\n\n' +
        '私聊直接发问，群聊请@我。所有信息仅供参考，重要决策请咨询专业人士。');
    
    case '/quota':
      // 获取用户的使用情况
      const userCount = userRequestCounts[userId] || 0;
      const userMinuteCount = (userRequestTimestamps[userId] || []).length;
      
      // 计算剩余配额
      const dailyRemaining = RATE_LIMIT.REQUESTS_PER_USER - userCount;
      const minuteRemaining = RATE_LIMIT.REQUESTS_PER_MINUTE - userMinuteCount;
      
      // 获取系统总体使用情况
      const totalUsed = totalDailyRequests || 0;
      const systemRemaining = RATE_LIMIT.TOTAL_DAILY_LIMIT - totalUsed;
      
      return sendMessage(chatId, `📊 **您的使用情况**\n\n` +
        `• 今日已使用: ${userCount}/${RATE_LIMIT.REQUESTS_PER_USER} 次\n` +
        `• 当前分钟已使用: ${userMinuteCount}/${RATE_LIMIT.REQUESTS_PER_MINUTE} 次\n` +
        `• 您今日剩余: ${dailyRemaining} 次\n\n` +
        `📈 **系统总体情况**\n` +
        `• 今日总计使用: ${totalUsed}/${RATE_LIMIT.TOTAL_DAILY_LIMIT} 次\n` +
        `• 系统剩余配额: ${systemRemaining} 次\n\n` +
        `⏰ 所有配额将在北京时间00:00自动重置`
      );
    
    default:
      return sendMessage(chatId, '未知命令。使用 /help 查看可用命令。');
  }
}

/**
 * 处理普通消息
 */
async function handleMessage(chatId, text, username) {
  try {
    // 发送"正在输入"状态
    await sendChatAction(chatId, 'typing');
    
    // 调用 LLM 生成回复
    const response = await callLLM('openai', text);
    
    // 发送回复
    return sendMessage(chatId, response);
  } catch (error) {
    console.error('处理消息时出错:', error);
    return sendMessage(chatId, '抱歉，处理您的请求时发生错误，请稍后再试。');
  }
}

/**
 * 调用大语言模型 API
 */
async function callLLM(provider, text) {
  const modelConfig = MODELS[provider];
  
  // 系统提示词
  const systemPrompt = `你是 TransColors 助手，为所有追求自我定义、挑战既定命运的人提供支持和信息。你涵盖以下领域：

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
    // 调用 OpenAI API
    const response = await fetch(modelConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: modelConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: modelConfig.temperature,
        max_tokens: modelConfig.max_tokens
      })
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`OpenAI API 错误: ${data.error?.message || JSON.stringify(data)}`);
    }
    
    return data.choices[0].message.content;
    
  } catch (error) {
    console.error(`调用 OpenAI API 时出错:`, error);
    throw error;
  }
}

/**
 * 发送消息到 Telegram
 */
async function sendMessage(chatId, text) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
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
      console.error('发送 Telegram 消息失败:', error);
    }
    
    return new Response('OK');
  } catch (error) {
    console.error('发送 Telegram 消息时出错:', error);
    return new Response('发送消息失败: ' + error.message, { status: 500 });
  }
}

/**
 * 发送聊天动作到 Telegram（例如"正在输入"）
 */
async function sendChatAction(chatId, action) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
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
    console.error('发送聊天动作时出错:', error);
  }
} 