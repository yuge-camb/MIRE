// useSurveyStore.js
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
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
      //Intervention mode (auto/manual)
      interventionMode: 'on', // 'on' or 'off'
      //Display mode
      globalDisplayMode: 'default', // 'default', 'panel' or 'inline'
      max_panel_count: 3, // Maximum number of panel interventions
      //Inactivity tracking for requirement generation
      inactivityTimers: {}, // Tracks timer IDs by question ID: { [questionId]: { softTimer, hardTimer } }
      lastActivityTime: {}, // Tracks last activity timestamp by question ID
      activeTimerQuestions: new Set(), // Tracks which questions have active timers
      //Configuration constants
      softInactivityThreshold: 10000, // 30 seconds for stability check
      hardInactivityThreshold: 120000, // 120 seconds for forced generation
      //Requirement generation
      segmentRequirementState: {}, // Maps segment UUIDs to their requirement state: 'needs_generation', 'generating', 'no_need_generation'
      pendingRequirementGeneration: {}, // Tracks which questions have pending generation requests
      //Requirement panel management
      requirements: {}, // Organized by questionId: { [questionId]: [requirement objects] }
      requirementStates: {}, // Track status by requirementId: { [requirementId]: 'pending'|'validated'|'rejected' }
      requirementRatings: {}, // Store ratings: { [requirementId]: 1-5 }
      generationErrors: {}, // Store requirement generation errors by questionId
      // User study mode management
      initiativeMode: 'mixed', // 'mixed' or 'fixed' - controls initiative mode

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
      startSession: (sessionId, context, initiativeMode) => set(state => {
        state.wsService?.sendSessionStart(sessionId, context, initiativeMode);
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
        bulkDismissalInterventions: [],
        // Also reset timer-related state
        inactivityTimers: {},
        activeTimerQuestions: new Set(),
        lastActivityTime: {},
        pendingRequirementGeneration: {},
        segmentRequirementState: {},
        requirements: {}, 
        requirementStates: {},
        requirementRatings: {},
        generationErrors: {},
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
      analyzeSegmentIfNeeded: (uuid, newText = undefined, isManualTrigger = false) => {
        const state = get();
        const segment = state.segments[uuid];
        // Accepts optional newText for intervention updates, otherwise uses current segment text for direct editing case
        const textToAnalyze = newText !== undefined ? newText : segment?.text;
        const lastAnalyzedText = state.lastAnalyzedTexts[uuid];

        if (textToAnalyze?.length >= 5 && 
            (lastAnalyzedText === undefined || textToAnalyze !== lastAnalyzedText)) {
          // Increment edit count when analysis is triggered
          const currentEditCount = state.segmentEdits[uuid] || 0;
          set({ segmentEdits: { ...state.segmentEdits, [uuid]: currentEditCount + 1 } });
          
          // Get question ID for this segment
          const questionId = segment?.questionIdx;
          // Start timer if needed for this question
          if (questionId !== undefined && !isManualTrigger) {
            state.startTimerIfNeeded(questionId);
          }

          // Check if segment had requirements and handle that separately
          const wasInNoNeedGeneration = state.segmentRequirementState[uuid] === 'no_need_generation';
          if (wasInNoNeedGeneration && !isManualTrigger) {
            // Handle requirement updates in a separate function to avoid cascading method calls
            state.handleSegmentChangeWithRequirements(uuid);
          }

          // Send segment update to server
          state.wsService?.sendMessage({
            type: 'segment_update',
            uuid: uuid,
            text: textToAnalyze,
            questionIdx: segment.questionIdx,
            segmentIdx: segment.segmentIdx,
            interventionMode: state.interventionMode,
            isManualTrigger: isManualTrigger,
            editCount: currentEditCount + 1,
            all_segments: state.segments  // Include all segments for consistency checks
          });

          // Update lastAnalyzedText when either:
          // 1. Automatic analysis is happening (intervention mode is 'on')
          // 2. Manual analysis is triggered (isManualTrigger is true)
          const shouldUpdateLastAnalyzedText = state.interventionMode === 'on' || isManualTrigger;
          
          return {
            analysisStatus: {
              ...state.analysisStatus,
              [uuid]: 'pending'
            },
            lastAnalyzedTexts: shouldUpdateLastAnalyzedText ? {
              ...state.lastAnalyzedTexts,
              [uuid]: textToAnalyze
            } : state.lastAnalyzedTexts
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
      addIntervention: (intervention) => set(state => {
        // Base update with new intervention
        const update = {
          interventions: [...state.interventions, {
            ...intervention,
            response: null,
            responseTime: null,
            appearanceTime: Date.now(),
            firstInteractionTime: null, 
          }]
        };
        
        // Only reset display mode to default in mixed initiative mode
        if (state.initiativeMode === 'mixed') {
          update.globalDisplayMode = 'default';
        }
        
        return update;
      }),

      trackInterventionInteraction: (interventionId) => {
        // First get the intervention
        const state = get();
        const intervention = state.interventions.find(int => int.id === interventionId);
        
        if (intervention) {
          // Get the segment UUID from the intervention
          const segmentUuid = intervention.uuid;
          
          // Find the segment to get its question ID
          const segment = state.segments[segmentUuid];
          const questionId = segment.questionIdx;
          // Reset the timer when there are intervention interactions
          state.resetTimerIfActive(questionId);
        }
        
        // Update intervention state (this part stays the same)
        set(state => ({
          interventions: state.interventions.map(int =>
            int.id === interventionId && !int.firstInteractionTime
              ? { ...int, firstInteractionTime: Date.now() }
              : int
          )
        }));
      },

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
            globalmode: state.globalDisplayMode,
            mode: state.getInterventionDisplayMode(intervention),
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

        // Reset timer when responding to interventions
        state.resetTimerIfActive(segment.questionId);
      
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

      // Intervention Display Mode
      setGlobalDisplayMode: (mode) => set({ 
        globalDisplayMode: mode 
      }),

      getInterventionDisplayMode: (intervention) => {
        const state = get();
        
        // Helper function that applies confidence thresholds for each intervention type
        const meetsConfidenceThreshold = (intervention) => {
          const confidence = intervention.confidence || 0.5;
          
          switch(intervention.type) {
            case 'ambiguity_multiple_choice':
              return confidence > 0.8;
            case 'ambiguity_clarification':
              return confidence > 0.6;
            case 'consistency':
              return confidence > 0.95;
            default:
              return true;
          }
        };
        
        // If global mode is explicitly set, use that
        if (state.globalDisplayMode !== 'default') {
          return state.globalDisplayMode;
        }
        
        // Get question index for this intervention
        const questionIdx = intervention.questionIdx || 
                          state.segments[intervention.uuid]?.questionIdx || 
                          0;
        
        // Get all active interventions for this question
        const interventionsForThisQuestion = state.interventions.filter(int => {
          // Only include active interventions
          if (int.response || int.responseTime || int.isStale) {
            return false;
          }
          
          // Get the question index for this intervention
          const intQuestionIdx = int.questionIdx || 
                                state.segments[int.uuid]?.questionIdx || 
                                0;
          
          // Only include interventions for the same question
          return intQuestionIdx === questionIdx;
        });
        
        // Count interventions already in panel mode
        const panelInterventionsCount = interventionsForThisQuestion.filter(int => {
          if (state.globalDisplayMode === 'default') {
            // If in default mode, count ones that would be in panel based on confidence
            return meetsConfidenceThreshold(int);
          } else {
            // Otherwise, check the actual display mode
            return state.getInterventionDisplayMode(int) === 'panel';
          }
        }).length;

        // If we have fewer than max_panel_count panel interventions and this one meets the threshold,
        // it can be in panel mode
        if (panelInterventionsCount < state.max_panel_count && meetsConfidenceThreshold(intervention)) {
          return 'panel';
        }
        
        // If we would have more than 3 panel interventions, rank by confidence
        if (panelInterventionsCount >= state.max_panel_count) {
        // Get type priority (ambiguity_choice first, then others)
        const getTypePriority = (intervention) => {
          if (intervention.type === 'ambiguity_multiple_choice') return 1;
          return 2;
        };

        // When sorting interventions:
        const sortedInterventions = [...interventionsForThisQuestion]
          .filter(int => meetsConfidenceThreshold(int))
          .sort((a, b) => {
            // First sort by type priority
            const typePriorityDiff = getTypePriority(a) - getTypePriority(b);
            if (typePriorityDiff !== 0) return typePriorityDiff;
            
            // Then by confidence if type priority is the same
            return (b.confidence || 0) - (a.confidence || 0);
          });
          
          // Find this intervention's position in the sorted list
          const position = sortedInterventions.findIndex(int => int.id === intervention.id);
          
          // If it's within the max_panel_count, show in panel
          if (position < state.max_panel_count) {
            return 'panel';
          }
        }
        
        // Default to inline for all other cases
        return 'inline';
      },

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
      
      // Mark all active interventions for bulk dismissal
      startBulkDismissal: () => set(state => {
        const activeInterventions = state.interventions.filter(int => 
          !int.response && 
          !int.responseTime && 
          !int.isStale
        );
        // Immediately respond to all active interventions
        activeInterventions.forEach(intervention => {
          state.respondToIntervention(
            intervention.id,
            'dismiss', // Use 'dismiss' as the response
            null,      // No text changes
            null       // No target UUID needed
          );
        });
        return {};
        // return {
        //   bulkDismissalMode: true,
        //   bulkDismissalInterventions: activeInterventions
        // };
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

      toggleInstructions: () => set(state => ({ 
        showInstructions: !state.showInstructions 
      })),

      setShowInstructions: (show) => set({ 
        showInstructions: show 
      }),

      // Intervention mode toggle
      toggleInterventionMode: () => set(state => {
        // Don't allow toggling intervention mode in fixed initiative mode
        if (state.initiativeMode === 'fixed') return state;
        
        // Normal toggle for mixed mode
        return { 
          interventionMode: state.interventionMode === 'on' ? 'off' : 'on' 
        };
      }),

      // Manual analysis trigger when intervention mode is off
      triggerManualAnalysis: (uuid) => set(state => {
        const updates = state.analyzeSegmentIfNeeded(uuid, undefined, true);
        
        if (updates) {
          console.log(`Manual analysis triggered for segment ${uuid}`);
          return updates; 
        }
        console.log(`Analysis has been made for the segment content`);
        return {};
      }),

      // Requirement Generation Methods
      // For starting the inactivity timer (only happens with first segment update for a question with segments needing generation)
      startTimerIfNeeded: (questionId) => {
        const state = get();
        
        // Only start if not already tracking AND has segments needing generation
        if (!state.activeTimerQuestions.has(questionId) && 
            state.questionHasSegmentsNeedingGeneration(questionId)) {
          state.startInactivityMonitor(questionId);
        }
      },

      // For resetting the timer (any activity after started)
      resetTimerIfActive: (questionId) => {
        // Just call recordQuestionActivity which already has the check
        // Called in response to segment edit, intervention interactions, and intervention responses
        get().recordQuestionActivity(questionId);
      },

      // Start inactivity monitoring for a question
      startInactivityMonitor: (questionId) => set(state => {
        // Skip timer in fixed mode
        if (state.initiativeMode === "fixed") return state;

        console.log(`Starting inactivity monitor for question ${questionId}`);
        
        // Clear any existing timers
        if (state.inactivityTimers[questionId]) {
          if (state.inactivityTimers[questionId].softTimer) {
            clearTimeout(state.inactivityTimers[questionId].softTimer);
          }
          if (state.inactivityTimers[questionId].hardTimer) {
            clearTimeout(state.inactivityTimers[questionId].hardTimer);
          }
        }
        
        const now = Date.now();
        
        // Create new timers
        const softTimerId = setTimeout(() => {
          const currentState = get();
          currentState.handleSoftInactivityTimeout(questionId);
        }, state.softInactivityThreshold);
        
        const hardTimerId = setTimeout(() => {
          const currentState = get();
          currentState.handleHardInactivityTimeout(questionId);
        }, state.hardInactivityThreshold);
        
        // Add to active timer questions set
        const newActiveTimers = new Set(state.activeTimerQuestions);
        newActiveTimers.add(questionId);
        
        return {
          inactivityTimers: {
            ...state.inactivityTimers,
            [questionId]: {
              softTimer: softTimerId,
              hardTimer: hardTimerId
            }
          },
          lastActivityTime: {
            ...state.lastActivityTime,
            [questionId]: now
          },
          activeTimerQuestions: newActiveTimers
        };
      }),

      // Record activity for a question
      recordQuestionActivity: (questionId) => set(state => {
        // Only update if we're tracking this question
        if (!state.activeTimerQuestions.has(questionId)) {
          return state;
        }
        
        console.log(`Activity recorded for question ${questionId}`);

        // Check if this question has pending generation
        if (state.pendingRequirementGeneration[questionId]) {
          state.handleEditDuringGeneration(questionId);
        }
        
        // Clear existing timers if any
        if (state.inactivityTimers[questionId]) {
          if (state.inactivityTimers[questionId].softTimer) {
            clearTimeout(state.inactivityTimers[questionId].softTimer);
          }
          if (state.inactivityTimers[questionId].hardTimer) {
            clearTimeout(state.inactivityTimers[questionId].hardTimer);
          }
        }
        
        // Restart timers
        const softTimerId = setTimeout(() => {
          const currentState = get();
          currentState.handleSoftInactivityTimeout(questionId);
        }, state.softInactivityThreshold);
        
        const hardTimerId = setTimeout(() => {
          const currentState = get();
          currentState.handleHardInactivityTimeout(questionId);
        }, state.hardInactivityThreshold);
        
        return {
          lastActivityTime: {
            ...state.lastActivityTime,
            [questionId]: Date.now()
          },
          inactivityTimers: {
            ...state.inactivityTimers,
            [questionId]: {
              softTimer: softTimerId,
              hardTimer: hardTimerId
            }
          }
        };
      }),

      // Handle 30s inactivity timeout
      handleSoftInactivityTimeout: (questionId) => {
        console.log(`Soft inactivity timeout (30s) for question ${questionId}`);
        
        const state = get();
        
        // Verify this question is still being tracked
        if (!state.activeTimerQuestions.has(questionId)) {
          return;
        }
        
        // Send stability check request
        if (state.wsService) {
          state.wsService.sendStabilityCheck(questionId);
        }
      },

      // Handle 120s inactivity timeout
      handleHardInactivityTimeout: (questionId) => {
        console.log(`Hard inactivity timeout (120s) for question ${questionId}`);
        
        const state = get();
        
        // Verify this question is still being tracked
        if (!state.activeTimerQuestions.has(questionId)) {
          return;
        }
        
        // Trigger requirement generation with timeout as trigger
        state.generateRequirements(questionId, 'timeout');
      },

      // Handle returned backend stability response
      handleStabilityResponse: (questionId, isStable) => {
        console.log(`Stability response for question ${questionId}: ${isStable ? 'stable' : 'not stable'}`);
        
        const state = get();
    
        // Only proceed if we're still tracking this question AND
        // the timer has been running for at least 30s (not reset)
        if (state.activeTimerQuestions.has(questionId) && isStable) {
            // Check if timer has been running for at least 30s
            const lastActivity = state.lastActivityTime[questionId] || 0;
            const timeElapsed = Date.now() - lastActivity;
            
            if (timeElapsed >= state.softInactivityThreshold) {
                // Trigger requirement generation with stability as trigger
                state.generateRequirements(questionId, 'stability');
            } else {
                console.log(`Ignoring stability response - timer was reset`);

            }
        }
        // If not stable, do nothing - keep tracking
      },

      // Requirement generated in three cases: manual, timeout, stability
      generateRequirements: (questionId, triggerMode) => {
        const state = get();
        // Check if generation is already pending for this question
        if (state.pendingRequirementGeneration[questionId]) {
          console.log(`Requirements generation already pending for question ${questionId}, skipping`);
          return;
        }
        if (!state.questionHasSegmentsNeedingGeneration(questionId)) {
          console.log('No segments need generation for this question, skipping');
          return;
        }
        console.log(`Generating requirements for question ${questionId}, mode: ${triggerMode}`);
        
        // Get segment UUIDs and full text for this question that need generation
        const segmentsToGenerate = Object.entries(state.segments)
          .filter(([uuid, segment]) => {
            return segment.questionIdx === questionId && 
                  state.segmentRequirementState[uuid] === 'needs_generation';
          })
          .map(([uuid, segment]) => ({
            uuid: uuid,
            text: segment.text || ""  // Include the full segment text
          }));
        
        // Mark segments as generating
        state.markSegmentsAsGenerating(segmentsToGenerate.map(s => s.uuid));
        
        // Clear timers but keep activetimer state on
        if (state.inactivityTimers[questionId]) {
          if (state.inactivityTimers[questionId].softTimer) {
            clearTimeout(state.inactivityTimers[questionId].softTimer);
          }
          if (state.inactivityTimers[questionId].hardTimer) {
            clearTimeout(state.inactivityTimers[questionId].hardTimer);
          }
        }
        
        // Send message to backend with full segment objects
        if (state.wsService) {
          state.wsService.sendGenerateRequirements(questionId, segmentsToGenerate, triggerMode);
        }
        
        // Mark question as having pending requirement generation
        set(state => ({
          pendingRequirementGeneration: {
            ...state.pendingRequirementGeneration,
            [questionId]: true
          }
        }));
      },

      handleManualGenerateRequirements: (questionId) => {
        const state = get();
        
        // Trigger requirement generation with manual as trigger
        state.generateRequirements(questionId, 'manual');
      },

      // Handle requirement generation complete
      handleRequirementGenerationComplete: (questionId, requirements) => set(state => {
        console.log(`Requirement generation complete for question ${questionId}`);
        
        // Get all segments for this question that were in 'generating' state
        const questionSegments = Object.entries(state.segments)
          .filter(([uuid, segment]) => 
            segment.questionIdx === questionId && 
            state.segmentRequirementState[uuid] === 'generating'
          )
          .map(([uuid]) => uuid);
        
        // Mark all segments as 'no_need_generation'
        const updatedStates = { ...state.segmentRequirementState };
        questionSegments.forEach(uuid => {
          updatedStates[uuid] = 'no_need_generation';
        });
        
        // Add unique IDs to requirements if not present
        const requirementsWithIds = requirements.map(req => ({
          ...req,
          id: req.id || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }));
        
        // Initialize requirement states
        const newRequirementStates = { ...state.requirementStates };
        requirementsWithIds.forEach(req => {
          newRequirementStates[req.id] = 'pending';
        });
        
        // Remove pending flag
        const { [questionId]: _, ...remainingPending } = state.pendingRequirementGeneration;
        
          // Clear any existing generation errors for this question
        const updatedGenerationErrors = { ...state.generationErrors };
        delete updatedGenerationErrors[questionId];

        // NOW stop monitoring this question
        state.stopInactivityMonitor(questionId);

        // APPEND new requirements instead of replacing
        const existingRequirements = state.requirements[questionId] || [];
        
        return {
          segmentRequirementState: updatedStates,
          pendingRequirementGeneration: remainingPending,
          requirements: {
            ...state.requirements,
            [questionId]: [...existingRequirements, ...requirementsWithIds]
          },
          requirementStates: newRequirementStates,
          generationErrors: updatedGenerationErrors
        };
      }),

      // Method to handle requirement generation failure
      handleRequirementGenerationFailed: (questionId, error, details = null) => set(state => {
        console.error(`Requirement generation failed for question ${questionId}: ${error}`, details);
        
        // Get all segments for this question that were in 'generating' state
        const questionSegments = Object.entries(state.segments)
          .filter(([uuid, segment]) => 
            segment.questionIdx === questionId && 
            state.segmentRequirementState[uuid] === 'generating'
          )
          .map(([uuid]) => uuid);
        
        // Mark all segments as 'needs_generation' so user can retry
        const updatedStates = { ...state.segmentRequirementState };
        questionSegments.forEach(uuid => {
          updatedStates[uuid] = 'needs_generation';
        });
        
        // Remove pending flag
        const { [questionId]: _, ...remainingPending } = state.pendingRequirementGeneration;
        
        // Stop monitoring this question
        state.stopInactivityMonitor(questionId);
        
        return {
          segmentRequirementState: updatedStates,
          pendingRequirementGeneration: remainingPending,
          // Store the error for display
          generationErrors: {
            ...state.generationErrors,
            [questionId]: {
              error,
              details,
              timestamp: Date.now()
            }
          }
        };
      }),

      // Stop inactivity monitoring for a question
      stopInactivityMonitor: (questionId) => set(state => {
        console.log(`Stopping inactivity monitor for question ${questionId}`);

        // Update active timer questions set
        const newActiveTimers = new Set(state.activeTimerQuestions);
        newActiveTimers.delete(questionId);
        
        // Remove timers from state
        const { [questionId]: _, ...remainingTimers } = state.inactivityTimers;
        
        return {
          inactivityTimers: remainingTimers,
          activeTimerQuestions: newActiveTimers
        };
      }),

      // Method to mark one segment as needing generation
      markSegmentAsNeedsGeneration: (uuid) => set(state => ({
        segmentRequirementState: {
          ...state.segmentRequirementState,
          [uuid]: 'needs_generation'
        }
      })),

      // Method to mark segments as generating
      markSegmentsAsGenerating: (segmentUuids) => set(state => {
        const updatedStates = { ...state.segmentRequirementState };
        
        segmentUuids.forEach(uuid => {
          updatedStates[uuid] = 'generating';
        });
        
        return {
          segmentRequirementState: updatedStates
        };
      }),

      // Check if a question has segments needing generation
      questionHasSegmentsNeedingGeneration: (questionId) => {
        const state = get();
        
        // Get segment UUIDs for this question
        const questionSegmentUuids = Object.entries(state.segments)
          .filter(([_, segment]) => segment.questionIdx === questionId)
          .map(([uuid]) => uuid);
        
        // Check if any segment needs generation
        return questionSegmentUuids.some(uuid => {
          const reqState = state.segmentRequirementState[uuid];
          return reqState === 'needs_generation';
        });
      },

      // Method to handle new edits during requirement generation
      handleEditDuringGeneration: (questionId) => set(state => {
         // Remove pending flag
         const { [questionId]: _, ...remainingPending } = state.pendingRequirementGeneration;

        // Get all segments for this question
        const questionSegments = Object.entries(state.segments)
          .filter(([_, segment]) => segment.questionIdx === questionId)
          .map(([uuid]) => uuid);
        
        // Get segments currently in 'generating' state
        const generatingSegments = questionSegments.filter(uuid => 
          state.segmentRequirementState[uuid] === 'generating'
        );
        
        // Reset all generating segments back to 'needs_generation'
        const updatedStates = { ...state.segmentRequirementState };
        generatingSegments.forEach(uuid => {
          updatedStates[uuid] = 'needs_generation';
        });
        
        // Send message to backend to discard results
        if (state.wsService) {
          state.wsService.sendDiscardRequirementGeneration(questionId);
        }
        
        return {
          segmentRequirementState: updatedStates,
          pendingRequirementGeneration: remainingPending
        };
      }),

      // Method to handle changes to a segment after requirement generated for it (in pending/validated mode)
      handleSegmentChangeWithRequirements: (uuid) => {
        // Get current state outside of the set function
        const state = get();
        const segment = state.segments[uuid];
        const questionId = segment?.questionIdx;
        console.log(`[handleSegmentChangeWithRequirements] Extracted questionId: ${questionId}`);
        
        // Find linked requirements
        const linkedRequirements = [];
        Object.entries(state.requirements).forEach(([qId, reqList]) => {
          reqList.forEach(req => {
            const reqState = state.requirementStates[req.id];
            // Only include requirements that are pending or validated
            if (req.segments && 
                req.segments.includes(uuid) && 
                (reqState === 'pending' || reqState === 'validated')) {
              linkedRequirements.push(req);
            }
          });
        });
        console.log(`[handleSegmentChangeWithRequirements] Found ${linkedRequirements.length} linked requirements`);
        
        // All segments that need to be marked as needs_generation
        const segmentsToUpdate = new Set();
        segmentsToUpdate.add(uuid);
        
        // Add all segments from linked requirements
        linkedRequirements.forEach(req => {
          if (req.segments) {
            req.segments.forEach(segUuid => segmentsToUpdate.add(segUuid));
          }
        });
        
        // Update all states in a single operation
        set(state => {
          // Create updates for requirement states
          const newRequirementStates = { ...state.requirementStates };
          linkedRequirements.forEach(req => {
            newRequirementStates[req.id] = 'stale';
          });
          
          // Create updates for segment requirement states
          const newSegmentStates = { ...state.segmentRequirementState };
          segmentsToUpdate.forEach(segUuid => {
            newSegmentStates[segUuid] = 'needs_generation';
          });
          console.log(`[handleSegmentChangeWithRequirements] Will update ${segmentsToUpdate.size} segments`);
          
          return {
            requirementStates: newRequirementStates,
            segmentRequirementState: newSegmentStates
          };
        });
        
        // Start a timer is not already started
        if (questionId !== undefined) {
          const currentState = get();
          if (!currentState.activeTimerQuestions.has(questionId)) {
            currentState.startInactivityMonitor(questionId);
          }
        }
      },

      // Cleanup function for unmounting
      cleanupInactivityTimers: (questionId = null) => set(state => {
        if (questionId) {
          // Clean up for specific question
          if (state.inactivityTimers[questionId]) {
            if (state.inactivityTimers[questionId].softTimer) {
              clearTimeout(state.inactivityTimers[questionId].softTimer);
            }
            if (state.inactivityTimers[questionId].hardTimer) {
              clearTimeout(state.inactivityTimers[questionId].hardTimer);
            }
            
            const { [questionId]: _, ...remainingTimers } = state.inactivityTimers;
            
            // Update active timer questions set
            const newActiveTimers = new Set(state.activeTimerQuestions);
            newActiveTimers.delete(questionId);
            
            return {
              inactivityTimers: remainingTimers,
              activeTimerQuestions: newActiveTimers
            };
          }
          return state;
        } else {
          // Clean up all timers
          Object.values(state.inactivityTimers).forEach(timers => {
            if (timers.softTimer) clearTimeout(timers.softTimer);
            if (timers.hardTimer) clearTimeout(timers.hardTimer);
          });
          
          return {
            inactivityTimers: {},
            activeTimerQuestions: new Set()
          };
        }
      }),

      // Requirement Panel Management
      // Set requirement state (validate/reject)
      setRequirementState: (requirementId, newState, rating = null) => set(state => {
        // If rejecting, mark linked segments as needing generation again
        if (newState === 'rejected') {
          const requirement = Object.values(state.requirements)
            .flat()
            .find(req => req.id === requirementId);
            
            if (requirement && requirement.segments) {
              requirement.segments.forEach(segmentUuid => {
                state.markSegmentAsNeedsGeneration(segmentUuid);
              });
          }
        }
        
        return {
          requirementStates: {
            ...state.requirementStates,
            [requirementId]: newState
          },
          requirementRatings: rating ? {
            ...state.requirementRatings,
            [requirementId]: rating
          } : state.requirementRatings
        };
      }),

      // Get requirements for a question
      getRequirementsByQuestion: (questionId) => {
        const state = get();
        return state.requirements[questionId] || [];
      },

      // Get requirement state by ID
      getRequirementState: (requirementId) => {
        const state = get();
        return state.requirementStates[requirementId] || 'pending';
      },

      // Get requirement rating by ID
      getRequirementRating: (requirementId) => {
        const state = get();
        return state.requirementRatings[requirementId] || null;
      },

      // User study mode management
      setInitiativeMode: (newMode) => set(state => {
        // If switching to fixed mode, force panel display
        if (newMode === "fixed") {
          return {
            initiativeMode: newMode,
            globalDisplayMode: "panel", // Force panel display in fixed mode
            interventionMode: "off" // Turn off auto interventions in fixed mode
          };
        }

        if (newMode === "mixed") {
          return {
            initiativeMode: newMode,
            globalDisplayMode: "default", // Use default display in fixed mode
            interventionMode: "on" // Turn on auto interventions in mixed mode
          };
        }
        
        // Otherwise just set the mode
        return {
          initiativeMode: newMode
        };
      }),
    })
  )
);