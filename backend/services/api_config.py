import os
from dotenv import load_dotenv
from dataclasses import dataclass
from typing import Dict, Optional

@dataclass
class ModelConfig:
    max_tokens: int
    temperature: float
    timeout: int
    retry_attempts: int = 3
    retry_delay: int = 1

class APIConfig:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        # load_dotenv()
        dotenv_path = os.path.join(os.path.dirname(__file__), '../../.env')  
        load_dotenv(dotenv_path)

        # API Configuration
        self.openai_api_key = os.getenv('LLM_API_KEY_Experiment')
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
            
        # System Configuration
        self.max_concurrent_requests = int(os.getenv('MAX_CONCURRENT_REQUESTS', '3'))
        self.max_retries = int(os.getenv('MAX_RETRIES', '3'))
        self.retry_delay = int(os.getenv('RETRY_DELAY', '1'))
        
        # Default Model Configurations
        self.model_configs = {
            'gpt-4': ModelConfig(
                max_tokens=500,
                temperature=0.3,
                timeout=30
            ),
            'gpt-3.5-turbo': ModelConfig(
                max_tokens=300,
                temperature=0.5,
                timeout=20
            )
        }
        
        # Request Type Priorities (lower = higher priority)
        self.priorities = {
            'chat': 1,      # Immediate response needed
            'intervention': 2,  # Important but can wait slightly
            'analysis': 3   # Background task
        }
        
        self._initialized = True