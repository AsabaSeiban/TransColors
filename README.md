# TransColors

一个关于反抗既定命运的人给世界带来色彩的项目的代码仓库

## 项目结构

项目分为三个主要部分：

1. **Med LLM (药物大模型)**
   - 基于爬虫和知识库的药物信息查询系统
   - 支持多种大语言模型（OpenAI、Anthropic、Google）
   - 使用向量数据库进行高效检索
   - 通过 Telegram 机器人提供服务
   - 部署在 Cloudflare Workers 上

2. **Star Memorial (星空纪念碑)**
   - 基于 Unity 的互动式纪念碑
   - 展示故事和贡献
   - 通过 Cloudflare Pages 部署

3. **Community (社区)**
   - 通过 Telegram 群组提供讨论空间

## 目录结构

```
TransColors/
├── med-llm/                # 药物大模型相关代码
│   ├── config/             # 配置文件
│   ├── data/               # 数据存储
│   ├── src/                # 源代码
│   │   ├── crawlers/       # 爬虫模块
│   │   ├── config.py       # 配置管理
│   │   ├── crawler_main.py # 爬虫主程序
│   │   ├── model_manager.py # 模型管理器
│   │   ├── text_processor.py # 文本处理器
│   │   └── vector_store.py # 向量存储
│   ├── pyproject.toml      # 项目配置和依赖
│   └── setup_dev.sh        # 开发环境搭建脚本
├── star-memorial/          # 星空纪念碑 Unity 项目
├── cloudflare/             # Cloudflare 相关配置
└── docs/                   # 项目文档
```

## 技术栈

- **Med LLM**
  - Python 3.10+
  - Node.js (Telegram Bot)
  - 大模型 API：OpenAI、Anthropic、Google
  - ChromaDB 向量数据库
  - 数据源：维基百科、PsychonautWiki 等

- **Star Memorial**
  - Unity 2022.3 LTS
  - C#
  - Cloudflare Pages

## 许可证

本项目采用 [LICENSE](LICENSE) 许可证。
