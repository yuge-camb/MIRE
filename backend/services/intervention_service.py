from dataclasses import dataclass
from typing import List, Dict, Optional
import uuid
import json
import logging
import os

@dataclass
class AmbiguityIntervention:
    id: str
    trigger_phrase: str
    suggestions: Optional[List[str]] = None

class InterventionService:
    def __init__(self, llm_manager):
        self.llm = llm_manager

        # Load ambiguity types
        current_dir = os.path.dirname(os.path.abspath(__file__))
        ambiguity_type_path = os.path.join(current_dir, 'ambiguity_types.json')
        with open(ambiguity_type_path, 'r') as f:
            self.ambiguity_types = json.load(f)
        self.interpretation_prompt = self._build_interpretation_prompt()

    async def generate_ambiguity_intervention(self, text: str, intervention_type: str, analysis_prompt: str) -> AmbiguityIntervention:
        """Generate appropriate intervention based on confidence"""
        intervention_id = str(uuid.uuid4())
        # Get interpretations from LLM
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
        if 'error' not in interp_result:
            try:
                parsed = json.loads(interp_result['choices'][0].message.content)
                return AmbiguityIntervention(
                    id=intervention_id,
                    trigger_phrase=parsed['trigger_phrase'],
                    suggestions=parsed['interpretations'] if intervention_type == "multiple_choice" else None
                )
            except (json.JSONDecodeError, KeyError) as e:
                logging.error(f"Failed to parse interpretation: {e}")
                return []
        return []

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