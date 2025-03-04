from typing import Dict, List, Optional, Tuple
import logging
from services.llm_manager import LLMManager
from . import context_store
import numpy as np
import json
import time
import os
import asyncio
from datetime import datetime

class RequirementService:
    """
    Service for analyzing segment stability and generating requirements.
    """
    def __init__(self, llm_manager: LLMManager, logger, websocket_handler):
        self.llm_manager = llm_manager
        self.logger = logger
        self.ws = websocket_handler
        
        # Store similarity scores for segments
        # {question_id: {segment_uuid: [{"timestamp": timestamp, "score": similarity_score, "text": text}]}}
        self.segment_similarity_history = {}
        
        # Store the latest text for each segment
        # {segment_uuid: {"text": text, "question_idx": question_idx, "last_updated": timestamp}}
        self.latest_segment_texts = {}
        
        # Track requirements generation state
        # {question_id: { "timestamp": timestamp}, "discarded": True/False,  "segments": [s["uuid"] for s in segments],}
        self.requirements_state = {}

        # Load questions and system context from the store
        self.questions, self.system_context = context_store.load_context()
    
    async def reset_state(self):
        """Reset all session-specific state"""
        self.segment_similarity_history.clear()
        self.latest_segment_texts.clear()
        self.requirements_state.clear()
        self.questions, self.system_context = context_store.load_context()
        logging.info (f"Questions: {self.questions}, System Context: {self.system_context}")

    async def handle_segment_update(self, uuid: str, text: str, question_idx: int, segment_idx: int):
        """
        Handle a segment update - compare with previous version and calculate similarity.
        """
        logging.info(f"📝 [RequirementService] Handling segment update for UUID={uuid}, question={question_idx}")
        
        # Get current timestamp
        current_time = time.time()
        
        # Check if this segment exists in our records
        is_first_update = uuid not in self.latest_segment_texts
        
        # Calculate similarity if this isn't the first update
        similarity_score = None
        if not is_first_update:
            previous_text = self.latest_segment_texts[uuid]["text"]
            similarity_score = await self._calculate_similarity(previous_text, text)
            logging.info(f"📝 [RequirementService] Similarity score: {similarity_score:.4f}")
            
            # Store similarity score in history
            question_id = str(question_idx)
            if question_id not in self.segment_similarity_history:
                self.segment_similarity_history[question_id] = {}
            
            if uuid not in self.segment_similarity_history[question_id]:
                self.segment_similarity_history[question_id][uuid] = []
            
            self.segment_similarity_history[question_id][uuid].append({
                "timestamp": current_time,
                "score": similarity_score,
                "text": text
            })
            
            # Log similarity score
            self.logger.log({
                "type": "segment_similarity", 
                "question_idx": question_idx,
                "data": {
                    "question_idx": question_idx,
                    "segment_uuid": uuid,
                    "similarity_score": similarity_score,
                    "text": text,
                    "previous_text": previous_text,
                    "timestamp": datetime.now().isoformat()
                }
            })

        # Update latest text for this segment
        self.latest_segment_texts[uuid] = {
            "text": text,
            "question_idx": question_idx,
            "segment_idx": segment_idx,
            "last_updated": current_time
        }
        
        return {
            "uuid": uuid,
            "similarity_score": similarity_score,
            "is_first_update": is_first_update
        }
    
    async def _calculate_similarity(self, text1: str, text2: str) -> float:
        """
        Calculate cosine similarity between two texts using sklearn.
        Returns a float between 0 and 1.
        """
        try:
            from sklearn.feature_extraction.text import CountVectorizer
            from sklearn.metrics.pairwise import cosine_similarity
            
            # Handle empty texts
            if not text1.strip() or not text2.strip():
                return 1.0
                
            # Create vectors and calculate similarity
            vectorizer = CountVectorizer().fit_transform([text1, text2])
            cosine_sim = cosine_similarity(vectorizer)
            similarity = cosine_sim[0, 1]  # Get similarity between first and second text
            
            logging.info(f"📝 [RequirementService] Calculated similarity: {similarity:.4f}")
            return similarity
                
        except Exception as e:
            logging.error(f"❌ [RequirementService] Error calculating similarity: {e}")
            return 0.01  # Default fallback
    
    async def get_question_stability(self, question_idx: int) -> Dict:
        """
        Determine if all segments for a question are stable.
        
        Returns a dict with:
        - is_stable (bool): Whether all segments are stable
        - segment_status (dict): Status of each segment
        """
        # Get all segments for this question
        question_segments = {
            uuid: data 
            for uuid, data in self.latest_segment_texts.items() 
            if data.get('question_idx') == question_idx
        }
        
        segment_status = {}
        all_stable = True
        
        for uuid, segment_data in question_segments.items():
            # Check stability for each segment
            stability = self._get_segment_stability(question_idx, uuid)
            segment_status[uuid] = stability
            
            # If any segment is not stable, the question is not stable
            if not stability["is_stable"]:
                all_stable = False
        
        # Send results via WebSocket
        await self.ws.send_json({
            "type": "stability_response",
            "questionId": question_idx,
            "isStable": all_stable,
            "segmentStatus": segment_status,
        })
        
        # Log stability check
        self.logger.log({
            "type": "stability_check",
            "question_idx": question_idx,
            "data": {
                "question_idx": question_idx,
                "is_stable": all_stable,
                "segment_status": segment_status,
                "timestamp": datetime.now().isoformat()
                }
        })

    def _get_segment_stability(self, question_idx: int, uuid: str) -> Dict:
        """
        Determine if a single segment is stable based on similarity history.
        Private helper method.
        """
        question_id = str(question_idx)
        
        # If no history for this segment/question, consider it stable
        # (First entry with no updates)
        if (question_id not in self.segment_similarity_history or 
            uuid not in self.segment_similarity_history[question_id]):
            return {"is_stable": True, "confidence": 1.0, "reason": "no_updates"}
        
        # Get similarity history for this segment
        history = self.segment_similarity_history[question_id][uuid]
        
        # Get latest similarity score
        latest_score = history[-1]["score"]
        
        # Check if latest score exceeds high threshold
        if latest_score > 0.8:
            return {"is_stable": True, "confidence": latest_score, "reason": "high_similarity"}
        
        # Else check if we have at least 2 updates for trend analysis
        elif len(history) >= 2:
            # Calculate if the trend is improving
            last_two_scores = [h["score"] for h in history[-2:]]
            trend = last_two_scores[1] - last_two_scores[0]
            
            # If trend is improving and latest score is moderately high
            if trend >= 0 and latest_score > 0.7:
                return {"is_stable": True, "confidence": latest_score, "reason": "stabilizing_trend"}
        
        return {"is_stable": False, "confidence": latest_score, "reason": "unstable"}
    
    async def generate_requirements(self, question_id: int, segments: List[Dict], trigger_mode: str):
        """
        Generate requirements for a list of segments within a question.
        
        Args:
            question_id: The ID of the question
            segments: List of segment objects with {uuid, text} for requirement generation
            trigger_mode: What triggered this generation ('manual', 'timeout', 'stability')
        """
        logging.info(f"📝 [RequirementService] Starting requirement generation for question {question_id}, mode: {trigger_mode}")
        
        # Filter out segments with empty text
        valid_segments = [segment for segment in segments if segment.get("text", "").strip()]
        
        if not valid_segments:
            logging.warning(f"⚠️ [RequirementService] No valid non-empty segments found for question {question_id}")
            # Send empty requirements result to frontend
            await self._send_generation_complete(question_id, [])
            return
        
        # Extract segment IDs for state tracking from valid segments only
        segment_ids = [segment["uuid"] for segment in valid_segments]
        
        # Mark this question as having pending generation
        self.requirements_state[question_id] = {
            "timestamp": time.time(),
            "discarded": False,
            "segments": segment_ids,
            "trigger_mode": trigger_mode
        }
        
        try:
            # Get question text for context
            question_text = self._get_question_text(question_id)
            
            # Create segment texts dictionary from the provided segments
            segment_texts = {segment["uuid"]: segment["text"] for segment in valid_segments}
            
            if not segment_texts:
                logging.warning(f"⚠️ [RequirementService] No valid segments found for question {question_id}")
                error_message = "No valid segments found for requirement generation"
                await self._send_generation_failed(question_id, error_message, error_message)
                return
            
            # Generate requirements through LLM
            requirements = await self._generate_requirements_with_llm(question_id, question_text, segment_texts)
            
            # Check if generation has been discarded before sending
            if question_id in self.requirements_state and self.requirements_state[question_id]["discarded"]:
                logging.info(f"🚫 [RequirementService] Skipping sending results for discarded generation (question {question_id})")
                return
            
            # Send results back to frontend
            await self._send_generation_complete(question_id, requirements)
            
            # Log generation results
            self.logger.log({
                "type": "requirement_generation",
                "question_idx": question_id,
                 "data": {
                    "trigger_mode": trigger_mode,
                    "requirement": requirements,
                    "segment": valid_segments,
                    "timestamp": datetime.now().isoformat()
                }
            })
            
            # Remove all state data for this question after completion
            if question_id in self.requirements_state:
                # Clean up all data for this question
                question_id_str = str(question_id)
                
                # Remove requirements state
                del self.requirements_state[question_id]
                
                # Remove segment similarity history for this question
                if question_id_str in self.segment_similarity_history:
                    del self.segment_similarity_history[question_id_str]
                
                # Remove latest segment texts for segments belonging to this question
                segment_uuids_to_remove = []
                for uuid, data in self.latest_segment_texts.items():
                    if data.get('question_idx') == question_id:
                        segment_uuids_to_remove.append(uuid)
                
                for uuid in segment_uuids_to_remove:
                    if uuid in self.latest_segment_texts:
                        del self.latest_segment_texts[uuid]
                        
        except Exception as e:
            logging.error(f"❌ [RequirementService] Error generating requirements: {e}")


    async def handle_discard_request(self, question_id: int):
        """
        Handle a request to discard requirement generation for a question
        """
        logging.info(f"🚫 [RequirementService] Discarding requirement generation for question {question_id}")
        
        # Check if we have active generation for this question
        if question_id in self.requirements_state:
            # Mark as discarded
            self.requirements_state[question_id]["discarded"] = True
        else:
            logging.warning(f"⚠️ [RequirementService] No active generation found for question {question_id}")

    async def _generate_requirements_with_llm(self, question_id: int, question_text: str, segment_texts: Dict[str, str]):
        """
        Generate requirements using LLM.
        
        Returns a list of requirement objects with links to source segments.
        """
        # Prepare prompt with EARS template and segments
        prompt = self._build_requirement_prompt(question_id, question_text, segment_texts)
        
        # Set up system prompt
        system_prompt = """You are a requirements engineering expert. Generate clear, precise raw requirements from user needs using the EARS template:
        1. Base requirement: "The system shall <action>."
        2. Event-driven: "When <event>, the system shall <action>."
        3. State-driven: "While <state>, the system shall <action>."
        4. Unwanted behavior: "If <condition>, the system shall <action>."
        5. Optional: "Where <feature>, the system shall <action>."

        Generate requirements based on the provided segments, following these IMPORTANT guidelines:     
        - A requirement should use multiple segments where possible (one-to-many mapping from requirement to segments)
        - Each segment should be used for at most ONE requirement (one-to-one mapping from segment to requirement) 
        - i.e. check if say another requirement has used this segment, then it should not be used again   
        - Focus on functional requirements (what the system should do)
        - Be specific and unambiguous
        - Resolve inconsistencies between segments where possible
        - Requirements should capture the intent behind segments, not just paraphrase them
        - Given your own interpretation, create testable requirements rather than using the exact same wording as the user's answer
        - Avoid directly using the users' words in the requirements as much as possible
        - Link each requirement to its source segment(s)

        Return results in JSON format with the structure: [{"requirement": "...", "segments": ["uuid1", "uuid2"]}]
        The 'segments' field should contain the UUIDs of all segments that contributed to this requirement.
        """
        
        # Call LLM
        response = await self.llm_manager.submit_request_async(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            task_type="requirement",
            model="gpt-4",
            temperature=0.3,
            max_tokens=2000
        )
        
        if 'error' in response:
            logging.error(f"❌ [RequirementService] LLM error: {response['error']}")
            raise Exception(f"LLM generation failed: {response['error']}")
        
        try:
            # Parse JSON response
            requirement_text = response['choices'][0].message.content
            requirements = json.loads(requirement_text)
            
            # Validate the structure
            if not isinstance(requirements, list):
                raise ValueError("LLM response not in expected list format")
                
            # Ensure each item has the required fields
            for item in requirements:
                if "requirement" not in item or "segments" not in item:
                    raise ValueError("Requirement items missing required fields")
                    
            return requirements
            
        except json.JSONDecodeError as e:
            logging.error(f"❌ [RequirementService] Failed to parse LLM response as JSON: {e}")
            logging.error(f"Raw response: {response['choices'][0].message.content}")
            logging.info(f"requirement_text {requirement_text}")
            error_message = "Failed to parse LLM response as JSON"
            await self._send_generation_failed(question_id, requirement_text, error_message)
            raise Exception("Failed to parse LLM response as JSON")

        except ValueError as e:
            logging.error(f"❌ [RequirementService] Invalid LLM response format: {e}")
            logging.info(f"requirement_text {requirement_text}")
            error_message = "Invalid LLM response format"
            await self._send_generation_failed(question_id, error_message, str(e))
            raise Exception(f"Invalid LLM response format: {e}")

        except Exception as e:
            logging.error(f"❌ [RequirementService] Error processing LLM response: {e}")
            error_message = "Error processing LLM response"
            await self._send_generation_failed(question_id, error_message, str(e))
            raise Exception(f"Error processing LLM response: {e}")

    def _build_requirement_prompt(self, question_id: int, question_text: str, segment_texts: Dict[str, str]):
        """
        Build the prompt for requirement generation.
        """
        system_name = self.system_context.get('name')

        prompt_parts = [
            f"Question context: '{question_text}'\n\n",
            f"Generate raw requirements for a {system_name} based on the following user inputs:"
        ]
        
        # Add each segment
        for idx, (uuid, text) in enumerate(segment_texts.items(), 1):
            prompt_parts.append(f"\nSegment {idx} (UUID: {uuid}):\n{text}")
        
        return "\n".join(prompt_parts)

    def _get_question_text(self, question_id: int) -> str:
        """
        Get the text of a question by its ID.
        """
        try:
            question_key = str(question_id)
            if hasattr(self, 'questions') and question_key in self.questions:
                return self.questions[question_key]
            else:
                logging.warning(f"⚠️ [RequirementService] Question ID {question_id} not found in questions")
                return f"Question {question_id}"
        except Exception as e:
            logging.error(f"❌ [RequirementService] Error getting question text: {e}")
            return f"Question {question_id}"

    async def _send_generation_complete(self, question_id: int, requirements: List[Dict]):
        """
        Send generation complete message to frontend.
        """
        await self.ws.send_json({
            "type": "requirement_generation_complete",
            "questionId": question_id,
            "requirements": requirements,
            "timestamp": datetime.now().isoformat()
        })
        
        logging.info(f"✅ [RequirementService] Sent {len(requirements)} requirements for question {question_id}")
    
    async def _send_generation_failed(self, question_id: int, error_message: str, details: str = None):
        """
        Send generation failure message to frontend.
        """
        await self.ws.send_json({
            "type": "requirement_generation_failed",
            "questionId": question_id,
            "error": error_message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        
        logging.error(f"❌ [RequirementService] Requirement generation failed for question {question_id}: {error_message}")