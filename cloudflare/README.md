# MedLLM Telegram Bot Worker

运行在 Cloudflare Worker 上的 Telegram 机器人，可以直接与大模型 API（OpenAI、Anthropic、Google）通信，并提供药物信息查询服务。

## 优势

1. **无服务器架构**：不需要维护服务器，直接在 Cloudflare Workers 上运行
2. **全球低延迟**：Cloudflare 的全球边缘网络确保最佳性能
3. **自动防护**：自带 DDoS 防护和其他安全功能
4. **无网络限制**：可以直接访问各大模型 API

## 前置需求

- Cloudflare 账户
- Telegram Bot API 令牌（从 [@BotFather](https://t.me/BotFather) 获取）
- 大模型 API 密钥（OpenAI, Anthropic, Google）
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) 工具

## 安装与配置

1. 安装 Wrangler CLI：

```bash
npm install -g wrangler
```

2. 登录 Cloudflare 账户：

```bash
wrangler login
```

3. 在 Cloudflare 控制台中添加密钥：

在 Cloudflare Workers 控制台 → 设置 → 环境变量中添加：
   - `TELEGRAM_BOT_TOKEN`：您的 Telegram Bot 令牌
   - `OPENAI_API_KEY`：OpenAI API 密钥
   - `ANTHROPIC_API_KEY`：Anthropic API 密钥
   - `GOOGLE_API_KEY`：Google API 密钥

4. 编辑 `wrangler.toml` 文件：
   - 如果需要自定义域名，取消相关注释并修改
   - 如果需要数据存储，设置 KV 绑定

## 部署

1. 部署到开发环境（用于测试）：

```bash
cd cloudflare
wrangler dev
```

2. 部署到生产环境：

```bash
cd cloudflare
wrangler deploy
```

3. 设置 Telegram Webhook：

部署完成后，您需要设置 Telegram 的 Webhook URL，将其指向您的 Worker 地址：

```bash
curl "https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook?url=<YOUR_WORKER_URL>"
```

## 使用

一旦部署完成并设置好 Webhook，您的 Telegram Bot 就可以接收消息并回复了。用户可以通过以下命令与机器人交互：

- `/start` - 开始使用机器人
- `/help` - 显示帮助信息
- `/model` - 查看或切换当前使用的模型

用户也可以直接发送问题，机器人会使用配置的 LLM 生成回答。

## 高级配置

### 用户数据存储

如果需要存储用户对话历史或设置，可以：

1. 在 Cloudflare 控制台创建 KV 命名空间
2. 在 `wrangler.toml` 中配置 KV 绑定
3. 修改代码实现数据存储和检索

### 自定义域名

1. 在 Cloudflare 添加您的域名
2. 配置 DNS 记录
3. 在 `wrangler.toml` 中设置自定义域名路由

## 故障排除

- 检查 Cloudflare Worker 日志
- 确保所有 API 密钥都有效且正确配置
- 使用 `wrangler dev` 在本地测试 Worker

## 参考文档

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Telegram Bot API 文档](https://core.telegram.org/bots/api)
- [OpenAI API 文档](https://platform.openai.com/docs/api-reference)
- [Anthropic API 文档](https://docs.anthropic.com/claude/reference)
- [Google AI API 文档](https://ai.google.dev/docs) 