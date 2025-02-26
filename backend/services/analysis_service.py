from collections import deque
from dataclasses import dataclass
from typing import Dict, Optional, Set
import time
import asyncio
import uuid
from models.data_models import AnalysisRequest  
from services.understandability_service import DetectorService
from services.consistency_service import ConsistencyService
import logging
import os

class AnalysisService:
    def __init__(self, 
                 llm_manager,  
                 websocket_handler,
                 intervention_service, 
                 logger):
        # Initialize sub-services
        self.detector = DetectorService(llm_manager, intervention_service)
        self.consistency = ConsistencyService()  
        self.ws = websocket_handler
        self.logger = logger
        # Use single asyncio.Queue for analysis requests
        self.queue = asyncio.Queue()
        self.is_processing = False  # Flag to track if there is something currently being processed in the queue
        self.currently_processing = None  # Track UUID currently being processed
        self.is_paused = False # Flag to track if the queue processing is paused
        self.discard_results = set()  # Set to track UUIDs whose results should be discarded
        self.analysis_status = {}
        self.active_interventions = {}
        self.segments = {}
        self.analysis_results = {}

    async def _cancel_existing_analysis(self, uuid):
        """Internal method to handle cancellation logic

        Handles old analysis at various stages:
        1. In queue: Directly removed from queue
        2. Currently being processed: Added to discard_results set (checked in _process_queue)
        - Analysis will complete but results won't be sent 
        - Any consistency interventions referencing this segment will be filtered
        3. Completed but not sent: Results will be dropped (via discard_results check in _handle_analysis_result)
        """
        # Mark for discard if currently processing
        if uuid == self.currently_processing:
            self.discard_results.add(uuid)
            logging.info(f"⚠️ [Analysis] Marking current analysis for discard: UUID={uuid}")
        
        # Remove from queue if present
        temp_queue = asyncio.Queue()
        while not self.queue.empty():
            request = await self.queue.get()
            if request.uuid != uuid:
                await temp_queue.put(request)
            else:
                logging.info(f"🗑️ [Analysis] Removed queued analysis for UUID={uuid}")
        self.queue = temp_queue

    async def pause_analysis(self):
        """Pause processing of new analyses when a user is filling in the feedback form"""
        logging.info("⏸️ [Analysis] Pausing analysis queue processing")
        self.is_paused = True

    async def resume_analysis(self):
        """Resume processing of analyses when a user is done filling in the feedback form"""
        logging.info("▶️ [Analysis] Resuming analysis queue processing")
        self.is_paused = False
        # If queue has items and nothing is being processed, restart processing
        if not self.queue.empty() and not self.is_processing:
            self.is_processing = True
            asyncio.create_task(self._process_queue())

    async def handle_segment_update(self, uuid, text, question_idx, segment_idx, all_segments):
        logging.info(f"📤[Analysis] Handling segment update: UUID={uuid}")
        
        # Cancel any existing analysis for this UUID
        await self._cancel_existing_analysis(uuid)
        
        # Create new analysis request
        request = AnalysisRequest(
            uuid=uuid,
            text=text,
            question_idx=question_idx,
            segment_idx=segment_idx,
            timestamp=time.time(),
            all_segments=all_segments,
            status="pending"
        )
        
        # Update segments state
        self.segments[uuid] = {
            "text": text,
            "question_idx": question_idx,
            "segment_idx": segment_idx
        }

        # Queue the new request
        await self.queue.put(request)
        logging.info(f"📥 [Analysis] Queued new analysis. Queue size: {self.queue.qsize()}")
        
        # Start processing if not already running
        if not self.is_processing:
            logging.info("🎬 [Analysis] Starting queue processing")
            self.is_processing = True
            asyncio.create_task(self._process_queue())

    async def _process_queue(self):
        """Process one analysis request at a time"""
        try:
            while not self.queue.empty():
                # Check pause state before processing each item
                if self.is_paused:
                    return  # Exit processing while paused
                
                request = await self.queue.get()
                self.currently_processing = request.uuid
                logging.info(f"📤 [Analysis] Processing analysis for UUID: {request.uuid}")
                
                try:
                    # Run analysis for current segment
                    analysis_result = await self._analyze_text(request)
                    
                    # Check if the analysis result should be discarded due to newer analysis
                    if request.uuid in self.discard_results:
                        logging.info(f"🚫 [Analysis] Discarding completed analysis for UUID={request.uuid} as newer analysis exists")
                        self.discard_results.remove(request.uuid)
                    else:
                        # Filter consistency interventions if newer analysis exists for referenced segment
                        if "interventions" in analysis_result:
                            filtered_interventions = []
                            for intervention in analysis_result["interventions"]:
                                if intervention['type'] == 'consistency':
                                    referenced_uuid = intervention['previous_segment']['uuid']
                                    has_new_analysis = any(
                                        queued_request.uuid == referenced_uuid 
                                        for queued_request in self.queue._queue
                                    )
                                    if has_new_analysis:
                                        logging.info(f"🚫 [Analysis] Discarding consistency intervention: referenced segment {referenced_uuid} has newer analysis pending")
                                        continue
                                filtered_interventions.append(intervention)
                            analysis_result["interventions"] = filtered_interventions

                        # Store result and send
                        self.analysis_results[request.uuid] = analysis_result
                        await self._handle_analysis_result(request)
                
                finally:
                    # self.queue.task_done()
                    self.currently_processing = None

        finally:
            logging.info("🏁 [Analysis] Queue processing completed")
            self.is_processing = False

    async def _analyze_text(self, request: AnalysisRequest):
        """Run parallel ambiguity and consistency analysis for a single segment"""
        try:
            logging.info(f"📤 [Analysis] Starting parallel analysis for UUID={request.uuid}")
            
            # Create tasks for parallel execution
            detector_task = asyncio.create_task(
                self.detector.detect_ambiguity(request.text, request.question_idx)
            )
            
            logging.info(f"{request.all_segments.items()}")
            # Get previous segments for consistency check
            previous_segments = [
                {
                    'uuid': uuid,
                    'text': segment['text']
                    # 'question_idx': segment.get('question_idx', segment.get('questionIdx')),
                    # 'segment_idx': segment.get('segment_idx', segment.get('segmentIdx'))   
                            }
                for uuid, segment in request.all_segments.items()
                if uuid != request.uuid and segment['text'].strip()  # Only include non-empty texts
            ]
            logging.info(f"📤 [Analysis] Processing previous segments - Total segments: {len(request.all_segments)}, Current UUID: {request.uuid}")
            logging.info(f"📤 [Analysis] Found {len(previous_segments)} previous segments for analysis")
            
            consistency_task = asyncio.create_task(
                self.consistency.check_consistency( 
                    {
                        'uuid': request.uuid,
                        'text': request.text,
                        'question_idx': request.question_idx,
                        'segment_idx': request.segment_idx
                    },
                    previous_segments
                )
            )

            # Wait for both analyses to complete
            ambiguity_result, consistency_result = await asyncio.gather(
                detector_task, 
                consistency_task
            )

            logging.info(f"✅ [Analysis] Completed parallel analysis for UUID={request.uuid}")
            logging.info(f"🎯 [Understandability] Ambiguity interventions triggered: {ambiguity_result.detected}")
            logging.info(f"🔄 [Consistency] Issues found: {len(consistency_result.contradictions) if consistency_result.detected else 0}")

            # Combine results
            interventions = []

            # Add ambiguity intervention if triggered
            if ambiguity_result.detected:
                intervention_id = str(uuid.uuid4()) # Generate unique ID for intervention to be used in frontend display
                interventions.append({
                    "id": intervention_id,
                    "type": f"ambiguity_{ambiguity_result.intervention_type}", 
                    "trigger_phrase": ambiguity_result.trigger_phrase,
                    "suggestions": ambiguity_result.suggestions,
                    "segment_uuid": request.uuid,
                    "confidence": ambiguity_result.confidence
                })

                # Log analysis result when an intervention is sent to the frontend
                self.logger.log({
                    "type": "ambiguity_analysis",
                    "intervention_id": intervention_id,
                    "data": {  # Put all analysis details in data field like other logs
                        "confidence": ambiguity_result.confidence,
                        "trigger_phrase": ambiguity_result.trigger_phrase,
                        "suggested_interpretations": ambiguity_result.suggestions,
                        "intervention_type": ambiguity_result.intervention_type,
                        "uuid": request.uuid
                    }
                })

            # Add consistency interventions if triggered
            if consistency_result.detected:
                for contradiction in consistency_result.contradictions:
                    intervention_id = str(uuid.uuid4()) # Generate unique ID for intervention to be used in frontend display
                    interventions.append({
                        "id": intervention_id,
                        "type": "consistency",
                        "previous_segment": contradiction['previous_segment'],
                        "current_segment": contradiction['current_segment'],
                        "segment_uuid": request.uuid,
                        "confidence": contradiction['contradiction_score']
                    })

                # Log analysis result when an intervention is sent to the frontend
                self.logger.log({
                    "type": "consistency_analysis",
                    "intervention_id": intervention_id,
                    "data": { 
                        "contradiction_score": contradiction['contradiction_score'],
                        "previous_segment": contradiction['previous_segment'],
                        "current_segment": contradiction['current_segment']
                    }
                })

            return {"interventions": interventions if interventions else []}

        except Exception as e:
            logging.error(f"❌ [Analysis] Error in parallel analysis: {e}")
            return {"error": str(e)}
        
    async def _handle_analysis_result(self, request: AnalysisRequest):
        logging.info(f"📤 [Analysis] Sending results for UUID={request.uuid}")
        try:
            # Check if results should still be sent
            if request.uuid in self.discard_results:
                logging.info(f"🚫 [Analysis] Skipping sending results for UUID={request.uuid} as newer analysis exists")
                self.discard_results.remove(request.uuid)
                return
            self.analysis_status[request.uuid] = "completed"
            
            # Create result dict from the processed queue
            analysis_result = self.analysis_results.get(request.uuid)
            
            # Safely handle result and extract interventions
            if "error" not in analysis_result:
                interventions = analysis_result.get("interventions", [])
                
                # Send response with interventions
                await self.ws.send_json({
                    "type": "analysis_complete",
                    "uuid": request.uuid,
                    "status": "completed",
                    "interventions": interventions
                })
            else:
                raise Exception(analysis_result["error"])

        except Exception as e:
            logging.error(f"❌ [Analysis] Error during analysis for UUID {request.uuid}: {e}")
            self.analysis_status[request.uuid] = "error"
            await self.ws.send_json({
                "type": "analysis_error",
                "uuid": request.uuid,
                "error": str(e)
            })