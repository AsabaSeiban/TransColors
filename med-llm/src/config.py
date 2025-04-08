import os
from typing import Dict, Any, Optional
import yaml
from loguru import logger
from dotenv import load_dotenv


class Config:
    """配置管理类"""
    
    def __init__(self, config_path: Optional[str] = None) -> None:
        """初始化配置

        Args:
            config_path: 配置文件路径，如果为None则使用默认路径
        """
        # 加载环境变量
        load_dotenv()

        # 加载配置文件
        self.config_path = config_path or os.path.join(
            os.path.dirname(__file__), "../../config/config.yaml"
        )
        self.config: Dict[str, Any] = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        """加载配置文件

        Returns:
            配置字典
        """
        try:
            with open(self.config_path, "r") as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            logger.warning(f"Config file not found at {self.config_path}, using default config")
            return {
                "apis": {
                    "openai": {
                        "model": "gpt-3.5-turbo",
                        "api_key": os.getenv("OPENAI_API_KEY")
                    }
                }
            }

    def _replace_env_vars(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """替换环境变量"""
        if isinstance(config, dict):
            return {k: self._replace_env_vars(v) for k, v in config.items()}
        elif (
            isinstance(config, str) and config.startswith("${") and config.endswith("}")
        ):
            env_var = config[2:-1]
            return os.getenv(env_var, "")
        elif isinstance(config, list):
            return [self._replace_env_vars(item) for item in config]
        return config

    def get(self, key: str, default: Any = None) -> Any:
        """获取配置值

        Args:
            key: 配置键
            default: 默认值

        Returns:
            配置值
        """
        return self.config.get(key, default)

    def __getitem__(self, key: str) -> Any:
        """获取配置值

        Args:
            key: 配置键

        Returns:
            配置值
        """
        return self.config[key]

    def __contains__(self, key: str) -> bool:
        """检查配置键是否存在

        Args:
            key: 配置键

        Returns:
            是否存在
        """
        return key in self.config

    def reload(self):
        """重新加载配置"""
        self.config = self._load_config()
