import logging
import json
import os
from datetime import datetime
from typing import Dict, List, Any

class Logger:
    def __init__(self, log_dir):
        self.log_dir = log_dir
        os.makedirs(log_dir, exist_ok=True)
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        self.logger = logging.getLogger(__name__)

    def log(self, data: dict):
     # Handle all UUID-based logs
        if data["type"] in ["segment_timing", "segment_edit", "intervention_response"]:
            filename = f"{data['type']}s.json"  
            filepath = os.path.join(self.log_dir, filename)
            self._log_to_file_by_uuid(filepath, data)
        elif data["type"] == "intervention_feedback":
            feedback_file = os.path.join(self.log_dir, "feedback.json")
            self._log_to_file(feedback_file, data)

    def _log_to_file_by_uuid(self, filepath: str, data: dict):
        try:
            # Initialize or load existing data
            if os.path.exists(filepath):
                with open(filepath, 'r') as f:
                    segments_data = json.load(f)
            else:
                segments_data = {}
            
            # Get the UUID and add new timing data to its list
            uuid = data["uuid"]
            if uuid not in segments_data:
                segments_data[uuid] = []
            
            segments_data[uuid].append(data)
            
            # Write back to file
            with open(filepath, 'w') as f:
                json.dump(segments_data, f, indent=2)
                
        except Exception as e:
            self.logger.error(f"Error logging to file {filepath}: {str(e)}")

    def _log_to_file(self, filepath: str, data: dict):
        try:
            if os.path.exists(filepath):
                with open(filepath, 'r') as f:
                    existing_data = json.load(f)
            else:
                existing_data = []
            
            existing_data.append(data)
            
            with open(filepath, 'w') as f:
                json.dump(existing_data, f, indent=2)
                
        except Exception as e:
            self.logger.error(f"Error logging to file {filepath}: {str(e)}")