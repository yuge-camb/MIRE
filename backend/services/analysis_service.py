from collections import deque
from dataclasses import dataclass
from typing import Dict, Optional, Set
import time
import asyncio
from models.data_models import AnalysisRequest  
from services.understandability_service import DetectorService
from services.consistency_service import ConsistencyService
import logging

class AnalysisService:
    def __init__(self, 
                 llm_manager,  
                 websocket_handler,
                 intervention_service):
        # Initialize sub-services
        self.detector = DetectorService(llm_manager)
        self.consistency = ConsistencyService()  
        self.ws = websocket_handler
        self.intervention_service = intervention_service
        
        # Use single asyncio.Queue for analysis requests
        self.queue = asyncio.Queue()
        self.is_processing = False  # Flag to track if we're currently processing
        self.currently_processing = None  # Track UUID currently being processed
        self.discard_results = set()  # Set to track UUIDs whose results should be discarded
        self.analysis_status = {}
        self.active_interventions = {}
        self.segments = {}

    def cancel_analysis(self, uuid: str):
        """Mark analysis as cancelled and clean up state"""
        logging.info(f"❌ [Analysis] Cancelling analysis for UUID: {uuid}")
        
        # If currently processing, flag to discard results
        if uuid == self.currently_processing:
            self.discard_results.add(uuid)
            
        # Clear states
        self.analysis_status.pop(uuid, None)
        self.active_interventions.pop(uuid, None)
        
        # Remove from queue if present
        temp_queue = asyncio.Queue()
        while not self.queue.empty():
            request = self.queue.get_nowait()
            if request.uuid != uuid:
                temp_queue.put_nowait(request)
        self.queue = temp_queue

    async def handle_segment_update(self, uuid, text, question_idx, segment_idx, all_segments):
        logging.info(f"🔄 [Analysis] Handling segment update: UUID={uuid}, all_segments count={len(all_segments)}")
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

        # Handle different cases based on UUID status
        if uuid == self.currently_processing:
            # If this UUID is currently being processed, flag to discard its results
            logging.info(f"⚠️ [Analysis] UUID={uuid} currently processing, flagging to discard results")
            self.discard_results.add(uuid)
            
            # Clear any existing interventions for this UUID
            self.active_interventions.pop(uuid, None)
        else:
            # Remove any existing requests for this UUID from the queue
            temp_queue = asyncio.Queue()
            while not self.queue.empty():
                queued_request = await self.queue.get()
                if queued_request.uuid != uuid:
                    await temp_queue.put(queued_request)
            
            # Restore queue without the old request for this UUID
            while not temp_queue.empty():
                await self.queue.put(await temp_queue.get())
                
            # Clear any existing interventions for this UUID
            self.active_interventions.pop(uuid, None)
            logging.info(f"🔄 [Analysis] Removed old requests for UUID={uuid} from queue")

        # Queue the new request
        await self.queue.put(request)
        logging.info(f"📥 [Analysis] Queued new analysis for UUID={uuid}. Queue size: {self.queue.qsize()}")
        
        # Start processing if not already running
        if not self.is_processing:
            logging.info("🎬 [Analysis] Starting queue processing")
            self.is_processing = True
            asyncio.create_task(self._process_queue())

    async def _process_queue(self):
        """Process one analysis request at a time"""
        try:
            while not self.queue.empty():
                request = await self.queue.get()
                self.currently_processing = request.uuid
                logging.info(f"📝 [Analysis] Processing analysis for UUID: {request.uuid}")
                
                try:
                    # Run parallel analysis for current segment
                    analysis_result = await self._analyze_text(request)
                    logging.info(f"✅ [Analysis] Analysis completed for UUID: {request.uuid}")
                    logging.info(f"📊 [Analysis] Result: {analysis_result}")
                    
                    # Only handle results if they shouldn't be discarded
                    if request.uuid not in self.discard_results:
                        if "error" not in analysis_result:
                            await self._handle_analysis_result(request)
                        else:
                            self.analysis_status[request.uuid] = "error"
                            await self.ws.send_json({
                                "type": "analysis_error",
                                "uuid": request.uuid,
                                "error": analysis_result["error"]
                            })
                    else:
                        logging.info(f"🚫 [Analysis] Discarding results for UUID: {request.uuid}")
                        self.discard_results.remove(request.uuid)
                
                except Exception as e:
                    logging.error(f"❌ [Analysis] Error during analysis for UUID {request.uuid}: {e}")
                    if request.uuid not in self.discard_results:
                        self.analysis_status[request.uuid] = "error"
                        await self.ws.send_json({
                            "type": "analysis_error",
                            "uuid": request.uuid,
                            "error": str(e)
                        })
                
                finally:
                    self.queue.task_done()
                    self.currently_processing = None

        finally:
            logging.info("🏁 [Analysis] Queue processing completed")
            self.is_processing = False

    async def _analyze_text(self, request: AnalysisRequest):
        """Run parallel ambiguity and consistency analysis for a single segment"""
        try:
            logging.info(f"🔍 [Analysis] Starting parallel analysis for UUID={request.uuid}")
            
            # Create tasks for parallel execution
            detector_task = asyncio.create_task(
                self.detector.detect_ambiguity(request.text)
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
            logging.info(f"📊 [Analysis] Processing previous segments - Total segments: {len(request.all_segments)}, Current UUID: {request.uuid}")
            logging.info(f"🔍 [Analysis] Found {len(previous_segments)} previous segments for analysis")
            
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
            logging.info(f"🎯 [Detector] Ambiguity detected: {ambiguity_result.detected}")
            logging.info(f"🔄 [Consistency] Issues found: {len(consistency_result.contradictions) if consistency_result.detected else 0}")

            # Combine results
            interventions = []

            # Add ambiguity intervention if detected
            if ambiguity_result.detected:
                interventions.append({
                    "type": f"ambiguity_{ambiguity_result.intervention_type}", 
                    "trigger_phrase": ambiguity_result.trigger_phrase,
                    "confidence": ambiguity_result.confidence,
                    "suggestions": ambiguity_result.suggestions,
                    "segment_uuid": request.uuid
                })

            # Add consistency interventions if detected
            if consistency_result.detected:
                for contradiction in consistency_result.contradictions:
                    interventions.append({
                        "type": "consistency",
                        "confidence": contradiction['contradiction_score'],
                        "previous_segment": contradiction['previous_segment'],
                        "current_segment": contradiction['current_segment'],
                        "segment_uuid": request.uuid
                    })

            return {"interventions": interventions if interventions else []}

        except Exception as e:
            logging.error(f"❌ [Analysis] Error in parallel analysis: {e}")
            return {"error": str(e)}
        
    async def _handle_analysis_result(self, request: AnalysisRequest):
        logging.info(f"📤 [Analysis] Sending results for UUID={request.uuid}")
        try:
            self.analysis_status[request.uuid] = "completed"
            
            # Create result dict from the analysis result
            analysis_result = await self._analyze_text(request)
            
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
            self.analysis_status[request.uuid] = "error"
            await self.ws.send_json({
                "type": "analysis_error",
                "uuid": request.uuid,
                "error": str(e)
            })