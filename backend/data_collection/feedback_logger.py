import json
import os
import time
from datetime import datetime

class FeedbackLogger:
    def __init__(self, log_file='feedback_log.json', timing_tracker=None):
        self.log_file = log_file
        self.timing_tracker = timing_tracker
        if not os.path.exists(self.log_file):
            with open(self.log_file, 'w') as f:
                json.dump([], f)

    def log(self, data, question_idx, segment_idx):
        """Log feedback with timing metadata"""
        # Find segment by current position
        segment_timing = self.timing_tracker.get_segment_timing(question_idx, segment_idx)
        
        if self.timing_tracker and segment_timing:
            # Get timing data
            intervention_history = self.timing_tracker.get_segment_intervention_history(
                question_idx, segment_idx
            )
            time_since_last = self.timing_tracker.get_time_since_last_intervention()
            current_session = self.timing_tracker.get_current_edit_session(
                question_idx, segment_idx
            )

            # Add timing metadata
            timing_metadata = {
                'segment_info': {
                    'original_index': segment_timing.position_history[0].index,
                    'current_index': segment_timing.current_index,
                    'position_history': [
                        {
                            'timestamp': pos.timestamp.isoformat(),
                            'index': pos.index
                        }
                        for pos in segment_timing.position_history
                    ]
                },
                'timing': {
                    'total_time': segment_timing.total_time,
                    'initial_writing_time': (
                        (segment_timing.initial_end - segment_timing.initial_start).total_seconds()
                        if segment_timing.initial_end
                        else None
                    ),
                    'current_session_time': current_session,
                    'edit_sessions': [
                        {
                            'start': edit.edit_start.isoformat(),
                            'end': edit.edit_end.isoformat() if edit.edit_end else None,
                            'duration': (edit.edit_end - edit.edit_start).total_seconds() if edit.edit_end else None,
                            'interrupted_during': edit.interrupted_during
                        }
                        for edit in segment_timing.edits
                    ]
                },
                'intervention_data': {
                    'time_since_last': time_since_last or 0,
                    'intervention_count': len(intervention_history),
                    'intervention_history': [
                        {
                            'timestamp': event.timestamp.isoformat(),
                            'type': event.intervention_type,
                            'response': event.response,
                            'response_time': event.response_time.isoformat() if event.response_time else None
                        }
                        for event in intervention_history
                    ]
                }
            }

            data['timing_metadata'] = timing_metadata

        with open(self.log_file, 'r+') as f:
            logs = json.load(f)
            logs.append(data)
            f.seek(0)
            json.dump(logs, f, indent=2)
            f.truncate()