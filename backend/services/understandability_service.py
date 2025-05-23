from typing import List, Dict, Optional, Tuple
import openai
from dataclasses import dataclass
import json
import numpy as np
import os
import logging
from .llm_manager import LLMManager
from . import context_store
import random

@dataclass
class AmbiguityResult:
    detected: bool
    confidence: float  # Probability of that answer, logprob converted to probability
    trigger_phrase: Optional[str] = None
    suggestions: List[str] = None
    intervention_type: Optional[str] = None  # 'multiple_choice' or 'clarification'

class DetectorService:
    def __init__(self, llm_manager, intervention_service):
        """Initialize with LLMManager for request coordination"""
        self.llm = llm_manager
        self.intervention_service = intervention_service
        
        # Load ambiguity types
        current_dir = os.path.dirname(os.path.abspath(__file__))
        ambiguity_type_path = os.path.join(current_dir, 'ambiguity_types.json')

        with open(ambiguity_type_path, 'r') as f:
            self.ambiguity_types = json.load(f)
        
        # Load questions and system context from the store
        self.questions, self.system_context = context_store.load_context()

        # Build system prompts
        self.detection_prompt = self._build_detection_prompt()

        # Define confidence thresholds 
        self.HIGH_CONFIDENCE = 0.7
        self.MEDIUM_CONFIDENCE = 0.5

    async def reset_state(self):
        """Reset all session-specific state"""
        self.questions, self.system_context = context_store.load_context()
        self.detection_prompt = self._build_detection_prompt()
        logging.info (f"Questions: {self.questions}, System Context: {self.system_context}")
        logging.info (f"detection_prompt: {self.detection_prompt}")

    async def detect_ambiguity(self, text: str, question_idx:int) -> AmbiguityResult:
        """Detect ambiguity using logprobs analysis"""
        try:
            logging.info(f"🔍 Starting ambiguity detection for: {text[:50]}...")
            question_text = self.questions[str(question_idx)]
            analysis_prompt = f"Question being answered: {question_text}\n\nResponse to analyze: {text}"
            # Submit detection request through LLMManager

            result = await self.llm.submit_request_async(
                messages=[
                    {"role": "system", "content": self.detection_prompt},
                    {"role": "user", "content": analysis_prompt}
                ],
                task_type="analysis",
                model="gpt-4",
                logprobs=True,
                top_logprobs=1,
                max_tokens=1,
                temperature=0
            )

            if 'error' in result:
                raise Exception(result['error'])
                
            response_content = result['choices'][0].message.content.lower().strip()
            is_ambiguous = 'yes' in response_content
            
            logprobs_content = result['choices'][0].logprobs.content[0]  # Get first token
            confidence = self._logprob_to_probability(logprobs_content.logprob)
    
            if not is_ambiguous:
                logging.info(f"No ambiguity detected. Confidence: {confidence:.2f}")
                return AmbiguityResult(detected=False, confidence=confidence)
            
            logging.info(f"Ambiguity detected with confidence: {confidence:.2f}")

           
            # Get interpretations if confidence is high enough
            if confidence >=self.MEDIUM_CONFIDENCE:
                intervention_type = "multiple_choice" if confidence >= self.HIGH_CONFIDENCE else "clarification"
                # Generate intervention
                intervention = await self.intervention_service.generate_ambiguity_intervention(
                    text=text,
                    intervention_type = intervention_type,
                    analysis_prompt=analysis_prompt
                )

                return AmbiguityResult(
                    detected=True,
                    confidence=confidence,
                    intervention_type=intervention_type,
                    trigger_phrase=intervention.trigger_phrase,
                    suggestions=intervention.suggestions
                )
            
            return AmbiguityResult(detected=True, confidence=confidence)
        
        except Exception as e:
            logging.error(f"❌ Error in ambiguity detection: {e}")
            return AmbiguityResult(detected=False, confidence=0.0)

    def _logprob_to_probability(self, logprob: float) -> float:
        """Convert logprob to probability"""
        return np.exp(logprob)

    def _build_detection_prompt(self) -> str:
        """Build comprehensive prompt using full ambiguity type definitions"""
        # Previous prompt building code remains the same
        system_name = self.system_context.get('name')
        prompt_parts = [
        f"""You are an expert requirement analyst analysing raw responses from a requirement elicitation survey for ambiguity in a {system_name}.

        For each response, you will be given:
        1. The survey question being answered
        2. The response text to analyze
        
        Here is a comprehensive guide of ambiguity types with examples:
        """
        ]
        
        for amb_type, details in self.ambiguity_types["ambiguity_types"].items():
            prompt_parts.append(f"\n{amb_type.upper()} AMBIGUITY:")
            prompt_parts.append(f"Definition: {details['definition']}")
            
            if 'subtypes' in details:
                for subtype, subtype_details in details['subtypes'].items():
                    prompt_parts.append(f"\nSubtype: {subtype}")
                    prompt_parts.append(f"Definition: {subtype_details['definition']}")
                    
                    if 'example' in subtype_details:
                        example = subtype_details['example']
                        prompt_parts.append(f"Example Text: \"{example['text']}\"")
                        prompt_parts.append("Example Analysis JSON:")
                        example_json = {
                            "ambiguity_type": amb_type,
                            "subtype": subtype,
                            "trigger_word": example['text']
                        }
                        prompt_parts.append(json.dumps(example_json, indent=2))
                        prompt_parts.append("Possible Interpretations:")
                        for interp in example['interpretations']:
                            prompt_parts.append(f"- {interp}")
        
        prompt_parts.append("""
        When one part of the text fulfills one ambiguity type:
        1. First check the complete response text - does another part of the response clarify or explain this potentially ambiguous element?
        2. Then check the question context - does knowing what was asked resolve any remaining ambiguity?
        3. Only mark as ambiguous if the meaning remains unclear after considering:
        - The full response context (how other parts of the response might clarify it)
        - The question context (what specific information was being asked for)

        For the text provided, respond with ONLY 'yes' or 'no' to indicate if the overall case is ambiguous:
        - "yes" if a part remains ambiguous even after considering both its surrounding response context and the question context
        - "no" if any apparent ambiguity is resolved by either the surrounding response or the question context
        """)
            
        return "\n".join(prompt_parts)

    def get_intervention_options(self, ambiguity_result: AmbiguityResult) -> Optional[Dict]:
        """Generate appropriate intervention based on confidence and type"""
        if not ambiguity_result.detected:
            return None
            
        if ambiguity_result.intervention_type == 'multiple_choice':
            return {
                "type": "ambiguity_multiple_choice",
                "message": f"I noticed ambiguity in '{ambiguity_result.trigger_phrase}'. Did you mean:",
                "options": ambiguity_result.suggestions
            }
        else:  # clarification
            return {
                "type": "ambiguity_clarification",
                "message": f"I understand most of this, but could you clarify '{ambiguity_result.trigger_phrase}'?",
                "requires_input": True
            }

