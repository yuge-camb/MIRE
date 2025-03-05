import React, { useState, useEffect } from 'react';
import { useSurveyStore } from '../../stores/useSurveyStore';
import { ChevronDown, ChevronUp, Maximize, Minimize, Check, AlertCircle, X, AlertTriangle } from 'lucide-react';
import Draggable from 'react-draggable';

const BaselineRequirementPanel = () => {
  const {
    baselineRequirements,
    getBaselineRequirementRating,
    setBaselineRequirementRating,
    setBaselinePanelVisibility,
    answers,
    baselineRequirementErrors,
    segments,
    wsService
  } = useSurveyStore();

  // Panel state management
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [activeRequirement, setActiveRequirement] = useState(null);
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const [hoveredRating, setHoveredRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);

  // Get question IDs that have baseline requirements
  const questionIds = Object.keys(baselineRequirements)
    .filter(id => baselineRequirements[id]?.length > 0)
    .map(Number);
  
  // Add effect to auto-expand questions with requirements
  useEffect(() => {
    // Auto-expand questions that have requirements
    const questionsWithRequirements = Object.keys(baselineRequirements)
      .filter(id => baselineRequirements[id]?.length > 0)
      .map(Number);
    
    if (questionsWithRequirements.length > 0) {
      setExpandedQuestions(new Set(questionsWithRequirements));
    }
  }, [baselineRequirements]);

  // Handle validate action
  const handleValidate = (requirement) => {
    setActiveRequirement(requirement);
    setShowRatingModal(true);
  };

  // Submit rating
  const handleRateRequirement = (rating) => {
    setBaselineRequirementRating(activeRequirement.id, rating);
    wsService?.sendRequirementRating(
        activeRequirement.id,                    // requirementId
        activeRequirement.requirement,           // requirementText
        rating,                                  // rating
        activeRequirement.questionId || 
          Object.keys(answers).find(questionId =>     // questionId
            baselineRequirements[questionId]?.some(req => req.id === activeRequirement.id)
          ),
        activeRequirement.segments,              // segments
        'N/A'                                    // activeInterventions - not relevant for baseline
      );
    setShowRatingModal(false);
    setSelectedRating(0);
    setHoveredRating(0);
  };

  // Add the scrollToSegment function:
  const scrollToSegment = (segmentUuid) => {
    // Find the parent container of the segment
    const segmentElement = document.querySelector(`[data-segment-id="${segmentUuid}"]`);
    if (segmentElement) {
      // Find the parent container div
      let containerElement = segmentElement;
      while (containerElement && !containerElement.classList.contains('border')) {
        containerElement = containerElement.parentElement;
      }
      
      // Scroll to the segment
      segmentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Apply highlight effect
      if (containerElement) {
        containerElement.classList.add('highlight-segment');
        setTimeout(() => {
          containerElement.classList.remove('highlight-segment');
        }, 2000);
      }
    }
  };

  // Render star rating
  const renderStarRating = (requirementId) => {
    const rating = getBaselineRequirementRating(requirementId);
    
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
      <div className={`fixed bottom-4 right-4 bg-white shadow-lg rounded-lg overflow-hidden border border-green-200 w-96 transition-all duration-150 z-50 ${
        isExpanded ? 'max-h-[80vh]' : 'h-12'
      }`}>
        {/* Header - always visible */}
        <div className="drag-handle p-3 bg-green-600 text-white flex justify-between items-center cursor-move">
          <h3 className="font-medium text-sm">
            {isExpanded ? 'Initial Requirements Panel' : 'Initial Requirements'}
          </h3>
          <div className="flex space-x-2">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-white hover:text-green-200"
            >
              {isExpanded ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
            <button
              onClick={() => setBaselinePanelVisibility(false)}
              className="text-white hover:text-green-200"
              title="Close panel"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body - only visible when expanded */}
        {isExpanded && (
          <div className="overflow-auto max-h-[calc(80vh-48px)] p-4">
            <div className="bg-green-50 border border-green-200 rounded p-3 mb-4 text-sm text-green-800">
              <p>These requirements were generated from your <strong>initial answers</strong> before any refinements.</p>
              <p className="mt-1">Rate these requirements to compare with your final requirements.</p>
            </div>
            
            {/* Questions with requirements */}
            {questionIds.length > 0 ? (
              questionIds.map((questionId) => (
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
                      {baselineRequirementErrors && baselineRequirementErrors[questionId] && (
                        <div className="p-3 border border-red-200 bg-red-50 rounded text-sm mb-3">
                          <div className="flex items-center text-red-600 mb-2">
                            <AlertTriangle size={14} />
                            <span className="ml-1 font-medium">Initial Requirement Generation Failed</span>
                          </div>
                          <p className="mb-2 text-red-700">{baselineRequirementErrors[questionId].error}</p>
                          
                          {baselineRequirementErrors[questionId].details && (
                            <details className="mb-2">
                              <summary className="cursor-pointer text-red-500 text-xs">Show technical details</summary>
                              <pre className="mt-1 p-2 bg-red-100 text-xs overflow-x-auto whitespace-pre-wrap text-red-800">
                                {baselineRequirementErrors[questionId].details}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}
                      
                      {baselineRequirements[questionId]?.map((requirement) => (
                        <div 
                          key={requirement.id} 
                          className={`p-3 border rounded text-sm ${getBaselineRequirementRating(requirement.id) ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center text-gray-600">
                              {getBaselineRequirementRating(requirement.id) ? 
                                <div className="flex items-center text-green-600"><Check size={14} /><span className="ml-1 text-xs">Rated</span></div> :
                                <div className="flex items-center text-gray-600"><AlertCircle size={14} /><span className="ml-1 text-xs">Pending</span></div>
                              }
                            </div>
                            
                            <div className="flex gap-1">
                              {!getBaselineRequirementRating(requirement.id) && (
                                <button 
                                  onClick={() => handleValidate(requirement)}
                                  className="px-2 py-1 rounded hover:bg-green-100 flex items-center"
                                  title="Rate this requirement"
                                >
                                  <Check size={14} className="text-green-600 mr-1" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          <p className="mb-2">{requirement.requirement}</p>
                          
                          <div className="flex justify-between items-center">
                            <div className="flex gap-1">
                              {requirement.segments.map((segmentUuid) => {
                                // Get the actual segment data from the store
                                const segment = segments[segmentUuid];
                                const segmentIdx = segment ? segment.segmentIdx + 1 : '?'; // +1 for display
                                
                                return (
                                  <span 
                                    key={segmentUuid}
                                    onClick={() => scrollToSegment(segmentUuid)}
                                    className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs cursor-pointer"
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
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-gray-500">
                No initial requirements generated yet
              </div>
            )}
          </div>
        )}

        {/* Rating Modal */}
        {showRatingModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
              <h3 className="text-lg font-medium mb-4">Rate this initial requirement</h3>
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
      </div>
    </Draggable>
  );
};

export default BaselineRequirementPanel;