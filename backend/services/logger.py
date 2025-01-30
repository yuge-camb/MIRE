import logging
import json
import os
from datetime import datetime

class Logger:
    def __init__(self, log_dir):
        self.log_dir = log_dir
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        self.logger = logging.getLogger(__name__)
    
    def log(self, data: dict):
        if data["type"] == "intervention_feedback":
            feedback_file = os.path.join(self.log_dir, "feedback.json")
            self._log_to_file(feedback_file, data)
    
    def _log_to_file(self, filepath: str, data: dict):
        try:
            # Read existing data if file exists
            if os.path.exists(filepath):
                with open(filepath, 'r') as f:
                    existing_data = json.load(f)
            else:
                existing_data = []
            
            # Append new data
            existing_data.append(data)
            
            # Write back to file
            with open(filepath, 'w') as f:
                json.dump(existing_data, f, indent=2)
                
        except Exception as e:
            self.logger.error(f"Error logging to file {filepath}: {str(e)}")