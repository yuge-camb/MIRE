from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime
from dataclasses import dataclass, field

class InterventionType(BaseModel):
    intervention_type: str
    trigger_phrase: Optional[str] = None
    options: Optional[List[str]] = None
    suggestion: Optional[str] = None

class Intervention(BaseModel):
    id: str  
    uuid: str  # Segment UUID this belongs to
    type: str  # 'ambiguity' or 'consistency'
    display_idx: Dict[str, int] = {
        "question": 0,
        "segment": 0
    }
    trigger_phrase: Optional[str] = None
    confidence: Optional[float] = None
    options: Optional[List[str]] = None
    previous_segment: Optional[Dict] = None  # For consistency interventions
    current_segment: Optional[str] = None
    suggestions: Optional[List[str]] = []
    response: Optional[str] = None
    response_time: Optional[float] = None

class InterventionResponse(BaseModel):
    response: str

class AnalysisRequest(BaseModel):
    uuid: str
    text: str
    question_idx: int
    segment_idx: int
    timestamp: Optional[float] = None
    all_segments: Dict = None
    status: str = "pending"
    result: Optional[Dict] = None