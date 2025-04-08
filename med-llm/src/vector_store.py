import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any, Optional, Union
import yaml
from loguru import logger
import os
from config import Config
import numpy as np


class VectorStore:
    """向量存储类"""
    
    def __init__(self, config: Config) -> None:
        """初始化向量存储

        Args:
            config: 配置对象
        """
        self.config = config
        self.vectors: Dict[str, np.ndarray] = {}
        self.metadata: Dict[str, Dict[str, Any]] = {}
        
        # 初始化向量数据库
        self.client = chromadb.PersistentClient(
            path=self.config.get("vector_db.persist_directory"),
            settings=Settings(anonymized_telemetry=False),
        )

        # 获取或创建集合
        self.collection = self.client.get_or_create_collection(
            name=self.config.get("vector_db.collection_name")
        )

        # 初始化嵌入模型
        self.embedding_model = SentenceTransformer(
            self.config.get("vector_db.embedding_model")
        )

    def add(self, id: str, vector: np.ndarray, metadata: Optional[Dict[str, Any]] = None) -> None:
        """添加向量

        Args:
            id: 向量ID
            vector: 向量数据
            metadata: 元数据
        """
        self.vectors[id] = vector
        self.metadata[id] = metadata or {}
        
    def get(self, id: str) -> Optional[Dict[str, Any]]:
        """获取向量

        Args:
            id: 向量ID

        Returns:
            向量数据，如果不存在则返回None
        """
        if id not in self.vectors:
            return None
        return {
            "vector": self.vectors[id],
            "metadata": self.metadata[id]
        }
        
    def search(self, query_vector: np.ndarray, top_k: int = 5) -> List[Dict[str, Any]]:
        """搜索相似向量

        Args:
            query_vector: 查询向量
            top_k: 返回结果数量

        Returns:
            相似向量列表
        """
        if not self.vectors:
            return []
            
        # 计算余弦相似度
        similarities = {}
        for id, vector in self.vectors.items():
            similarity = np.dot(query_vector, vector) / (np.linalg.norm(query_vector) * np.linalg.norm(vector))
            similarities[id] = similarity
            
        # 获取top_k结果
        top_ids = sorted(similarities.items(), key=lambda x: x[1], reverse=True)[:top_k]
        
        return [{
            "id": id,
            "similarity": similarity,
            "vector": self.vectors[id],
            "metadata": self.metadata[id]
        } for id, similarity in top_ids]
        
    def delete(self, id: str) -> bool:
        """删除向量

        Args:
            id: 向量ID

        Returns:
            是否删除成功
        """
        if id not in self.vectors:
            return False
            
        del self.vectors[id]
        del self.metadata[id]
        return True
        
    def clear(self) -> None:
        """清空所有向量"""
        self.vectors.clear()
        self.metadata.clear()

    def add_documents(self, documents: List[Dict]):
        """添加文档到向量数据库"""
        try:
            # 准备数据
            ids = []
            texts = []
            metadatas = []

            for i, doc in enumerate(documents):
                # 生成唯一ID
                doc_id = f"doc_{i}_{hash(doc.get('content', ''))}"
                ids.append(doc_id)

                # 获取文本内容
                text = doc.get("content", "")
                texts.append(text)

                # 保存元数据
                metadata = {
                    "source": doc.get("source", "unknown"),
                    "source_url": doc.get("source_url", ""),
                    "field": doc.get("field", "unknown"),
                    "chunk_index": doc.get("chunk_index", 0),
                }
                metadatas.append(metadata)

            # 生成嵌入
            embeddings = self.embedding_model.encode(texts).tolist()

            # 添加到集合
            self.collection.add(
                embeddings=embeddings, documents=texts, metadatas=metadatas, ids=ids
            )

            logger.info(
                f"Successfully added {len(documents)} documents to vector store"
            )

        except Exception as e:
            logger.error(f"Error adding documents to vector store: {str(e)}")

    def delete_documents(self, ids: List[str]):
        """删除文档"""
        try:
            self.collection.delete(ids=ids)
            logger.info(f"Successfully deleted {len(ids)} documents")
        except Exception as e:
            logger.error(f"Error deleting documents: {str(e)}")

    def get_collection_stats(self) -> Dict:
        """获取集合统计信息"""
        try:
            count = self.collection.count()
            return {"document_count": count, "collection_name": self.collection.name}
        except Exception as e:
            logger.error(f"Error getting collection stats: {str(e)}")
            return {}
