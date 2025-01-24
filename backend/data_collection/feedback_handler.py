from dataclasses import dataclass, asdict
import datetime
import json
import streamlit as st
import logging
import os
from data_collection.feedback_logger import FeedbackLogger  
from data_collection.timing_tracker import TimingTracker

@dataclass
class InterruptionData:
    timestamp: datetime.datetime
    intervention_type: str
    confidence_level: float
    trigger_phrase: str
    requirement_text: str
    time_on_question: float
    time_since_last: float
    question_idx: int  
    segment_idx: int
    original_segment_idx: int
    current_session_time: float  # Time spent in current edit session
    total_segment_time: float    # Total time across all positions

@dataclass
class FeedbackResponse:
    interruption_data: InterruptionData
    feedback_time: datetime.datetime
    activity_type: str
    timing_rating: int
    focus_impact: int
    experience_feedback: str
    user_response: str

class FeedbackHandler:
    def __init__(self, timing_tracker: TimingTracker = None):
        if 'pending_feedbacks' not in st.session_state:
            st.session_state.pending_feedbacks = []
        if 'feedback_responses' not in st.session_state:
            st.session_state.feedback_responses = []
        if 'feedback_state' not in st.session_state:
            st.session_state.feedback_state = {}
        
        self.timing_tracker = timing_tracker
        user_id = st.session_state.get('user_id', 'default')
        self.logger = FeedbackLogger(
            f"feedback_log_{user_id}.json",
            timing_tracker=self.timing_tracker  
        )

    def record_interruption(self, intervention, requirement_text, time_on_question):
        """Record interruption data when it occurs"""
        time_since_last = self.timing_tracker.get_time_since_last_intervention() if self.timing_tracker else 0
        
        # Get timing data for the segment
        segment_key = f"q{intervention.question_idx}_s{intervention.segment_idx}"
        segment_timing = self.timing_tracker.get_segment_timing(segment_key)
        
        # Get current session and total time
        current_session_time = (
            segment_timing.edits[-1].edit_end - segment_timing.edits[-1].edit_start
        ).total_seconds() if segment_timing and segment_timing.edits else 0
        
        total_segment_time = segment_timing.total_time if segment_timing else 0
        
        # Get original position from position history
        original_idx = (
            segment_timing.position_history[0].index 
            if segment_timing and segment_timing.position_history 
            else intervention.segment_idx
        )
        
        return InterruptionData(
            timestamp=datetime.datetime.now(),
            intervention_type=intervention.intervention_type,
            confidence_level=0.7 if intervention.options else 0.5,
            trigger_phrase=intervention.trigger_phrase,
            requirement_text=requirement_text,
            time_on_question=time_on_question,
            time_since_last=time_since_last,
            question_idx=intervention.question_idx,  
            segment_idx=intervention.segment_idx,
            original_segment_idx=original_idx,
            current_session_time=current_session_time,
            total_segment_time=total_segment_time
        )

    def show_feedback_popup(self, interruption_data, response_type):
        base_key = f"feedback_{hash(interruption_data.timestamp.isoformat())}"
        
        # Load saved state if exists
        state_key = f"{base_key}_state"
        if state_key not in st.session_state.feedback_state:
            st.session_state.feedback_state[state_key] = {
                'activity': '',
                'timing_rating': 3,
                'focus_impact': 3,
                'experience_feedback': ''
            }
        
        saved_state = st.session_state.feedback_state[state_key]
        
        with st.popover("Provide Feedback"):
            with st.form(key=f"{base_key}_form"):
                st.write("Please provide feedback about this interruption:")
                
                activity = st.radio(
                    "What were you doing when interrupted?",
                    ["Typing new requirement", 
                    "Reviewing previous requirements",
                    "Editing/modifying requirements",
                    "Thinking/pausing",
                    "Other"],
                    key=f"{base_key}_activity",
                    index=['Writing', 'Reviewing', 'Thinking', 'Other'].index(saved_state['activity']) if saved_state['activity'] else 0
                )
                
                timing_rating = st.slider(
                    "How appropriate was the timing? (1=Very Poor, 5=Very Good)",
                    1, 5, saved_state['timing_rating'],
                    key=f"{base_key}_timing_slider"
                )
                
                focus_impact = st.slider(
                    "How did this interruption affect your focus? (1=Very Negatively, 5=Very Positively)",
                    1, 5, saved_state['focus_impact'],
                    key=f"{base_key}_focus_slider"
                )
                
                experience_feedback = st.text_area(
                    "How has this positively/negatively affected your experience?",
                    value=saved_state['experience_feedback'],
                    height=100,
                    key=f"{base_key}_experience_text"
                )
                
                submitted = st.form_submit_button("Submit")
                
        if submitted:
            # Save current state
            st.session_state.feedback_state[state_key] = {
                'activity': activity,
                'timing_rating': timing_rating,
                'focus_impact': focus_impact,
                'experience_feedback': experience_feedback
            }
            
            # Create feedback response
            response = FeedbackResponse(
                interruption_data=interruption_data,
                feedback_time=datetime.datetime.now(),
                activity_type=activity,
                timing_rating=timing_rating,
                focus_impact=focus_impact,
                experience_feedback=experience_feedback,
                user_response=response_type
            )
            
            # Convert to dict and handle datetime serialization
            response_dict = asdict(response)
            # Convert datetime objects to ISO format strings
            response_dict['feedback_time'] = response_dict['feedback_time'].isoformat()
            response_dict['interruption_data']['timestamp'] = response_dict['interruption_data']['timestamp'].isoformat()
            
            # Log feedback with serializable data
            feedback_data = {
                'timestamp': datetime.datetime.now().isoformat(),
                'response': response_dict
            }
                        
            self.logger.log(
                feedback_data,
                interruption_data.question_idx,
                interruption_data.segment_idx
            )
            
            # Store in session state
            st.session_state.feedback_responses.append(response)
            return True
                    
        return False