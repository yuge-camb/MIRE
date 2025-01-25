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

      updateSegment: (uuid, newText) => set(state => {
        const segment = state.segments[uuid];
        if (!segment) return state;
      
        return {
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
      }),
      // Edit State Management
      setActiveEditingSegment: (uuid) => set(state => {
        const prevActive = state.activeEditingSegment;

        if (prevActive && prevActive !== uuid) {
          const prevSegment = state.segments[prevActive];
          const currentText = prevSegment?.text;
          const lastAnalyzedText = state.lastAnalyzedTexts[prevActive];

          if (currentText?.length >= 10 && 
              (lastAnalyzedText === undefined || currentText !== lastAnalyzedText)) {

            // Send all segments for consistency checks
            state.wsService?.sendMessage({
              type: 'segment_update',
              uuid: prevActive,
              text: currentText,
              questionIdx: prevSegment.questionIdx,
              segmentIdx: prevSegment.segmentIdx,
              all_segments: state.segments  // Include all segments
            });

            return {
              activeEditingSegment: uuid,
              analysisStatus: {
                ...state.analysisStatus,
                [prevActive]: 'pending'
              },
              lastAnalyzedTexts: {
                ...state.lastAnalyzedTexts,
                [prevActive]: currentText
              }
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
          id: Date.now(),
          response: null,
          responseTime: null
        }]
      })),

      // Intervention Management
      respondToIntervention: (interventionId, response, newText = null, targetUuid = null) => set(state => {
        //debugging
        console.log('respondToIntervention called with:', {
          interventionId,
          response,
          newText,
          targetUuid
        });
        // Always update intervention status
        const updatedInterventions = state.interventions.map(int =>
          int.id === interventionId
            ? { ...int, response, responseTime: Date.now() }
            : int
        );

        // If no text update needed, just return intervention update
        if (!newText) {
          return { interventions: updatedInterventions };
        }

        // Find the intervention to get context
        const intervention = state.interventions.find(i => i.id === interventionId);
        //debugging
        console.log('Found intervention:', intervention);
        if (!intervention) {
          return { interventions: updatedInterventions };
        }

        // Determine which UUID to update
        const uuid = targetUuid || intervention.uuid;
        const segment = state.segments[uuid];
        //debugging
        console.log('Segment update attempt:', {
          targetUuid,
          finalUuid: uuid,
          segmentFound: !!segment,
          segment
        });

        if (!segment) {
          return { interventions: updatedInterventions };
        }

        // Update both segments and answers with new text
        return {
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
          },
          // Clear lastAnalyzedText to ensure it gets analyzed on next segment change
          lastAnalyzedTexts: {
            ...state.lastAnalyzedTexts,
            [uuid]: undefined
          }
        };
      }),

      addInterventions: (uuid, newInterventions) => 
        set(state => ({
          interventions: [
            ...state.interventions,
            ...newInterventions.map(int => ({
              ...int,
              uuid,
              response: null
            }))
          ]
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