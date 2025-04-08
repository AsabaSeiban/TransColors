from typing import Dict, Any, List
import argparse
from loguru import logger
from config import Config
from vector_store import VectorStore
from crawlers.wikipedia_crawler import WikipediaCrawler
from crawlers.psychonautwiki_crawler import PsychonautWikiCrawler

def main() -> None:
    """主函数"""
    # 解析命令行参数
    parser = argparse.ArgumentParser(description="药物信息爬取系统")
    parser.add_argument("--config", type=str, default="config/config.yaml", help="配置文件路径")
    args = parser.parse_args()
    
    try:
        # 加载配置
        config = Config(args.config)
        
        # 初始化向量存储
        vector_store = VectorStore(config)
        
        # 初始化爬虫
        wikipedia_crawler = WikipediaCrawler(config)
        psychonautwiki_crawler = PsychonautWikiCrawler(config)
        
        # 爬取数据
        logger.info("开始爬取维基百科数据...")
        wikipedia_data = wikipedia_crawler.crawl()
        logger.info(f"爬取到{len(wikipedia_data)}条维基百科数据")
        
        logger.info("开始爬取PsychonautWiki数据...")
        psychonautwiki_data = psychonautwiki_crawler.crawl()
        logger.info(f"爬取到{len(psychonautwiki_data)}条PsychonautWiki数据")
        
        # 合并数据
        all_data = wikipedia_data + psychonautwiki_data
        
        # 保存到向量存储
        logger.info("开始保存数据到向量存储...")
        for data in all_data:
            vector_store.add_documents([{
                "id": data["id"],
                "text": data["content"],
                "metadata": {
                    "title": data["title"],
                    "url": data["url"],
                    "source": "wikipedia" if data in wikipedia_data else "psychonautwiki"
                }
            }])
        logger.info("数据保存完成")
        
    except Exception as e:
        logger.error(f"程序运行出错: {str(e)}")
        raise
        
if __name__ == "__main__":
    main()
