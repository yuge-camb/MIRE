import React, { useState, useEffect } from 'react';
import { useSurveyStore } from '../../stores/useSurveyStore';
import InterventionDisplay from './InterventionDisplay';
import { v4 as uuidv4 } from 'uuid';

const TextSegment = ({ questionId, segmentId }) => {
  const { 
    answers,
    segments,
    setAnswer,
    setActiveEditingSegment,
    setSegmentEditStart,
    updateSegmentTiming,
    interventions,
    getInterventionDisplayMode
  } = useSurveyStore();

  const [uuid] = useState(() => uuidv4());
  const [openInterventionId, setOpenInterventionId] = useState(null);

  useEffect(() => {
    setAnswer(questionId, segmentId, '', uuid);
  }, []);

  const currentSegmentIdx = segments[uuid]?.segmentIdx ?? segmentId;
  const text = answers[questionId]?.[segmentId] || '';
  
  // Get inline interventions
  const inlineInterventions = interventions.filter(int => 
    int && 
    int.uuid === uuid && 
    !int.response &&
    !int.responseTime &&
    !int.isStale &&
    getInterventionDisplayMode(int) === 'inline'
  );
  

  // Create display text with highlights
  const displayText = () => {
    let result = text;
    // Handle ambiguity highlights first
    inlineInterventions.forEach(int => {
      const triggerPhrase = int.trigger_phrase;
      result = result.replace(
        triggerPhrase,
        `<span class="bg-yellow-100 bg-opacity-70 border-b-2 border-yellow-300 cursor-pointer relative z-10 pointer-events-auto" data-intervention-id="${int.id}">${triggerPhrase}</span>`
      );
    });
    return result;
  };

  const handleTextChange = (e) => {
    const newText = e.target.value;
    setAnswer(questionId, currentSegmentIdx, newText, uuid);
  };

  const handleBlur = () => {
    setActiveEditingSegment(null);
    updateSegmentTiming(uuid, text);
  };

  const handleFocus = () => {
    setActiveEditingSegment(uuid);
    setSegmentEditStart(uuid);
  };

  const handleHighlightClick = (e) => {
    // alert(`Clicked on intervention`);
    const span = e.target.closest('span[data-intervention-id]');
    if (span) {
      const interventionId = span.dataset.interventionId;
      // trackInterventionInteraction(interventionId);
      setOpenInterventionId(interventionId);
    }
  };

  // Close popover when clicking outside (not dismissed)
  useEffect(() => {
    if (openInterventionId) {
      const handleClickOutside = (e) => {
        // Don't close if clicked on a highlight
        if (e.target.closest('[data-intervention-id]')) {
          return;
        }
        
        // Don't close if clicked inside a popover
        if (e.target.closest('.popover-content')) {
          return;
        }
        
        // Otherwise, close the popover
        setOpenInterventionId(null);
      };
      
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openInterventionId]);

  return (
    <div className="flex gap-4">
      <div className="flex-grow relative">
        <div
          contentEditable
          dangerouslySetInnerHTML={{ __html: displayText() }}
          onClick={handleHighlightClick}
          className="w-full p-3 border rounded min-h-[100px]"
        />
        <textarea
          value={text}
          onChange={handleTextChange}
          onBlur={handleBlur}    
          onFocus={handleFocus} 
          data-segment-id={uuid} 
          className="w-full p-3 border rounded min-h-[100px] resize-y absolute top-0 left-0 opacity-50"
          placeholder="Enter your response..."
        />
        {/* Render warning boxes for inline inconsistency interventions*/}
        <div className="absolute bottom-2 right-2 flex gap-1">
          {inlineInterventions
            .filter(int => int.type === 'consistency')
            .map((int, idx) => (
              <span
                key={int.id}
                onClick={() => setOpenInterventionId(int.id)}
                data-intervention-id={int.id}
                data-warning-id={int.id}
                className="inline-flex items-center px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs cursor-pointer"
              >
                ⚠️<sup>{idx + 1}</sup>
              </span>
            ))}
        </div>
      </div>

      {/* Side panel - always present */}
      <div className="w-96">
        <InterventionDisplay 
          uuid={uuid}
          openInterventionId={openInterventionId}
          // onClosePopover={() => setOpenInterventionId(null)}
        />
      </div>
    </div>
  );
};

export default TextSegment;