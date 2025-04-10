import re
from typing import List, Dict, Any, Optional
from loguru import logger


class TextProcessor:
    """文本处理器"""

    def __init__(self, min_length: int = 100, max_length: int = 10000):
        """初始化文本处理器

        Args:
            min_length: 最小文本长度
            max_length: 最大文本长度
        """
        self.min_length = min_length
        self.max_length = max_length

    def clean_text(self, text: str) -> str:
        """清理文本"""
        if not text:
            return ""

        # 移除多余空白
        text = re.sub(r"\s+", " ", text)

        # 移除特殊字符
        text = re.sub(r"[^\w\s.,;:!?()-]", "", text)

        return text.strip()

    def split_text(
        self, text: str, chunk_size: int = 1000, overlap: int = 200
    ) -> List[str]:
        """将文本分割成小块

        Args:
            text: 要分割的文本
            chunk_size: 每块的大小
            overlap: 重叠的大小

        Returns:
            分割后的文本块列表
        """
        if not text:
            return []

        # 清理文本
        text = self.clean_text(text)

        # 按句子分割
        sentences = re.split(r"(?<=[.!?])\s+", text)
        current_chunk: List[str] = []
        chunks = []
        current_length = 0

        for sentence in sentences:
            sentence_length = len(sentence)

            if current_length + sentence_length > chunk_size and current_chunk:
                # 当前块已满，保存并创建新块
                chunk_text = " ".join(current_chunk)
                if len(chunk_text) >= self.min_length:
                    chunks.append(chunk_text)
                current_chunk = []
                current_length = 0

            current_chunk.append(sentence)
            current_length += sentence_length

        # 处理最后一块
        if current_chunk:
            chunk_text = " ".join(current_chunk)
            if len(chunk_text) >= self.min_length:
                chunks.append(chunk_text)

        return chunks

    def process_document(self, document: Dict[str, Any]) -> Dict[str, Any]:
        """处理文档

        Args:
            document: 要处理的文档

        Returns:
            处理后的文档
        """
        try:
            # 提取文本内容
            content = document.get("content", "")
            if not content:
                logger.warning(
                    f"Empty content in document: {document.get('title', 'Unknown')}"
                )
                return document

            # 检查文本长度
            if len(content) < self.min_length:
                logger.warning(f"Content too short: {len(content)} chars")
                return document

            if len(content) > self.max_length:
                logger.warning(
                    f"Content too long ({len(content)} chars), truncating to {self.max_length}"
                )
                content = content[: self.max_length]

            # 更新文档
            document["content"] = content
            return document

        except Exception as e:
            logger.error(f"Error processing document: {str(e)}")
            return document

    def filter_chunks(self, chunks: List[Dict]) -> List[Dict]:
        """过滤文本块"""
        return [
            chunk
            for chunk in chunks
            if self.min_length <= len(chunk["content"]) <= self.max_length
        ]
