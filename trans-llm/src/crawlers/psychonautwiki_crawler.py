from typing import Dict, Any, List
from .base_crawler import BaseCrawler
from loguru import logger

class PsychonautWikiCrawler(BaseCrawler):
    """PsychonautWiki爬虫"""
    
    def __init__(self, config: Dict[str, Any]) -> None:
        """初始化PsychonautWiki爬虫

        Args:
            config: 配置对象
        """
        super().__init__(config)
        self.base_url = "https://psychonautwiki.org/w/api.php"
        
    def crawl(self) -> List[Dict[str, Any]]:
        """执行爬取操作

        Returns:
            爬取的数据列表
        """
        try:
            # 获取药物列表
            params = {
                "action": "query",
                "list": "categorymembers",
                "cmtitle": "Category:Substances",
                "cmlimit": 500,
                "format": "json"
            }
            
            response = self.get(self.base_url, params=params)
            if not response:
                return []
                
            # 提取药物页面ID
            page_ids = [str(member["pageid"]) for member in response["query"]["categorymembers"]]
            
            # 获取药物详细信息
            params = {
                "action": "query",
                "pageids": "|".join(page_ids),
                "prop": "extracts|info",
                "inprop": "url",
                "exintro": True,
                "explaintext": True,
                "format": "json"
            }
            
            response = self.get(self.base_url, params=params)
            if not response:
                return []
                
            # 格式化结果
            results = []
            for page_id, page in response["query"]["pages"].items():
                results.append({
                    "id": page_id,
                    "title": page["title"],
                    "url": page["fullurl"],
                    "content": page["extract"]
                })
                
            return results
            
        except Exception as e:
            logger.error(f"Error crawling PsychonautWiki: {str(e)}")
            return [] 