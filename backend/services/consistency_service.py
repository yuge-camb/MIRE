from typing import List, Dict
from dataclasses import dataclass
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import torch.nn.functional as F
import logging
import asyncio
import random

@dataclass
class ContradictionResult:
    # detected: bool
    intervention_triggered: bool  # Whether to show intervention
    contradictions: List[Dict] = None  # Now includes UUIDs

class ConsistencyService:
    def __init__(self):
        self.model = AutoModelForSequenceClassification.from_pretrained('cross-encoder/nli-deberta-v3-small')
        self.tokenizer = AutoTokenizer.from_pretrained('cross-encoder/nli-deberta-v3-small', use_fast=False)
        self.contradiction_threshold = 0.9
        self.extreme_threshold = 0.95
        self.consistent_sampling_rate = 0.2  # 20% sampling rate for consistent cases

    def _should_trigger_intervention(self, contradiction_score: float) -> bool:
        """
        Triggers intervention:
        - Always for highly inconsistent cases (≥ 0.95)
        - Randomly (consistent_sampling_rate) for highly consistent cases (≤ 0.05)
        """
        # Always trigger for high contradiction
        if contradiction_score >= self.extreme_threshold:
            return True
            
        # Randomly sample low contradiction cases
        if contradiction_score <= (1 - self.extreme_threshold):
            return random.random() < self.consistent_sampling_rate
            
        return False

    async def check_consistency(self, current_segment: Dict, previous_segments: List[Dict]) -> ContradictionResult:
        """Check consistency against previous segments"""
        try:
            # Early return if no previous segments
            if not previous_segments:
                logging.info(f"No previous segments to check against for UUID: {current_segment['uuid']}")
                return ContradictionResult(intervention_triggered=False, contradictions=[])

            contradictions = []
            self.model.eval()
            
            async with asyncio.Lock():  # Protect model inference
                with torch.no_grad():
                    # runs model inference for pairwise consistency check
                    for prev_segment in previous_segments:
                        await asyncio.sleep(0)  # Allow other tasks
                        logging.info(f"🔄 [Consistency] Starting check for UUID={current_segment['uuid']} against {len(previous_segments)} previous segments")
                        logging.info(f"💭 [Consistency] Comparing segments:")
                        logging.info(f"Previous segment [{prev_segment['uuid']}]: {prev_segment['text'][:100]}...")
                        logging.info(f"Current segment [{current_segment['uuid']}]: {current_segment['text'][:100]}...")
                        
                        inputs = self.tokenizer(
                            [prev_segment['text']],
                            [current_segment['text']],
                            padding=True,
                            truncation=True,
                            return_tensors="pt"
                        )

                        outputs = self.model(**inputs)
                        scores = F.softmax(outputs.logits, dim=1)
                        contradiction_score = scores[0][0].item()  # Get score for 'contradiction'
                        logging.info(f"🔄 [Consistency] [Consistency] Contradiction score: {contradiction_score:.2f}")
                        # # Regular intervention trigger if not in data collection case
                        # if contradiction_score >= self.contradiction_threshold:
                        if self._should_trigger_intervention(contradiction_score):
                            
                            logging.info(f"🔄 [Consistency] {'Inconsistent' if contradiction_score >= self.extreme_threshold else 'Highly consistent'} with score {contradiction_score:.2f} -> Intervention triggered")
                            contradictions.append({
                                "previous_segment": {
                                    "uuid": prev_segment['uuid'],
                                    "text": prev_segment['text']
                                },
                                "current_segment": {
                                    "uuid": current_segment['uuid'],
                                    "text": current_segment['text']
                                },
                                "contradiction_score": contradiction_score
                            })

            intervention_triggered = len(contradictions) > 0
            return ContradictionResult(intervention_triggered=intervention_triggered, contradictions=contradictions)

        except Exception as e:
            logging.error(f"Error in consistency check: {e}")
            raise