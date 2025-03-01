// RequirementPanel.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useSurveyStore } from '../../stores/useSurveyStore';
import { ChevronDown, ChevronUp, X, Maximize, Minimize, Check, AlertCircle, AlertTriangle } from 'lucide-react';
import Draggable from 'react-draggable'; 

const RequirementPanel = () => {
  const {
    requirements,
    getRequirementState,
    getRequirementRating,
    setRequirementState,
    // Count questions from the answers state
    answers,
    generationErrors,
  } = useSurveyStore();

  // Panel state management
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [activeRequirement, setActiveRequirement] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const [showHistoryForQuestion, setShowHistoryForQuestion] = useState({});
  const [hoveredRating, setHoveredRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);

  // Get number of questions from answers state
  const questionCount = Object.keys(answers).length;
  const questionIds = Object.keys(answers).map(Number);

  // Track requirements counts to detect new additions
  const prevRequirementsCounts = useRef({});

  // Auto-expand questions when new requirements are added
  useEffect(() => {
    // For each question that has requirements
    Object.keys(requirements).forEach(questionId => {
      const numRequirements = requirements[questionId]?.length || 0;
      const prevCount = prevRequirementsCounts.current[questionId] || 0;
      
      // Only expand the question if requirements count increased (new requirements added)
      if (numRequirements > prevCount) {
        // Expand this specific question
        setExpandedQuestions(prev => {
          const newSet = new Set(prev);
          newSet.add(Number(questionId));
          return newSet;
        });
        
        // Also expand the panel if it was minimized
        setIsExpanded(true);
      }
      
      // Update our count reference for next time
      prevRequirementsCounts.current[questionId] = numRequirements;
    });
  }, [requirements]);

  // Handle validate action
  const handleValidate = (requirement) => {
    setActiveRequirement(requirement);
    setShowRatingModal(true);
  };

  // Handle reject action
  const handleReject = (requirement) => {
    setActiveRequirement(requirement);
    setRejectionReason('');
    setShowRejectionModal(true);
  };

  // Submit rating
  const handleRateRequirement = (rating) => {
    setRequirementState(activeRequirement.id, 'validated', rating);
    setShowRatingModal(false);
    setSelectedRating(0);
    setHoveredRating(0);
  };

  // Submit rejection
  const handleSubmitRejection = () => {
    setRequirementState(activeRequirement.id, 'rejected');
    setShowRejectionModal(false);
  };

  // Scroll to relevant segment
  const scrollToSegment = (segmentUuid) => {
    // Find the parent container of the segment
    const segmentElement = document.querySelector(`[data-segment-id="${segmentUuid}"]`);
    if (segmentElement) {
      // Find the parent container div (without using closest with complex selectors)
      // Navigate up to find the container div - first parent div with border class
      let containerElement = segmentElement;
      while (containerElement && !containerElement.classList.contains('border')) {
        containerElement = containerElement.parentElement;
      }
      
      // Scroll to the segment
      segmentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Apply highlight effect to the appropriate element
      if (containerElement) {
        containerElement.classList.add('highlight-segment');
        setTimeout(() => {
          containerElement.classList.remove('highlight-segment');
        }, 2000);
      }
    }
  };

  // Render the status indicator
  const getStatusIndicator = (requirementId) => {
    const status = getRequirementState(requirementId);
    
    switch(status) {
      case 'validated':
        return <div className="flex items-center text-green-600"><Check size={14} /><span className="ml-1 text-xs">Validated</span></div>;
      case 'rejected':
        return <div className="flex items-center text-red-600"><X size={14} /><span className="ml-1 text-xs">Rejected</span></div>;
      case 'stale':
        return <div className="flex items-center text-amber-500"><AlertTriangle size={14} /><span className="ml-1 text-xs">Stale</span></div>;
      default:
        return <div className="flex items-center text-gray-600"><AlertCircle size={14} /><span className="ml-1 text-xs">Pending</span></div>;
    }
  };

    // Get CSS class based on requirement state
    const getRequirementCardClass = (requirementId) => {
      const status = getRequirementState(requirementId);
      
      switch(status) {
        case 'validated':
          return 'border-green-200 bg-green-50';
        case 'rejected':
          return 'border-red-200 bg-red-50';
        case 'stale':
          return 'border-amber-200 bg-amber-50'; // Amber/yellow for stale requirements
        default:
          return 'border-gray-200 bg-white';
      }
    };

  // Render star rating
  const renderStarRating = (requirementId) => {
    const rating = getRequirementRating(requirementId);
    
    if (!rating) return null;
    
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <span 
            key={star} 
            className={`${star <= rating ? 'text-amber-500' : 'text-gray-300'}`}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  return (
    <Draggable
      handle=".drag-handle" 
      position={panelPosition}
      onStop={(e, data) => setPanelPosition({ x: data.x, y: data.y })}
    >
      <div className={`fixed bottom-4 right-4 bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-150 z-50 ${
        isExpanded ? 'w-96 h-3/4' : 'w-64 h-12'
      }`}>
        {/* Header - always visible */}
        <div className="drag-handle p-3 bg-blue-600 text-white flex justify-between items-center cursor-move">
          <h3 className="font-medium text-sm">
            {isExpanded ? 'Requirements Panel' : 'Requirements'}
          </h3>
          <div className="flex space-x-2">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-white hover:text-blue-200"
            >
              {isExpanded ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>
        </div>

        {/* Body - only visible when expanded */}
        {isExpanded && (
          <div className="overflow-auto h-[calc(100%-48px)] p-3">
            {/* Questions with requirements */}
            {questionIds.map((questionId) => (
              <div key={questionId} className="mb-4">
                <div 
                  className="flex justify-between items-center p-2 bg-gray-100 rounded cursor-pointer"
                  onClick={() => {
                    setExpandedQuestions(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(questionId)) {
                        newSet.delete(questionId);
                      } else {
                        newSet.add(questionId);
                      }
                      return newSet;
                    });
                  }}
                >
                  <h3 className="font-medium text-sm">Question {questionId + 1}</h3>
                  {expandedQuestions.has(questionId) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
                
                {expandedQuestions.has(questionId) && (
                  <div className="space-y-3 mt-2">
                    {/* Show error message if generation failed */}
                    {generationErrors && generationErrors[questionId] && (
                      <div className="p-3 border border-red-200 bg-red-50 rounded text-sm mb-3">
                        <div className="flex items-center text-red-600 mb-2">
                          <AlertTriangle size={14} />
                          <span className="ml-1 font-medium">Requirement Generation Failed</span>
                        </div>
                        <p className="mb-2 text-red-700">{generationErrors[questionId].error}</p>
                        
                        {generationErrors[questionId].details && (
                          <details className="mb-2">
                            <summary className="cursor-pointer text-red-500 text-xs">Show technical details</summary>
                            <pre className="mt-1 p-2 bg-red-100 text-xs overflow-x-auto whitespace-pre-wrap text-red-800">
                              {generationErrors[questionId].details}
                            </pre>
                          </details>
                        )}
                        
                        <button
                          onClick={() => useSurveyStore.getState().handleManualGenerateRequirements(questionId)}
                          className="mt-1 px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 flex items-center"
                        >
                          <span className="mr-1">↻</span> Retry Generation
                        </button>
                      </div>
                    )}
                    {requirements[questionId]?.length > 0 ? (
                      <>
                        {/* Active requirements (pending or validated) */}
                        {requirements[questionId]
                          .filter(req => {
                            const state = getRequirementState(req.id);
                            return state !== 'rejected' && state !== 'stale';
                          })
                          .map((requirement) => (
                            <div 
                              key={requirement.id} 
                              className={`p-3 border rounded text-sm ${getRequirementCardClass(requirement.id)}`}
                            >
                              <div className="flex justify-between items-center mb-2">
                                {getStatusIndicator(requirement.id)}
                                
                                <div className="flex gap-1">
                                  {getRequirementState(requirement.id) === 'pending' && (
                                    <>
                                      <button 
                                        onClick={() => handleValidate(requirement)}
                                        className="p-1 rounded hover:bg-green-100"
                                        title="Validate"
                                      >
                                        <Check size={14} className="text-green-600" />
                                      </button>
                                      <button 
                                        onClick={() => handleReject(requirement)}
                                        className="p-1 rounded hover:bg-red-100"
                                        title="Reject"
                                      >
                                        <X size={14} className="text-red-600" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              <p className="mb-2">{requirement.requirement}</p>
                              
                              <div className="flex justify-between items-center">
                                <div className="flex gap-1">
                                  {requirement.segments.map((segmentUuid) => {
                                    // Get the actual segment data from the store
                                    const segment = useSurveyStore.getState().segments[segmentUuid];
                                    const segmentIdx = segment ? segment.segmentIdx + 1 : '?'; // +1 for display (0-indexed to 1-indexed)
                                    
                                    return (
                                      <span 
                                        key={segmentUuid}
                                        onClick={() => scrollToSegment(segmentUuid)}
                                        className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                                        title={`Scroll to segment`}
                                      >
                                        {segmentIdx}
                                      </span>
                                    );
                                  })}
                                </div>
                                
                                {renderStarRating(requirement.id)}
                              </div>
                            </div>
                          ))}
                        
                          {/* Rejected/Stale requirements history section */}
                          {requirements[questionId].some(req => {
                            const state = getRequirementState(req.id);
                            return state === 'rejected' || state === 'stale';
                          }) && (
                            <div className="mt-4">
                              <div 
                                className="text-xs text-gray-500 mb-2 flex items-center cursor-pointer"
                                onClick={() => {
                                  setShowHistoryForQuestion(prev => ({
                                    ...prev,
                                    [questionId]: !prev[questionId]
                                  }));
                                }}
                              >
                                <hr className="flex-grow mr-2" />
                                <span className="flex items-center">
                                  Requirements History
                                  {showHistoryForQuestion[questionId] ? 
                                    <ChevronUp size={12} className="ml-1" /> : 
                                    <ChevronDown size={12} className="ml-1" />}
                                </span>
                                <hr className="flex-grow ml-2" />
                              </div>
                              
                              {showHistoryForQuestion[questionId] && (
                                <div className="space-y-2">
                                  {requirements[questionId]
                                    .filter(req => {
                                      const state = getRequirementState(req.id);
                                      return state === 'rejected' || state === 'stale';
                                    })
                                    .map((requirement) => {
                                      const isRejected = getRequirementState(requirement.id) === 'rejected';
                                      return (
                                        <div 
                                          key={requirement.id} 
                                          className={`p-3 border rounded text-sm border-gray-200 bg-gray-50 opacity-70 mb-2`}
                                        >
                                          <div className="flex justify-between items-center mb-2">
                                            {getStatusIndicator(requirement.id)}
                                          </div>
                                          <p className={`mb-2 ${isRejected ? 'line-through' : ''}`}>{requirement.requirement}</p>
                                          
                                          <div className="flex justify-between items-center">
                                            <div className="flex gap-1">
                                              {requirement.segments.map((segmentUuid) => {
                                                // Get the actual segment data from the store
                                                const segment = useSurveyStore.getState().segments[segmentUuid];
                                                const segmentIdx = segment ? segment.segmentIdx + 1 : '?';
                                                
                                                return (
                                                  <span 
                                                    key={segmentUuid}
                                                    className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                                                    title={`Linked to segment ${segmentIdx}`}
                                                  >
                                                    {segmentIdx}
                                                  </span>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              )}
                            </div>
                          )}
                      </>
                    ) : (
                      <div className="py-3 text-center text-gray-500 text-sm">
                        No requirements generated yet
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            {questionIds.length === 0 && (
              <div className="py-10 text-center text-gray-500">
                Add survey responses to generate requirements
              </div>
            )}
          </div>
        )}

        {/* Rating Modal */}
        {showRatingModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
              <h3 className="text-lg font-medium mb-4">Rate this requirement</h3>
              <p className="mb-4">{activeRequirement?.requirement}</p>
              
              <div className="flex justify-center mb-6">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button 
                    key={rating}
                    onClick={() => handleRateRequirement(rating)}
                    onMouseEnter={() => setHoveredRating(rating)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="text-3xl mx-1 focus:outline-none transition-transform"
                  >
                    <span className={`${
                      (hoveredRating >= rating || selectedRating >= rating) 
                        ? 'text-amber-500' 
                        : 'text-gray-300'
                    }`}>
                      ★
                    </span>
                  </button>
                ))}
              </div>
              
              <div className="flex justify-end">
                <button 
                  onClick={() => {
                    setShowRatingModal(false);
                    setSelectedRating(0);
                    setHoveredRating(0);
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rejection Modal */}
        {showRejectionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
              <h3 className="text-lg font-medium mb-4">Reject this requirement</h3>
              <p className="mb-4">{activeRequirement?.requirement}</p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Linked Segments:
                </label>
                <div className="flex gap-2 mb-3">
                  {activeRequirement?.segments.map((segmentUuid) => {
                    const segment = useSurveyStore.getState().segments[segmentUuid];
                    const segmentIdx = segment ? segment.segmentIdx + 1 : '?';
                    const questionId = segment ? segment.questionId + 1 : '?';
                    
                    return (
                      <button 
                      key={segmentUuid}
                      onClick={() => scrollToSegment(segmentUuid)}
                      className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs flex items-center gap-1 transition-colors"
                      title={`Scroll to segment ${segmentIdx}`}
                      >
                      <span>Segment {segmentIdx}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Reason for rejection (optional)
                </label>
                <textarea 
                  className="w-full border rounded p-2"
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this requirement doesn't meet your expectations..."
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setShowRejectionModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSubmitRejection}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Reject Requirement
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Draggable>
  );
};

export default RequirementPanel;