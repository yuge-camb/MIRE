from typing import List, Dict, Optional, Tuple
import openai
from dataclasses import dataclass
import json
import numpy as np
import os
import logging
from .llm_manager import LLMManager
import random

@dataclass
class AmbiguityResult:
    # detected: bool
    is_ambiguous: bool  # From yes/no answer
    confidence: float  # Probability of that answer, logprob converted to probability
    intervention_triggered: bool  # Whether to show intervention
    trigger_phrase: Optional[str] = None
    suggestions: List[str] = None
    intervention_type: Optional[str] = None  # 'multiple_choice' or 'clarification'

class DetectorService:
    def __init__(self, llm_manager: LLMManager):
        """Initialize with LLMManager for request coordination"""
        self.llm = llm_manager
        
        # Load ambiguity types
        current_dir = os.path.dirname(os.path.abspath(__file__))
        ambiguity_type_path = os.path.join(current_dir, 'ambiguity_types.json')

        with open(ambiguity_type_path, 'r') as f:
            self.ambiguity_types = json.load(f)
        
        questions_path = os.path.join(current_dir, 'questions_stage1.json')
        with open(questions_path, 'r') as f:
            self.questions = json.load(f)['questions']

        # Define confidence thresholds 
        self.HIGH_CONFIDENCE = 0.7
        self.MEDIUM_CONFIDENCE = 0.5
        
        # Data Collection threshold
        self.extreme_threshold = 0.8
        self.unambiguous_sampling_rate = 0.5  # 50% sampling rate for unambiguous cases

        # Build system prompts
        self.detection_prompt = self._build_detection_prompt()
        self.interpretation_prompt = self._build_interpretation_prompt()
        
    def _should_trigger_intervention(self, is_ambiguous: bool, confidence: float) -> bool:
        """
        Triggers intervention:
        - Always for highly ambiguous cases with high confidence
        - Randomly (unambiguous_sampling_rate) for highly unambiguous cases with high confidence
        """
        if confidence >= self.extreme_threshold:
            if is_ambiguous:
                return True  # Always trigger for high-confidence ambiguous
            else:
                return random.random() < self.unambiguous_sampling_rate  # Random sampling for unambiguous
                
        return False
    
    async def detect_ambiguity(self, text: str, question_idx:int) -> AmbiguityResult:
        """Detect ambiguity using logprobs analysis"""
        try:
            logging.info(f"🔍 Starting ambiguity detection for: {text[:50]}...")
            # initialising intervention_triggered
            intervention_triggered = False
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

            # In data collection, triggering interventions for both highly ambiguous AND highly unambiguous cases
            if self._should_trigger_intervention(is_ambiguous, confidence):
                interp_result = await self.llm.submit_request_async(
                    messages=[
                        {"role": "system", "content": self.interpretation_prompt},
                        {"role": "user", "content": analysis_prompt}
                    ],
                    task_type="analysis",
                    model="gpt-4",
                    max_tokens=200,
                    temperature=0.7
                )
                
                try:
                    if 'error' not in interp_result:
                        parsed = json.loads(interp_result['choices'][0].message.content)
                        logging.info(f"🎯 [Understandability] {'Ambiguous' if is_ambiguous else 'Unambiguous'} with confidence {confidence:.2f} -> Intervention triggered")
                        return AmbiguityResult(
                            is_ambiguous=is_ambiguous,  # Keep original detection
                            confidence=confidence,
                            intervention_triggered=True,
                            intervention_type='multiple_choice' if parsed.get('interpretations') else 'clarification',
                            trigger_phrase=parsed.get('trigger_phrase'),
                            suggestions=parsed.get('interpretations')
                        )
                except (json.JSONDecodeError, KeyError) as e:
                    logging.error(f"Failed to parse interpretation: {e}")
                    intervention_triggered=False

            # Basic return for no intervention/failed parsing 
            return AmbiguityResult(is_ambiguous=is_ambiguous, intervention_triggered=intervention_triggered, confidence=confidence)
    
            # # The regular case where it is not data collection
            # if not is_ambiguous:
            #     logging.info(f"No ambiguity detected. Confidence: {confidence:.2f}")
            #     return AmbiguityResult(detected=False, confidence=confidence)
            
            # logging.info(f"Ambiguity detected with confidence: {confidence:.2f}")

            # if confidence >= self.MEDIUM_CONFIDENCE:
            #     # Get interpretations if confidence is high enough
                
            #     interp_result = await self.llm.submit_request_async(
            #         messages=[
            #             {"role": "system", "content": self.interpretation_prompt},
            #             {"role": "user", "content": analysis_prompt}
            #         ],
            #         task_type="analysis",
            #         model="gpt-4",
            #         max_tokens=200,
            #         temperature=0.7
            #     )
                
            #     if 'error' not in interp_result:
            #         try:
            #             parsed = json.loads(interp_result['choices'][0].message.content)
            #             return AmbiguityResult(
            #                 detected=True,
            #                 confidence=confidence,
            #                 intervention_type='multiple_choice' if confidence >= self.HIGH_CONFIDENCE else 'clarification',
            #                 trigger_phrase=parsed['trigger_phrase'],
            #                 suggestions=parsed['interpretations'] if confidence >= self.HIGH_CONFIDENCE else None
            #             )
            #         except (json.JSONDecodeError, KeyError) as e:
            #             logging.error(f"Failed to parse interpretation: {e}")
            
            # return AmbiguityResult(detected=True, confidence=confidence)
            
        except Exception as e:
            logging.error(f"❌ Error in ambiguity detection: {e}")
            return AmbiguityResult(intervention_triggered=False, confidence=0.0)

    def _logprob_to_probability(self, logprob: float) -> float:
        """Convert logprob to probability"""
        return np.exp(logprob)

    def _build_detection_prompt(self) -> str:
        """Build comprehensive prompt using full ambiguity type definitions"""
        # Previous prompt building code remains the same
        prompt_parts = [
        """You are an expert requirement analyst analysing raw responses from a requirement elicitation survey for ambiguity in a university engineering module review system context.

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

    def _build_interpretation_prompt(self) -> str:
        """Build interpretation prompt"""
        # Previous interpretation prompt building code remains the same
        prompt_parts = [
            """You are an expert requirement analyst analysing raw responses from a requirement elicitation survey for ambiguity in a university engineering module review system context.
            
            You will receive:
            1. The survey question being answered
            2. A response that needs interpretation
            
            Generate interpretations that specifically address how the ambiguous response could be understood in the context of the original question.
            
            Based on our ambiguity database, here are examples of how different types of ambiguity can be interpreted:"""
        ]
        
        for amb_type, details in self.ambiguity_types.items():
            if 'subtypes' in details:
                prompt_parts.append(f"\n{amb_type.upper()} AMBIGUITY EXAMPLES:")
                if 'definition' in details:
                    prompt_parts.append(f"General definition: {details['definition']}")
                else:
                    prompt_parts.append("General definition: Not provided")
                
                for subtype, subtype_details in details['subtypes'].items():
                    if 'example' in subtype_details:
                        example = subtype_details['example']
                        prompt_parts.append(f"\nSubtype: {subtype}")
                        prompt_parts.append(f"When encountering: \"{example['text']}\"")
                        prompt_parts.append("Possible interpretations:")
                        for idx, interp in enumerate(example['interpretations'], 1):
                            prompt_parts.append(f"{idx}. {interp}")
        
        prompt_parts.append("""
        Following these examples, provide interpretations for the part where you considered most ambiguous.
        Rules:
        1. Generate exactly 3 distinct interpretations
        2. Make interpretations specific and contextually relevant to what was being asked
        3. Follow the style of examples shown above
        4. Each interpretation should be written as a direct replacement for the trigger phrase, 
            i.e. when user chooses to apply the interpretation to replace the trigger phrase, the overall answer should still flow naturally
    
        Format your response as a JSON object with exactly this structure:
        {
            "interpretations": [
                "first interpretation",
                "second interpretation", 
                "third interpretation"
            ],
            "trigger_phrase": "specific ambiguous phrase"
        }
        """)
        
        return "\n".join(prompt_parts)

    def get_intervention_options(self, ambiguity_result: AmbiguityResult) -> Optional[Dict]:
        """Generate appropriate intervention based on confidence and type"""
        if not ambiguity_result.intervention_triggered:
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

