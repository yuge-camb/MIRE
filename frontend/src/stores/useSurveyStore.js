// useSurveyStore.js
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { apiService } from '../services/api';
import { WebSocketService } from '../services/websocket';

export const useSurveyStore = create(
  devtools(
    (set, get) => ({
      // State
      answers: {}, // Keep for backwards compatibility
      segments: {}, // {uuid: {text, questionIdx, segmentIdx}}
      analysisStatus: {}, // Track sent analyses status
      interventions: [], // [{id, uuid, type, ...interventionData}]
      segmentTimings: {}, // {uuid: {editStartTime: number}}
      chatHistory: {},
      debugMode: false,
      wsService: undefined,
      activeEditingSegment: null,
      activeChat: null,  // Add state for active chat
      lastAnalyzedTexts: {}, // tracks {uuid: lastAnalyzedText}
      interventionFeedback: [],
      segmentEdits: {}, // Track number of analysis-triggering edits per segment
      sessionId: null,
      submissionStatus: '',
      surveyStarted: false,
      // Activity Tracking State
      activityEvents: [], // Array of activity events
      pauseResumeEvents: [], // Array of pause/resume events
      isPaused: false,
      lastPauseStart: null,
      //Bulk Dismissal at survey end
      bulkDismissalMode: false, // Tracks if in bulk dismissal mode
      bulkDismissalInterventions: [], // Stores interventions marked for bulk dismissal

      // WebSocket Setup
      initializeWebSocket: () => {
        const wsService = new WebSocketService(get());
        set({ wsService });
      },

      disconnectWebSocket: () => {
        const { wsService } = get();
        if (wsService) {
          wsService.ws?.close();
          set({ wsService: undefined });
        }
      },

      // Session Management
      startSession: (sessionId) => set(state => {
        state.wsService?.sendSessionStart(sessionId);
        return { 
            sessionId
        };
      }),

      //Survey management
      setSubmissionStatus: (status) => {
        console.log('Setting submission status to:', status); 
        set({ submissionStatus: status });
      },

      setSurveyStarted: (started) => set({ surveyStarted: started }),

      resetSurvey: () => set(state => ({
        sessionId: null,
        answers: {},
        segments: {},
        analysisStatus: {},
        interventions: [],
        segmentTimings: {},
        lastAnalyzedTexts: {},
        segmentEdits: {},
        activityEvents: [],
        pauseResumeEvents: [],
        bulkDismissalMode: false, 
        bulkDismissalInterventions: [] 
      })),
      
      // Segment Management
      setAnswer: (questionId, segmentId, text, uuid) => set(state => ({
        segments: {
          ...state.segments,
          [uuid]: {
            text,
            questionIdx: questionId,
            segmentIdx: segmentId
          }
        },
        answers: {
          ...state.answers,
          [questionId]: {
            ...state.answers[questionId],
            [segmentId]: text
          }
        }
      })),

      addSegment: (questionId) => {
        const state = get();
        const nextId = Object.keys(state.answers[questionId] || {}).length;
        
        const uuid = uuidv4();
        set(state => ({
          segments: {
            ...state.segments,
            [uuid]: {
              text: '',
              questionIdx: questionId,
              segmentIdx: nextId
            }
          },
          answers: {
            ...state.answers,
            [questionId]: {
              ...state.answers[questionId],
              [nextId]: ''
            }
          }
        }));
      },

      // removeSegment: (uuid) => set(state => {
      //   // Check if segment exists
      //   if (!state.segments[uuid]) return state;

      //   const { [uuid]: removed, ...remainingSegments } = state.segments;
      //   const questionId = removed.questionIdx;
      //   const segmentToRemove = removed.segmentIdx;

      //   // Create new answers object excluding removed segment
      //   const newAnswers = { ...state.answers };
      //   if (questionId !== undefined) {
      //     const currentAnswers = state.answers[questionId] || {};
      //     delete currentAnswers[segmentToRemove];

      //     // Reindex remaining answers
      //     const reindexedAnswers = Object.values(currentAnswers)
      //       .reduce((acc, text, i) => {
      //         acc[i] = text;
      //         return acc;
      //       }, {});

      //     newAnswers[questionId] = reindexedAnswers;
      //   }

      //   // Also remove any analysis status
      //   const newAnalysisStatus = { ...state.analysisStatus };
      //   delete newAnalysisStatus[uuid];

      //   const { [uuid]: _, ...remainingAnalyzedTexts } = state.lastAnalyzedTexts;

      //   return {
      //     segments: remainingSegments,
      //     answers: newAnswers,
      //     analysisStatus: newAnalysisStatus,
      //     lastAnalyzedTexts: remainingAnalyzedTexts
      //   };
      // }),
      
      // Tracking segment edit start and end times
      setSegmentEditStart: (uuid) => set(state => ({
        segmentTimings: {
          ...state.segmentTimings,
          [uuid]: {
            editStartTime: Date.now(),
            questionIdx: state.segments[uuid]?.questionIdx,
            segmentIdx: state.segments[uuid]?.segmentIdx
          }
        }
      })),
      
      updateSegmentTiming: (uuid, text) => set(state => {
        const timing = state.segmentTimings[uuid];
        if (!timing?.editStartTime) return state;
        
        const editEndTime = Date.now();
        
        // Send timing data via WebSocket
        state.wsService?.sendSegmentTiming(
          uuid,
          timing.editStartTime,
          editEndTime,
          timing.questionIdx,
          timing.segmentIdx,
          text
        );

        // Clear the timing
        return {
          segmentTimings: {
            ...state.segmentTimings,
            [uuid]: {
              editStartTime: null
            }
          }
        };
      }),

      // Reusable function to analyze a segment if needed
      analyzeSegmentIfNeeded: (uuid, newText = undefined) => {
        const state = get();
        const segment = state.segments[uuid];
        // Accepts optional newText for intervention updates, otherwise uses current segment text for direct editing case
        const textToAnalyze = newText !== undefined ? newText : segment?.text;
        const lastAnalyzedText = state.lastAnalyzedTexts[uuid];

        if (textToAnalyze?.length >= 10 && 
            (lastAnalyzedText === undefined || textToAnalyze !== lastAnalyzedText)) {
          // Increment edit count when analysis is triggered
          const currentEditCount = state.segmentEdits[uuid] || 0;
          set({ segmentEdits: { ...state.segmentEdits, [uuid]: currentEditCount + 1 } });
          // Send segment update to server
          state.wsService?.sendMessage({
            type: 'segment_update',
            uuid: uuid,
            text: textToAnalyze,
            questionIdx: segment.questionIdx,
            segmentIdx: segment.segmentIdx,
            editCount: currentEditCount + 1,
            all_segments: state.segments  // Include all segments for consistency checks
          });

          return {
            analysisStatus: {
              ...state.analysisStatus,
              [uuid]: 'pending'
            },
            lastAnalyzedTexts: {
              ...state.lastAnalyzedTexts,
              [uuid]: textToAnalyze
            }
          };
        }

        return null;
      },

      // Edit State Management
      setActiveEditingSegment: (uuid) => set(state => {
        const prevActive = state.activeEditingSegment;

        if (prevActive && prevActive !== uuid) {
          const analysisUpdates = state.analyzeSegmentIfNeeded(prevActive);
          if (analysisUpdates) {
          // 1. Mark ALL interventions of edited segment as stale
          state.markAllInterventionsAsStale(prevActive);
          // 2. Mark only consistency interventions in other segments that reference this segment
          state.markConsistencyInterventionsAsStale(prevActive);
            return {
              activeEditingSegment: uuid,
              ...analysisUpdates
            };
          }
        }

        return { activeEditingSegment: uuid };
      }),
      
      // Analysis Status Management
      setAnalysisStatus: (uuid, status) => set(state => ({
        analysisStatus: {
          ...state.analysisStatus,
          [uuid]: status
        }
      })),
      
      // Methods for activity tracking
      // Dynamic windowing for activity events
      addActivityEvent: (event) => set(state => {
        if (state.isPaused) return state; 
        
        const WINDOW_SIZE = 120000; // 120 seconds buffer
        const currentTime = Date.now();
        
        // Add new event
        const newEvents = [...state.activityEvents, event];
        
        // Keep events based on their effective age (actual time minus pauses)
        return {
          activityEvents: newEvents.filter(e => {
            const eventAge = currentTime - e.timestamp;
            
            // Calculate total pause time since this event
            const pauseDuration = state.pauseResumeEvents
              .filter(p => p.timestamp > e.timestamp && p.timestamp <= currentTime)
              .reduce((total, pause, index, arr) => {
                if (pause.eventType === 'pause') {
                  const pauseEnd = arr[index + 1]?.timestamp || currentTime;
                  return total + (pauseEnd - pause.timestamp);
                }
                return total;
              }, 0);
            
            const effectiveAge = eventAge - pauseDuration;
            return effectiveAge <= WINDOW_SIZE;
          })
        };
      }),

      // Called when feedback form opens
      pauseActivityTracking: () => set(state => {
        if (state.isPaused) return state;

        const pauseEvent = {
          type: 'system',
          eventType: 'pause',
          timestamp: Date.now(),
          timestampString: new Date().toISOString()
        };

        return {
          isPaused: true,
          lastPauseStart: Date.now(),
          pauseResumeEvents: [...state.pauseResumeEvents, pauseEvent]
        };
      }),

      // Called when feedback form closes
      resumeActivityTracking: () => set(state => {
        if (!state.isPaused) return state;

        const resumeEvent = {
          type: 'system',
          eventType: 'resume',
          timestamp: Date.now(),
          timestampString: new Date().toISOString(),
          context: {
            pauseDuration: state.lastPauseStart ? Date.now() - state.lastPauseStart : 0
          }
        };

        return {
          isPaused: false,
          lastPauseStart: null,
          pauseResumeEvents: [...state.pauseResumeEvents, resumeEvent]
        };
      }),

      // Used when sending activity timeline to server
      getActivityTimeline: (responseTime) => {
        const state = get();
        const TARGET_DURATION = 60000; // Want 60s of activity, but might not have this much
        const endTime = responseTime;
        
        // Get all events up to response time, sorted newest to oldest
        const relevantEvents = state.activityEvents
          .filter(event => event.timestamp <= endTime)
          .sort((a, b) => b.timestamp - a.timestamp);
      
        // Take all events if we have less than 60s worth,
        // otherwise take events until we have 60s worth
        const timelineEvents = relevantEvents.length > 0 ? 
          [...relevantEvents].reverse() : // Reverse back to chronological order if we have events
          [];
          
        // Get the start time from either:
        // - First event timestamp if we have events
        // - Response time if we somehow have no events
        const startTime = timelineEvents.length > 0 ? 
          timelineEvents[0].timestamp : 
          endTime;
      
        // Get all pause/resume events in this period
        const timelinePauses = state.pauseResumeEvents.filter(
          event => event.timestamp >= startTime && event.timestamp <= endTime
        );
      
        return {
          events: timelineEvents,
          pauseResumeEvents: timelinePauses,
          startTime,
          endTime,
          // Include information about whether this is a full 60s window
          isFullDuration: (endTime - startTime) >= TARGET_DURATION
        };
      },

      // Intervention Management
      addIntervention: (intervention) => set(state => ({
        interventions: [...state.interventions, {
          ...intervention,
          response: null,
          responseTime: null,
          appearanceTime: Date.now(),
          firstInteractionTime: null, 

        }]
      })),

      trackInterventionInteraction: (interventionId) => set(state => ({
        interventions: state.interventions.map(int =>
          int.id === interventionId && !int.firstInteractionTime
            ? { ...int, firstInteractionTime: Date.now() }
            : int
        )
      })),

      // Count active interventions - excluding stale ones
      getActiveInterventions: (targetUuid = null) => {
        const state = get();
        // Filter active interventions - exclude stale ones
        const activeInterventions = state.interventions.filter(int => 
          int && 
          !int.response && 
          !int.responseTime &&
          !int.isStale
        );
    
        return {
          total: activeInterventions.length,
          forSegment: targetUuid ? 
            activeInterventions.filter(int => int.uuid === targetUuid).length : 
            0
        };
      },

      respondToIntervention: (interventionId, response, newText = null, targetUuid = null) => set(state => {
        // Always update intervention status
        const updatedInterventions = state.interventions.map(int =>
          int.id === interventionId
            ? { ...int, response, responseTime: Date.now(), feedbackSubmitted: false }
            : int
        );
        
        // Find the intervention to get context
        const intervention = state.interventions.find(i => i.id === interventionId);
        if (!intervention) {
          return { interventions: updatedInterventions };
        }

        // Send intervention response with timing data
        const responseTime = Date.now();
        // Send intervention response with number of active interventions at the time of response
        const activeCount = state.getActiveInterventions(intervention.uuid);
        state.wsService?.sendInterventionResponse(
          intervention.uuid,
          interventionId,
          response,
          newText,
          {
            appearanceTime: new Date(intervention.appearanceTime).toISOString(),
            firstInteractionTime: new Date(intervention.firstInteractionTime).toISOString(),
            responseTime: new Date(responseTime).toISOString(),
            interactionLatency: intervention.firstInteractionTime - intervention.appearanceTime,
            responseLatency: responseTime - intervention.appearanceTime,
            activeInterventionsAtResponse: activeCount
          }
        );
        const timeline = state.getActivityTimeline(responseTime);
        state.wsService?.sendActivityTimeline(interventionId, timeline);

        // If no text update needed, just return intervention update
        if (!newText) {
          return { interventions: updatedInterventions };
        }
      
        // Determine which UUID to update
        const uuid = targetUuid || intervention.uuid;
        const segment = state.segments[uuid];
        // // Dealing with removed segments
        // if (!segment) {
        //   return { interventions: updatedInterventions };
        // }
      
        // First determine which segments we updated
        const currentUuid = intervention.uuid;
        const previousUuid = targetUuid; // Will be null for current segment edits

        let baseUpdate = {
          interventions: updatedInterventions,
          segments: {
            ...state.segments,
            [uuid]: {
              ...segment,
              text: newText
            }
          },
          answers: {
            ...state.answers,
            [segment.questionIdx]: {
              ...state.answers[segment.questionIdx],
              [segment.segmentIdx]: newText
            }
          }
        };

        // Check active interventions for relevant segments
        const currentSegmentActiveInterventions = updatedInterventions.filter(int => 
          int.uuid === currentUuid && 
          !int.response && 
          !int.responseTime
        );

        // Determine if we should trigger analysis based on our rules
        if (currentSegmentActiveInterventions.length === 0) {
          const currentAnalysisUpdates = state.analyzeSegmentIfNeeded(currentUuid, newText);
          if (currentAnalysisUpdates) {
            // 1. Mark consistency interventions in other segments stale
            state.markConsistencyInterventionsAsStale(currentUuid);
            baseUpdate = {
              ...baseUpdate,
              ...currentAnalysisUpdates
            };
          }
        }
        // // If we're editing a previous segment, also check its active interventions
        // let previousSegmentActiveInterventions = [];
        // if (previousUuid) {
        //   previousSegmentActiveInterventions = updatedInterventions.filter(int => 
        //     int.uuid === previousUuid && 
        //     !int.response && 
        //     !int.responseTime
        //   );
        // }
        // // Additionally check for each previous segment after finish dealing with all current segment interventions
        // if (previousUuid && previousSegmentActiveInterventions.length === 0) {
        //   const previousAnalysisUpdates = state.analyzeSegmentIfNeeded(previousUuid, newText);
        //   if (previousAnalysisUpdates) {
        //     baseUpdate = {
        //       ...baseUpdate,
        //       ...previousAnalysisUpdates
        //     };
        //   }
        // }

        return baseUpdate;
      }),

      // Marking active interventions for direct/cross-reference interventions stale when edits take place
      // Helper function to mark consistency interventions stale
      markConsistencyInterventionsAsStale: (targetUuid) => set(state => ({
        interventions: state.interventions.map(int => {
          // Only mark consistency interventions that reference the target UUID
          if (int.type === 'consistency' && 
            (int.previous_segment?.uuid === targetUuid || int.current_segment?.uuid === targetUuid)) {
            return { ...int, isStale: true };
          }
          return int;
        })
      })),

      // Function to mark all interventions of a segment stale
      markAllInterventionsAsStale: (uuid) => set(state => ({
        interventions: state.interventions.map(int => 
          int.uuid === uuid ? { ...int, isStale: true } : int
        )
      })),


      // Intervention Feedback Management
      submitInterventionFeedback: (interventionId, feedbackData) => set(state => {
        const intervention = state.interventions.find(i => i.id === interventionId);
        if (!intervention) return state;
      
        const updatedInterventions = state.interventions.map(int =>
          int.id === interventionId
            ? { ...int, feedbackSubmitted: true }
            : int
        );
        state.wsService?.sendInterventionFeedback(feedbackData);
      
        return {
          interventions: updatedInterventions,
          interventionFeedback: [
            ...state.interventionFeedback,
            feedbackData
          ]
        };
      }),
      //Bulk Dismissal
      setBulkDismissalMode: (enabled) => set({ 
        bulkDismissalMode: enabled,
        // Clear bulk interventions when disabling
        bulkDismissalInterventions: enabled ? get().bulkDismissalInterventions : []
      }),
      
      // Mark all active interventions for bulk dismissal
      startBulkDismissal: () => set(state => {
        const activeInterventions = state.interventions.filter(int => 
          !int.response && 
          !int.responseTime && 
          !int.isStale
        );
        
        return {
          bulkDismissalMode: true,
          bulkDismissalInterventions: activeInterventions
        };
      }),
      
      // Handle bulk feedback submission
      submitBulkFeedback: (feedbackData) => set(state => {
        // For each intervention in bulk list
        state.bulkDismissalInterventions.forEach(int => {
          // Use existing respondToIntervention logic
          state.respondToIntervention(
            int.id, 
            'dismiss', // Same response as individual dismiss
            null,      // No text changes for dismiss
            null,       // No target UUID needed
            true       // Add parameter to mark feedback as submitted immediately
          );
          
          // Then submit feedback using existing method
          state.submitInterventionFeedback(int.id, feedbackData);
        });

        return {
          bulkDismissalMode: false,
          bulkDismissalInterventions: []
        };
      }),

      // Instruction Panel
      showInstructions: false,

      // Add these methods to the store
      toggleInstructions: () => set(state => ({ 
        showInstructions: !state.showInstructions 
      })),

      setShowInstructions: (show) => set({ 
        showInstructions: show 
      }),
      
      // Debug Helpers
      setDebugMode: (enabled) => set({ debugMode: enabled }),
      toggleDebugMode: () => set(state => ({ 
        debugMode: !state.debugMode 
      })),

      // Chat Management
      addChatMessage: (questionId, message, isUser = true) => set(state => ({
        chatHistory: {
          ...state.chatHistory,
          [questionId]: [
            ...(state.chatHistory[questionId] || []),
            { message, isUser, timestamp: Date.now() }
          ]
        }
      })),
      setActiveChat: (questionId) => set({ 
        activeChat: questionId 
      })
    })
  )
);