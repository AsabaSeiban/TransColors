from typing import Dict, Any, Optional, List
import requests
from loguru import logger
from config import Config
import json

class BaseCrawler:
    """爬虫基类"""
    
    def __init__(self, config: Config) -> None:
        """初始化爬虫

        Args:
            config: 配置对象
        """
        self.config = config
        self.session = requests.Session()
        
    def get(self, url: str, params: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None) -> Optional[Dict[str, Any]]:
        """发送GET请求

        Args:
            url: 请求URL
            params: 请求参数
            headers: 请求头

        Returns:
            响应数据，如果请求失败则返回None
        """
        try:
            response = self.session.get(url, params=params, headers=headers)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error making GET request to {url}: {str(e)}")
            return None
            
    def post(self, url: str, data: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None) -> Optional[Dict[str, Any]]:
        """发送POST请求

        Args:
            url: 请求URL
            data: 请求数据
            headers: 请求头

        Returns:
            响应数据，如果请求失败则返回None
        """
        try:
            response = self.session.post(url, json=data, headers=headers)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error making POST request to {url}: {str(e)}")
            return None
            
    def save_data(self, data: Dict[str, Any], filepath: str) -> bool:
        """保存数据到文件

        Args:
            data: 要保存的数据
            filepath: 文件路径

        Returns:
            是否保存成功
        """
        try:
            with open(filepath, "w") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            logger.error(f"Error saving data to {filepath}: {str(e)}")
            return False
            
    def load_data(self, filepath: str) -> Optional[Dict[str, Any]]:
        """从文件加载数据

        Args:
            filepath: 文件路径

        Returns:
            加载的数据，如果加载失败则返回None
        """
        try:
            with open(filepath, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading data from {filepath}: {str(e)}")
            return None
            
    def crawl(self) -> List[Dict[str, Any]]:
        """执行爬取操作

        Returns:
            爬取的数据列表
        """
        raise NotImplementedError("Subclasses must implement crawl()") 