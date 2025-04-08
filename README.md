# TransColors

一个关于反抗既定命运的人给世界带来色彩的项目

## 项目结构

项目分为三个主要部分：

1. **Med LLM (药物大模型)**
   - 基于爬虫和知识库的药物信息查询系统
   - 使用向量数据库进行高效检索
   - 通过 Telegram 机器人提供服务
   - 直接在 Cloudflare Workers 上运行 Telegram Bot 和大模型 API 调用
   - 数据采集和处理通过本地 Python 代码完成

2. **Star Memorial (星空纪念碑)**
   - 基于 Unity 的互动式纪念碑
   - 展示故事和贡献
   - 通过 Cloudflare Pages 部署

3. **Community (社区)**
   - 通过 Telegram 群组提供讨论空间

## 目录结构

```
TransColors/
├── med-llm/                # 药物大模型相关代码 (Python)
│   ├── config/             # 配置文件
│   │   └── config.yaml     # 爬虫和向量数据库配置
│   ├── data/               # 数据存储
│   ├── src/                # 源代码
│   │   ├── crawlers/       # 爬虫模块
│   │   ├── config.py       # 配置管理
│   │   ├── crawler_main.py # 爬虫主程序
│   │   ├── text_processor.py # 文本处理器
│   │   └── vector_store.py # 向量存储
│   ├── pyproject.toml      # 项目配置和依赖
│   └── setup_dev.sh        # 开发环境搭建脚本
├── cloudflare/             # Cloudflare 相关代码 (JavaScript)
│   ├── src/                # 源代码
│   │   └── index.js        # Telegram Bot 和 LLM API 实现
│   ├── wrangler.toml       # Worker 配置文件
│   └── README.md           # 部署说明
├── star-memorial/          # 星空纪念碑 Unity 项目
└── docs/                   # 项目文档
```

## 技术栈

- **Med LLM**
  - Python 3.10+ (爬虫和数据处理)
  - JavaScript (Telegram Bot 和 API 调用)
  - Cloudflare Workers
  - 大模型 API：OpenAI、Anthropic、Google
  - ChromaDB 向量数据库
  - 数据源：维基百科、PsychonautWiki 等

- **Star Memorial**
  - Unity 2022.3 LTS
  - C#
  - Cloudflare Pages

## 系统架构

```
用户 <-> Telegram Bot <-> Cloudflare Worker <-> 大模型 API (OpenAI/Anthropic/Google)
                            ^
                            |
                   查询    |
                            v
                       向量数据库 <-- 爬虫收集的药物数据
```

## 许可证

本项目采用 [LICENSE](LICENSE) 许可证。
