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
      segmentTimings: {},
      chatHistory: {},
      debugMode: false,
      wsService: undefined,
      activeEditingSegment: null,
      activeChat: null,  // Add state for active chat
      lastAnalyzedTexts: {}, // tracks {uuid: lastAnalyzedText}

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

      removeSegment: (uuid) => set(state => {
        // Check if segment exists
        if (!state.segments[uuid]) return state;

        const { [uuid]: removed, ...remainingSegments } = state.segments;
        const questionId = removed.questionIdx;
        const segmentToRemove = removed.segmentIdx;

        // Create new answers object excluding removed segment
        const newAnswers = { ...state.answers };
        if (questionId !== undefined) {
          const currentAnswers = state.answers[questionId] || {};
          delete currentAnswers[segmentToRemove];

          // Reindex remaining answers
          const reindexedAnswers = Object.values(currentAnswers)
            .reduce((acc, text, i) => {
              acc[i] = text;
              return acc;
            }, {});

          newAnswers[questionId] = reindexedAnswers;
        }

        // Also remove any analysis status
        const newAnalysisStatus = { ...state.analysisStatus };
        delete newAnalysisStatus[uuid];

        const { [uuid]: _, ...remainingAnalyzedTexts } = state.lastAnalyzedTexts;

        return {
          segments: remainingSegments,
          answers: newAnswers,
          analysisStatus: newAnalysisStatus,
          lastAnalyzedTexts: remainingAnalyzedTexts
        };
      }),

      // updateSegment: (uuid, newText) => set(state => {
      //   const segment = state.segments[uuid];
      //   if (!segment) return state;
      
      //   return {
      //     segments: {
      //       ...state.segments,
      //       [uuid]: {
      //         ...segment,
      //         text: newText
      //       }
      //     },
      //     answers: {
      //       ...state.answers,
      //       [segment.questionIdx]: {
      //         ...state.answers[segment.questionIdx],
      //         [segment.segmentIdx]: newText
              
      //       }
      //     }
      //   };
      // }),

      // Reusable function to analyze a segment if needed
      analyzeSegmentIfNeeded: (uuid, newText = undefined) => {
        const state = get();
        const segment = state.segments[uuid];
        // Accepts optional newText for intervention updates, otherwise uses current segment text for direct editing case
        const textToAnalyze = newText !== undefined ? newText : segment?.text;
        const lastAnalyzedText = state.lastAnalyzedTexts[uuid];

        console.log('analyzeSegmentIfNeeded called with:', {
          uuid,
          textToAnalyze,
          lastAnalyzedText
        });

        if (textToAnalyze?.length >= 10 && 
            (lastAnalyzedText === undefined || textToAnalyze !== lastAnalyzedText)) {
          console.log('Analysis needed - conditions met');  
          // Send segment update to server
          state.wsService?.sendMessage({
            type: 'segment_update',
            uuid: uuid,
            text: textToAnalyze,
            questionIdx: segment.questionIdx,
            segmentIdx: segment.segmentIdx,
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

      // Intervention Management
      addIntervention: (intervention) => set(state => ({
        interventions: [...state.interventions, {
          ...intervention,
          id: uuidv4(),
          response: null,
          responseTime: null
        }]
      })),

      respondToIntervention: (interventionId, response, newText = null, targetUuid = null) => set(state => {
        // Always update intervention status
        const updatedInterventions = state.interventions.map(int =>
          int.id === interventionId
            ? { ...int, response, responseTime: Date.now() }
            : int
        );
      
        // Find the intervention to get context
        const intervention = state.interventions.find(i => i.id === interventionId);
        if (!intervention) {
          return { interventions: updatedInterventions };
        }
      
        // If no text update needed, just return intervention update
        if (!newText) {
          return { interventions: updatedInterventions };
        }
      
        // Determine which UUID to update
        const uuid = targetUuid || intervention.uuid;
        const segment = state.segments[uuid];
      
        if (!segment) {
          return { interventions: updatedInterventions };
        }
      
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