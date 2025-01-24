import json
import os

class AnswerLogger:
    def __init__(self, log_file='answer_log.json'):
        self.log_file = log_file
        # Initialize the log file
        if not os.path.exists(self.log_file):
            with open(self.log_file, 'w') as f:
                json.dump([], f)

    def log(self, data):
        with open(self.log_file, 'r+') as f:
            logs = json.load(f)
            logs.append(data)
            f.seek(0)
            json.dump(logs, f, indent=2)