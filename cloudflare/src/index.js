/**
 * MedLLM Telegram Bot Worker
 * 
 * 这个文件实现了一个 Cloudflare Worker，用于：
 * 1. 接收 Telegram Bot 的 Webhook 请求
 * 2. 处理用户消息
 * 3. 直接与大模型 API 通信
 * 4. 返回响应给用户
 */

// 配置常量
const BOT_TOKEN = TELEGRAM_BOT_TOKEN; // 从环境变量中获取
const OPENAI_API_KEY = OPENAI_API_KEY; // 从环境变量中获取
const ANTHROPIC_API_KEY = ANTHROPIC_API_KEY; // 从环境变量中获取
const GOOGLE_API_KEY = GOOGLE_API_KEY; // 从环境变量中获取

// 模型配置
const MODELS = {
  openai: {
    model: "gpt-4-turbo-preview",
    temperature: 0.7,
    max_tokens: 1000,
    endpoint: "https://api.openai.com/v1/chat/completions"
  },
  anthropic: {
    model: "claude-3-opus-20240229",
    temperature: 0.7,
    max_tokens: 1000,
    endpoint: "https://api.anthropic.com/v1/messages"
  },
  google: {
    model: "gemini-pro",
    temperature: 0.7,
    max_tokens: 1000,
    endpoint: "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent"
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
    const text = update.message.text || '';
    const username = update.message.from.username || 'user';

    // 处理命令
    if (text.startsWith('/')) {
      return handleCommand(chatId, text, username);
    }

    // 处理普通消息
    return handleMessage(chatId, text, username);
  } catch (error) {
    console.error('处理请求时出错:', error);
    return new Response('发生错误: ' + error.message, { status: 500 });
  }
}

/**
 * 处理命令
 */
async function handleCommand(chatId, command, username) {
  const cmd = command.split(' ')[0].toLowerCase();
  
  switch (cmd) {
    case '/start':
      return sendMessage(chatId, '👋 欢迎使用 MedLLM Bot！\n\n我可以帮助你查询药物信息。直接向我发送问题即可。');
    
    case '/help':
      return sendMessage(chatId, '🔍 **使用帮助**\n\n' +
        '直接向我发送关于药物的问题，我会尽力回答。\n\n' +
        '**可用命令**：\n' +
        '/start - 开始使用\n' +
        '/help - 显示帮助信息\n' +
        '/model - 查看或切换模型');
    
    case '/model':
      // 解析参数
      const args = command.split(' ');
      if (args.length === 1) {
        // 显示当前模型
        return sendMessage(chatId, `当前使用的模型是：${DEFAULT_MODEL}`);
      } else if (args.length === 2) {
        const modelName = args[1].toLowerCase();
        if (['openai', 'anthropic', 'google'].includes(modelName)) {
          // 切换模型（在实际实现中，应该存储用户设置）
          return sendMessage(chatId, `已切换到模型：${modelName}`);
        } else {
          return sendMessage(chatId, '不支持的模型。可用选项: openai, anthropic, google');
        }
      }
      break;
    
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
    const response = await callLLM(DEFAULT_MODEL, text);
    
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
  
  try {
    let response;
    
    if (provider === 'openai') {
      // 调用 OpenAI API
      response = await fetch(modelConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: modelConfig.model,
          messages: [{ role: 'user', content: text }],
          temperature: modelConfig.temperature,
          max_tokens: modelConfig.max_tokens
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`OpenAI API 错误: ${data.error?.message || JSON.stringify(data)}`);
      }
      
      return data.choices[0].message.content;
    } 
    else if (provider === 'anthropic') {
      // 调用 Anthropic API
      response = await fetch(modelConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: modelConfig.model,
          messages: [{ role: 'user', content: text }],
          temperature: modelConfig.temperature,
          max_tokens: modelConfig.max_tokens
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Anthropic API 错误: ${data.error?.message || JSON.stringify(data)}`);
      }
      
      return data.content[0].text;
    } 
    else if (provider === 'google') {
      // 调用 Google API
      response = await fetch(`${modelConfig.endpoint}?key=${GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: text }] }],
          generationConfig: {
            temperature: modelConfig.temperature,
            maxOutputTokens: modelConfig.max_tokens
          }
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Google API 错误: ${data.error?.message || JSON.stringify(data)}`);
      }
      
      return data.candidates[0].content.parts[0].text;
    }
    
    throw new Error(`不支持的提供商: ${provider}`);
  } catch (error) {
    console.error(`调用 ${provider} API 时出错:`, error);
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