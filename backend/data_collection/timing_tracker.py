from dataclasses import dataclass, field
from datetime import datetime
import streamlit as st
from typing import Optional, List

@dataclass
class InterventionEvent:
    timestamp: datetime
    intervention_type: str
    trigger_phrase: str
    confidence: float
    segment_idx: int
    question_idx: int
    response: Optional[str] = None  # 'applied', 'dismissed', 'ignored'
    response_time: Optional[datetime] = None

@dataclass
class SegmentEdit:
    edit_start: datetime
    edit_end: datetime 
    previous_text: str
    new_text: str
    interrupted_during: bool = False
    related_intervention: Optional[InterventionEvent] = None

@dataclass
class SegmentPosition:
    timestamp: datetime
    index: int

@dataclass
class SegmentTiming:
    segment_id: str  # format: "q{q_idx}_s{orig_idx}"
    initial_start: datetime
    initial_end: Optional[datetime]
    initial_text: str
    position_history: List[SegmentPosition] = field(default_factory=list)
    edits: List[SegmentEdit] = field(default_factory=list)
    total_time: float = 0
    interruption_time: float = 0

    @property
    def current_index(self):
        return self.position_history[-1].index if self.position_history else None

class TimingTracker:
    def __init__(self):
        if 'segment_timings' not in st.session_state:
            st.session_state.segment_timings = {}
        if 'intervention_events' not in st.session_state:
            st.session_state.intervention_events = []
        if 'last_intervention_time' not in st.session_state:
            st.session_state.last_intervention_time = None

    def record_intervention(self, intervention, question_idx, segment_idx):
        """Record when intervention appears"""
        event = InterventionEvent(
            timestamp=datetime.now(),
            intervention_type=intervention.intervention_type,
            trigger_phrase=intervention.trigger_phrase,
            confidence=getattr(intervention, 'confidence', None),
            segment_idx=segment_idx,
            question_idx=question_idx
        )
        st.session_state.intervention_events.append(event)
        st.session_state.last_intervention_time = event.timestamp
        return event

    def record_intervention_response(self, event: InterventionEvent, response: str):
        """Record user's response to intervention"""
        event.response = response
        event.response_time = datetime.now()

    def start_segment_timer(self, question_idx, segment_idx, text=""):
        """Start timing a new segment or segment edit"""
        key = f"q{question_idx}_s{segment_idx}"
        
        if key not in st.session_state.segment_timings:
            # New segment
            timing = SegmentTiming(
                segment_id=key,
                initial_start=datetime.now(),
                initial_end=None,
                initial_text=text
            )
            timing.position_history.append(SegmentPosition(
                timestamp=datetime.now(),
                index=segment_idx
            ))
            st.session_state.segment_timings[key] = timing
        else:
            # Edit existing segment
            timing = st.session_state.segment_timings[key]
            current_intervention = self._get_current_intervention(question_idx, segment_idx)
            
            timing.edits.append(SegmentEdit(
                edit_start=datetime.now(),
                edit_end=None,
                previous_text=timing.initial_text if not timing.edits else timing.edits[-1].new_text,
                new_text=text,
                interrupted_during=bool(current_intervention),
                related_intervention=current_intervention
            ))

    def end_segment_timer(self, question_idx, segment_idx, final_text):
        """End timing for segment or edit"""
        key = f"q{question_idx}_s{segment_idx}"
        timing = st.session_state.segment_timings[key]
        
        if not timing.initial_end:
            # Initial writing complete
            timing.initial_end = datetime.now()
            timing.initial_text = final_text
        else:
            # Edit complete
            current_edit = timing.edits[-1]
            current_edit.edit_end = datetime.now()
            current_edit.new_text = final_text
            
        self.update_total_time(key)

    def get_segment_timing(self, question_idx: int, segment_idx: int = None):
        """Get timing data for a segment by current position or key"""
        # If only one parameter provided, treat it as key
        if segment_idx is None and isinstance(question_idx, str):
            return self.get_segment_by_key(question_idx)
            
        # Find timing object where current position matches
        for key, timing in st.session_state.segment_timings.items():
            if timing.position_history and timing.position_history[-1].index == segment_idx:
                if key.startswith(f"q{question_idx}"):
                    self.update_total_time(key)
                    return timing
        return None

    def get_segment_by_key(self, segment_key: str):
        """Get timing data using direct key (for internal use)"""
        if segment_key not in st.session_state.segment_timings:
            return None
        timing = st.session_state.segment_timings[segment_key]
        self.update_total_time(segment_key)
        return timing

    def update_total_time(self, segment_key):
        """Calculate total time including initial writing and edits"""
        timing = st.session_state.segment_timings[segment_key]
        
        # Initial writing time
        initial_time = (timing.initial_end - timing.initial_start).total_seconds() if timing.initial_end else 0
        
        # Sum of edit sessions
        edit_time = sum(
            (edit.edit_end - edit.edit_start).total_seconds() 
            for edit in timing.edits if edit.edit_end
        )
        
        timing.total_time = initial_time + edit_time

    def get_time_since_last_intervention(self):
        """Calculate time since last intervention"""
        if st.session_state.last_intervention_time:
            return (datetime.now() - st.session_state.last_intervention_time).total_seconds()
        return None

    def get_segment_intervention_history(self, question_idx, segment_idx):
        """Get complete history of interventions for a segment"""
        return [
            event for event in st.session_state.intervention_events
            if event.question_idx == question_idx and event.segment_idx == segment_idx
        ]

    def update_segment_position(self, question_idx, old_idx, new_idx):
        """Update segment position when segments shift"""
        old_key = f"q{question_idx}_s{old_idx}"
        if old_key in st.session_state.segment_timings:
            timing = st.session_state.segment_timings[old_key]
            timing.position_history.append(SegmentPosition(
                timestamp=datetime.now(),
                index=new_idx
            ))

    def update_intervention_positions(self, question_idx: int, deleted_idx: int):
        """Update intervention positions after segment deletion"""
        for event in st.session_state.intervention_events:
            if (event.question_idx == question_idx and 
                event.segment_idx > deleted_idx):
                event.segment_idx -= 1
                
    def get_current_edit_session(self, question_idx, segment_idx):
        """Get timing data for current edit session"""
        key = f"q{question_idx}_s{segment_idx}"
        if key not in st.session_state.segment_timings:
            return None
            
        timing = st.session_state.segment_timings[key]
        if not timing.edits:
            return None
            
        current_edit = timing.edits[-1]
        if not current_edit.edit_end:
            return (datetime.now() - current_edit.edit_start).total_seconds()
        return None

    def _get_current_intervention(self, question_idx, segment_idx):
        """Get current active intervention for segment"""
        return next(
            (event for event in reversed(st.session_state.intervention_events)
             if event.segment_idx == segment_idx
             and event.question_idx == question_idx
             and not event.response_time),
            None
        )