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
        
        case 'intervention_status':
          // Handle intervention status updates
          break;
  
        case 'analysis_cancelled':
          // Handle cancelled analysis confirmation
          this.store.setAnalysisStatus(data.uuid, 'cancelled');
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

  handleInvalidSegment(uuid) {
    // Clear any pending analysis status
    this.store.setAnalysisStatus(uuid, null);
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

  getStatus() {
    return this.status;
  }

  // sendAnalysisRequest(data) {
  //   // Convert segments to dictionary format
  //   console.log('🔄 [Frontend] Sending analysis request:', {
  //       uuid: data.uuid,
  //       text: data.text,
  //       questionIdx: data.questionIdx,
  //       segmentIdx: data.segmentIdx
  //   });
  //   const all_segments = {};
  //   Object.entries(this.store.segments).forEach(([uuid, segment]) => {
  //       all_segments[uuid] = {
  //           text: segment.text,
  //           question_idx: segment.questionIdx,
  //           segment_idx: segment.segmentIdx
  //       }
  //   });

  //   this.sendMessage({
  //       type: 'segment_update',
  //       uuid: data.uuid,
  //       text: data.text,
  //       question_idx: data.questionIdx,     
  //       segment_idx: data.segmentIdx,       
  //       all_segments                        
  //   });
  // }

  sendChatMessage(questionId, message) {
    this.sendMessage({
      type: 'chat_message',
      questionId,
      message
    });
  }

  // sendSegmentUpdate(uuid, data) {
  //   this.sendMessage({
  //     type: 'segment_update',
  //     uuid,
  //     question_idx: data.questionIdx,     
  //     segment_idx: data.segmentIdx,       
  //     text: data.text
  //   });
  // }

  sendSegmentDelete(uuid) {
    this.sendMessage({
      type: 'segment_delete',
      uuid
    });
  }

  sendInterventionResponse(uuid, interventionId, response, newText = null) {
    this.sendMessage({
      type: 'intervention_response',
      uuid,
      interventionId,
      response,
      newText
    });
  }
  
  cancelAnalysis(uuid) {
    this.sendMessage({
      type: 'analysis_cancel',
      uuid
    });
  }
  
  clearAnalysisQueue(uuid) {
    this.sendMessage({
      type: 'analysis_queue_clear',
      uuid
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
