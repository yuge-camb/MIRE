export class WebSocketService {
  constructor(store) {
    console.log('WebSocket initialized with store:', store);
    this.store = store;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.messageQueue = [];
    this.status = 'disconnected';
    this.isIntentionalClose = false;
    this.connect();
    this.sessionId = null;
  }

  connect() {
    if (this.status === 'connecting') return;

    try {
      this.status = 'connecting';
      console.log('Attempting WebSocket connection...');

      this.ws = new WebSocket('ws://localhost:8000/ws');

      this.ws.onopen = () => {
        console.log('WebSocket Connected');
        this.status = 'connected';
        this.reconnectAttempts = 0;
        this.processQueue();
        // Send initial state using direct property access
        this.sendMessage({
          type: 'sync_state',
          segments: this.store.segments,
          analysisStatus: this.store.analysisStatus
        });
      };

      this.ws.onclose = (event) => {
        console.log(`WebSocket Closed: ${event.code} ${event.reason}`);
        if (!this.isIntentionalClose) {
          this.status = 'disconnected';
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log(`Attempting to reconnect in 1000ms (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.attemptReconnect(), 1000);
          } else {
            console.error('Max reconnect attempts reached');
          }
        }
      };

      this.ws.onerror = (event) => {
        console.error('WebSocket Error:', event);
        this.ws.close();
      };

      this.ws.onmessage = (event) => {
        console.log('WebSocket received:', event.data);
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (err) {
          console.error('Error parsing websocket message:', err);
        }
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      this.status = 'error';
    }
  }

  attemptReconnect() {
    this.reconnectAttempts++;
    this.connect();
  }

  handleMessage(data) {
    console.log('WebSocket received:', data);
    try {
      switch (data.type) {
        case 'analysis_status':
          console.log('Setting analysis status:', { uuid: data.uuid, status: data.status });
          this.store.setAnalysisStatus(data.uuid, data.status);
          break;

        case 'analysis_complete':
          if (data.interventions?.length) {
            data.interventions.forEach(intervention => {
              this.store.addIntervention({
                uuid: data.uuid,
                ...intervention
              });
            });
          }
          this.store.setAnalysisStatus(data.uuid, 'completed');
          break;

        case 'analysis_error':
          // Log full error object for debugging
          console.error('Analysis error:', {
            uuid: data.uuid,
            error: data.error,
            fullData: data
          });
          this.store.setAnalysisStatus(data.uuid, 'error');
          break;

        case 'intervention':
          this.store.addIntervention({
            uuid: data.uuid,
            ...data.intervention
          });
          break;
        
        //Requirement Generation Related
        case 'stability_response':
          this.store.handleStabilityResponse(data.questionId, data.isStable);
          break;
        
        case 'requirement_generation_complete':
          this.store.handleRequirementGenerationComplete(data.questionId, data.requirements);
          break;
        
        case 'requirement_generation_failed':
          this.store.handleRequirementGenerationFailed(data.questionId, data.error, data.details);
          break;
        
        case 'intervention_feedback_received':
          console.log('Feedback received confirmation:', data);
          break;
    
        case 'survey_submission_confirmed':
          console.log('Survey submission confirmed:', data);
          
          // Update UI status through store
          this.store.setSubmissionStatus('Survey data successfully logged! Redirecting to start page...');
          
          // Reset after delay
          setTimeout(() => {
              this.store.resetSurvey();
              this.store.setSurveyStarted(false);  
              this.store.setSubmissionStatus('');  
          }, 5000);
          break;

        default:
          console.warn('Unknown message type:', data.type);
      }
    } catch (err) {
      console.error('Error handling message:', err);
    }
  }

  handleAnalysisComplete(data) {
    const { uuid, results } = data;

    // Direct property access instead of get()
    if (!this.store.segments[uuid]) return;

    this.store.setAnalysisStatus(uuid, 'completed');

    if (results.interventions?.length > 0) {
      results.interventions.forEach(intervention => {
        if (intervention.type === 'inconsistency') {
          const referencedSegment = intervention.previousSegment.uuid;
          // Direct property access here too
          if (!this.store.segments[referencedSegment]) return;
        }
        this.store.addIntervention(uuid, intervention);
      });
    }
  }

  processQueue() {
    if (this.status !== 'connected') return;
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.sendMessage(message);
    }
  }

  sendMessage(message) {
    console.log('Sending WebSocket message:', message);
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.log('WebSocket not open, queueing message');
      if (this.status === 'connecting') {
        this.messageQueue.push(message);
        return;
      }
      this.attemptReconnect();
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (err) {
      console.error('Failed to send message:', err);
      this.messageQueue.push(message);
      this.attemptReconnect();
    }
  }


  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
    }
  }

  sendChatMessage(questionId, message) {
    this.sendMessage({
      type: 'chat_message',
      questionId,
      message
    });
  }

  sendSessionStart(sessionId, context, initiativeMode) {
    this.sessionId = sessionId;  // Store session ID
    this.sendMessage({
        type: 'session_start',
        sessionId: sessionId,
        context: context,
        initiativeMode: initiativeMode,
        timestamp: new Date().toISOString()
    });
}

  sendSegmentTiming(uuid, editStartTime, editEndTime, questionIdx, segmentIdx, text) {
    // Convert numeric timestamps to ISO strings
    const startTimeISO = new Date(editStartTime).toISOString();
    const endTimeISO = new Date(editEndTime).toISOString();
    this.sendMessage({
      type: 'segment_timing',
      uuid,
      edit_start_time: startTimeISO,
      edit_end_time: endTimeISO,
      editDuration: editEndTime - editStartTime,
      questionIdx,
      segmentIdx,
      text
    });
  }

  sendInterventionResponse(uuid, interventionId, response, newText = null, timingData = null) {
    this.sendMessage({
      type: 'intervention_response',
      uuid,
      interventionId,
      response,
      newText,
      ...timingData
    });
  }
  
  sendActivityTimeline(interventionId, activityTimeline) {
    this.sendMessage({
      type: 'activity_timeline',
      interventionId,
      timestamp: new Date().toISOString(),
      data: {
        events: activityTimeline.events,
        pauseResumeEvents: activityTimeline.pauseResumeEvents,
        startTime: activityTimeline.startTime,
        endTime: activityTimeline.endTime
      }
    });
  }

  sendInterventionFeedback(feedbackData) {
    this.sendMessage({
      type: 'intervention_feedback',
      ...feedbackData
    });
  }

  // Send stability check note based on soft timeout
  sendStabilityCheck(questionId) {
    this.sendMessage({
      type: 'stability_check',
      questionId,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId
    });
  }

  // Send message to generate requirements for a question
  sendGenerateRequirements(questionId, segments, triggerMode) {
    // Now receiving the full segment objects with {uuid, text} from useSurveyStore
    this.sendMessage({
      type: 'generate_requirements',
      questionId,
      segments,  // Already contains full segment objects
      triggerMode,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId
    });
  }

  // Send message to discard in-progress requirement generation
  sendDiscardRequirementGeneration(questionId) {
    this.sendMessage({
      type: 'discard_requirement_generation',
      questionId,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId
    });
  }
  
  sendSurveySubmission(answers) {
    if (!this.sessionId) {
        console.error('No active session found');
        return;
    }
    
    this.sendMessage({
        type: 'submit_survey',
        sessionId: this.sessionId,
        finalState: {
            answers,
            timestamp: new Date().toISOString()
        }
    });
}

  pauseAnalysis() {
    this.sendMessage({
      type: 'pause_analysis'
    });
  }

  resumeAnalysis() {
    this.sendMessage({
      type: 'resume_analysis'
    });
  }

  disconnect() {
    this.isIntentionalClose = true;
    if (this.ws) {
      this.ws.close();
      this.status = 'disconnected';
    }
  }
}