#!/bin/bash

# 检查是否安装了 uv
if ! command -v uv &> /dev/null; then
    echo "正在安装 uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# 创建虚拟环境
echo "创建虚拟环境..."
uv venv

# 激活虚拟环境
source .venv/bin/activate

# 安装开发依赖
echo "安装开发依赖..."
uv pip install -e ".[dev]"

# 安装预提交钩子
echo "设置预提交钩子..."
pre-commit install

echo "开发环境设置完成！" 