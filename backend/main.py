from fastapi import FastAPI, WebSocket, BackgroundTasks, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Optional
from services.logger import Logger
from services.analysis_service import AnalysisService
from services.intervention_service import InterventionService
from services.requirement_service import RequirementService
from services.llm_manager import LLMManager
from models.data_models import AnalysisRequest, InterventionResponse
from datetime import datetime
import logging
import os
import asyncio
from services import context_store


app = FastAPI()
llm_manager = LLMManager()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
llm_manager = LLMManager()
# Initialize logger with path
log_dir = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(log_dir, exist_ok=True)
logger = Logger(log_dir)
intervention_service = InterventionService(llm_manager=llm_manager)
requirement_service = RequirementService(llm_manager=llm_manager, websocket_handler=None, logger=logger)
analysis_service = AnalysisService(llm_manager=llm_manager, websocket_handler=None, intervention_service=intervention_service, logger = logger)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_state = {"segments": {}, "analysisStatus": {}}  # Initialize session state

    # Assign the websocket handler to analysis service
    analysis_service.ws = websocket
    requirement_service.ws = websocket

    try:
        while True:
            data = await websocket.receive_json()
            print("Received websocket message:", data)

            if data["type"] == "sync_state":
                session_state["segments"] = data.get("segments", {})
                session_state["analysisStatus"] = data.get("analysisStatus", {})

            elif data["type"] == "session_start":
                session_id = data["sessionId"]
                logger.create_session_directory(session_id)
                session_state["segments"] = data.get("segments", {})   #Initialize session state      

                # Set the active context
                context_id = data.get("context", "context1")
                context_store.set_context(context_id)
                logging.info(f"Setting context to: {context_id}")

                await requirement_service.reset_state()
                await intervention_service.reset_state()
                await analysis_service.reset_state()

                # Log session start information
                logger.log({
                    "type": "session_start",
                    "sessionId": session_id,
                    "context": data.get("context"),
                    "initiativeMode": data.get("initiativeMode"),
                    "timestamp": data.get("timestamp")
                })
                
            elif data["type"] == "segment_update":
                uuid = data["uuid"]
                text = data["text"]
                question_idx = data["questionIdx"]
                segment_idx = data["segmentIdx"]
                intervention_mode = data.get("interventionMode", "on")
                manual_trigger = data.get("isManualTrigger", False)
                all_segments = data.get("all_segments", {})
                logging.info(f"🔄 [WebSocket] Triggering analysis for UUID={data['uuid']}"
                            f"uuid={uuid}, text={text[:50]}..., "
                            f"questionIdx={question_idx}, "
                            f"segmentIdx={segment_idx}")

                # Update session state
                session_state["segments"][uuid] = {
                    "text": text,
                    "question_idx": question_idx,
                    "segment_idx": segment_idx
                }

                # Handle analysis
                if intervention_mode == "on" or manual_trigger == True:
                    await analysis_service.handle_segment_update(
                        uuid=uuid,
                        text=text,
                        question_idx=question_idx,
                        segment_idx=segment_idx,
                        all_segments=session_state["segments"]
                    )

                asyncio.create_task(requirement_service.handle_segment_update(
                    uuid=uuid,
                    text=text,
                    question_idx=question_idx,
                    segment_idx=segment_idx,
                ))

                # Log edit event
                logger.log({
                    "type": "segment_edit",
                    "uuid": uuid,
                    "data": data,
                 })
            
            elif data["type"] == "stability_check":
                # Handle inactivity timeouts
                question_id = data["questionId"]
                await requirement_service.get_question_stability(question_id)
            
            elif data["type"] == "generate_requirements":
                question_id = data["questionId"]
                segments = data["segments"]  # Now expecting full segment objects with {uuid, text}
                trigger_mode = data["triggerMode"]
                
                # Handle requirement generation asynchronously
                asyncio.create_task(requirement_service.generate_requirements(
                    question_id=question_id,
                    segments=segments,
                    trigger_mode=trigger_mode
                ))
            
            elif data["type"] == "discard_requirement_generation":
                question_id = data["questionId"]
                
                # Handle discard request
                await requirement_service.handle_discard_request(question_id)
                
                # Log the discard request
                logger.log({
                    "type": "requirement_generation_discard_request",
                    "question_id": question_id,
                    "timestamp": datetime.now().isoformat()
                })

            elif data["type"] == "pause_analysis":
                await analysis_service.pause_analysis()
            
            elif data["type"] == "resume_analysis":
                await analysis_service.resume_analysis()
                
            elif data["type"] == "segment_timing":
                # Log segment timing data
                logger.log({
                    "type": "segment_timing",
                    "uuid": data["uuid"],
                    "timing_data": data 
                })

            elif data["type"] == "intervention_response":
                # Log the response
                logger.log({
                    "type": "intervention_response",
                    "uuid": data["uuid"],
                    "timing_data": data 
                })
            
            elif data["type"] == "activity_timeline":
                # Log activity timeline
                logger.log({
                    "type": "activity_timeline",
                    "interventionId": data.get("interventionId"),
                    "activity_data": data.get("data")
                })
            
            elif data["type"] == "intervention_feedback":
                # Log feedback
                logger.log({
                    "type": "intervention_feedback",
                    "timestamp": data.get("timestamp"),
                    "interventionId": data.get("interventionId"),
                    "feedback": data
                })
                
            elif data["type"] == "submit_survey":
                # Log final survey state
                logger.log({
                    "type": "survey_submission",
                    "timestamp": data.get("timestamp"),
                    "final_state": data.get("finalState"),
                    "session_id": data.get("sessionId")
                })
                
                # Send confirmation back to client
                await websocket.send_json({
                    "type": "survey_submission_confirmed",
                    "sessionId": data.get("sessionId")
                })

    except WebSocketDisconnect:
        print("Client disconnected")
