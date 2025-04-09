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
    - 大模型 API：OpenAI
    - ChromaDB 向量数据库
    - 数据源：多种

| 数据源名称          | 类型         | 内容涵盖                   | 语言  | 是否可爬取    | 是否适合用于RAG | 备注                  |
|----------------|------------|------------------------|-----|----------|-----------|---------------------|
| Wikipedia      | 通用百科       | 药物通识、适应症、副作用、药代、历史     | 多语言 | ✅ 合法     | ✅         | 结构标准，适合基础介绍         |
| MTF.wiki       | 跨性别医学/社区知识 | HRT 药物、剂量、作用、副作用、使用经验  | 中文  | ✅ 合法     | ✅         | 聚焦跨性别领域，实用性强，有社区视角  |
| Drugs.com      | 权威临床信息     | 药物信息、说明书、相互作用、病人用法、副作用 | 英语  | ✅（需限频）   | ✅         | 药物助手核心数据源，适合问答      |
| PubChem        | 化学与药理      | 化学结构、性质、代谢、靶点机制        | 英语  | ✅ API 支持 | ✅         | 适合做药物机制和结构相似性分析     |
| PsychonautWiki | 精神活性特化     | 专注精神领域的药物              | 英语  | ✅ 合法     | ✅         | 针对灰色药物方向深入，有主观描述    |
| PubMed / MeSH  | 医学研究文献     | 药物研究文献、临床试验、指南、病例      | 英语  | ✅ API 支持 | ✅（摘要级别）   | 学术型内容提取适用，可补充深度问题   |
| OpenFDA API    | 实时监管数据     | 药品召回、不良反应报告、批准情况       | 英语  | ✅ 官方API  | ✅（增强信息）   | 可做安全警告功能模块          |
| MedlinePlus    | 患者友好信息     | 通俗药物介绍、健康科普指南          | 英语  | ✅        | ✅（用于语言优化） | 可提升输出的易读性与自然语言风格    |
| 国家药监局 (NMPA)   | 中文权威信息     | 国内药品注册、审批、说明书          | 中文  | ✅ 网页结构化  | ✅         | 适合本地化中文助手及法规合规查询    |
| 药智网            | 国内药品数据     | 中国药品价格、成分、审批信息         | 中文  | ✅（结构化）   | ✅         | 用于本地价格、注册信息等商业性数据分析 |

- **Star Memorial**
    - Unity 2022.3 LTS
    - C#
    - Cloudflare Pages

## 系统架构

```
用户 <-> Telegram Bot <-> Cloudflare Worker <-> OpenAI API
                            ^
                            |
                   查询    |
                            v
                       向量数据库 <-- 爬虫收集的药物数据
```

## 许可证

本项目采用 [LICENSE](LICENSE) 许可证。
