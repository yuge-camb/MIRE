from fastapi import FastAPI, WebSocket, BackgroundTasks, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Optional
from services.logger import Logger
from services.analysis_service import AnalysisService
from services.intervention_service import InterventionService
from services.llm_manager import LLMManager
from models.data_models import AnalysisRequest, InterventionResponse
from datetime import datetime
import logging
import os

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
intervention_service = InterventionService(logger)
analysis_service = AnalysisService(llm_manager=llm_manager, websocket_handler=None, intervention_service=intervention_service)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_state = {"segments": {}, "analysisStatus": {}}  # Initialize session state

    # Assign the websocket handler to analysis service
    analysis_service.ws = websocket

    try:
        while True:
            data = await websocket.receive_json()
            print("Received websocket message:", data)

            if data["type"] == "sync_state":
                session_state["segments"] = data.get("segments", {})
                session_state["analysisStatus"] = data.get("analysisStatus", {})

            elif data["type"] == "segment_update":
                uuid = data["uuid"]
                text = data["text"]
                question_idx = data["questionIdx"]
                segment_idx = data["segmentIdx"]
                all_segments = data.get("all_segments", {})
                logging.info(f"🔄 [WebSocket] Triggering analysis for UUID={data['uuid']}")
                logging.info(f"📎 [WebSocket] Analysis parameters: "
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
                await analysis_service.handle_segment_update(
                    uuid=uuid,
                    text=text,
                    question_idx=question_idx,
                    segment_idx=segment_idx,
                    all_segments=session_state["segments"]
                )

                # Log edit event
                logger.log({
                    "type": "segment_edit",
                    "uuid": uuid,
                    "data": data,
                 })

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
            
            elif data["type"] == "intervention_feedback":
                # Log feedback
                logger.log({
                    "type": "intervention_feedback",
                    "timestamp": data.get("timestamp"),
                    "interventionId": data.get("interventionId"),
                    "feedback": data
                })
                
                # # Send confirmation
                # await websocket.send_json({
                #     "type": "intervention_feedback_received",
                #     "interventionId": data.get("interventionId")
                # })

            elif data["type"] == "pause_analysis":
                await analysis_service.pause_analysis()
            
            elif data["type"] == "resume_analysis":
                await analysis_service.resume_analysis()
            # Handle other message types as needed

    except WebSocketDisconnect:
        print("Client disconnected")

# @app.get("/api/interventions/{uuid}")
# async def get_interventions(uuid: str):
#     """Get active interventions for a segment"""
#     return {
#         "interventions": intervention_service.get_interventions(uuid)
#     }

@app.post("/api/chat/message")
async def send_chat_message(data: dict):
    """Handle chat messages"""
    return await llm_manager.handle_chat_message(
        data["questionId"], 
        data["message"]
    )

@app.post("/api/survey/submit")
async def submit_survey(data: dict):
    """Submit final survey responses"""
    # TODO: Implement survey submission
    return {"status": "success"}