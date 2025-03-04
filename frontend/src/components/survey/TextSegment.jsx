import React, { useState, useEffect, useRef } from 'react';
import { useSurveyStore } from '../../stores/useSurveyStore';
import InterventionDisplay from './InterventionDisplay';
import { v4 as uuidv4 } from 'uuid';

const TextSegment = ({ questionId, segmentId }) => {
  const { 
    answers,
    segments,
    setAnswer,
    setState,
    setActiveEditingSegment,
    setSegmentEditStart,
    updateSegmentTiming,
    interventions,
    getInterventionDisplayMode,
    triggerManualAnalysis,
    interventionMode,
    markSegmentAsNeedsGeneration,
    resetTimerIfActive,
  } = useSurveyStore();

  const [uuid] = useState(() => {
    // Check if there's already a UUID for this question/segment pair in the store
    const { segments } = useSurveyStore.getState();
    const existingSegmentUUID = Object.entries(segments)
      .find(([_, segment]) => 
        segment.questionIdx === questionId && 
        segment.segmentIdx === segmentId
      )?.[0];
    return existingSegmentUUID || uuidv4();
  });
  const [openInterventionId, setOpenInterventionId] = useState(null);

  useEffect(() => {
    setAnswer(questionId, segmentId, '', uuid);
    // Initialize segment requirement state to needs_generation
    markSegmentAsNeedsGeneration(uuid);
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
  
  const handleManualAnalysis = () => {
    triggerManualAnalysis(uuid);
  };

  // Create display text with highlights
  const displayText = () => {
    let result = text;
    // Handle ambiguity highlights first
    inlineInterventions.forEach(int => {
      const triggerPhrase = int.trigger_phrase;
      result = result.replace(
        triggerPhrase,
         `<span class="bg-yellow-100 bg-opacity-70 border-b-2 border-yellow-300 cursor-pointer relative z-10 pointer-events-auto text-black" data-intervention-id="${int.id}">${triggerPhrase}</span>`
      );
    });
    return result;
  };

  const containerRef = useRef(null);
  const textareaRef = useRef(null);
  const overlayRef = useRef(null);

  // Adjust height function
  const adjustHeightIfNeeded = () => {
    if (!textareaRef.current || !containerRef.current) return;
    
    // Check if content exceeds initial height
    if (textareaRef.current.scrollHeight > textareaRef.current.clientHeight) {
      // Set container height with a bit of extra padding
      containerRef.current.style.height = (textareaRef.current.scrollHeight + 2) + 'px';

      // Sync scroll position after height adjustment
      if (overlayRef.current) {
        overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      }
    }
  };

  // Effect for text changes
  useEffect(() => {
    adjustHeightIfNeeded();
  }, [text]);

  const syncScroll = (e) => {
    if (overlayRef.current) {
      overlayRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const handleTextChange = (e) => {
    const newText = e.target.value;
    setAnswer(questionId, currentSegmentIdx, newText, uuid);
    // Reset timer for requirement generation if active
    resetTimerIfActive(questionId);
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
    const span = e.target.closest('span[data-intervention-id]');
    if (span) {
      const interventionId = span.dataset.interventionId;
      setOpenInterventionId(interventionId);
    }
  };

  useEffect(() => {
    // Create ResizeObserver to watch the container size changes
    const resizeObserver = new ResizeObserver(() => {
      if (textareaRef.current && overlayRef.current) {
        // Make sure overlay size matches textarea after resize
        overlayRef.current.style.height = `${textareaRef.current.clientHeight}px`;
        overlayRef.current.style.width = `${textareaRef.current.clientWidth}px`;
        overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      }
    });
    
    // Start observing if container exists
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    // Clean up
    return () => resizeObserver.disconnect();
  }, []);


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
      <div ref={containerRef} className="w-full border rounded min-h-[100px] resize-y overflow-hidden relative p-0 m-0">
        <div
          ref={overlayRef}
          contentEditable
          dangerouslySetInnerHTML={{ __html: displayText() }}
          onClick={handleHighlightClick}
          className="w-full h-full p-3 absolute top-0 left-0 text-transparent overflow-auto"
        />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            handleTextChange(e);
            adjustHeightIfNeeded();
          }}
          onScroll={syncScroll} 
          onBlur={handleBlur}
          onFocus={handleFocus}
          data-segment-id={uuid} 
          className="w-full h-full p-3 absolute top-0 left-0 resize-none"
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
      </div>

      {/* Add manual analysis button when intervention mode is off */}
      {interventionMode === 'off' && (
      <button
        onClick={handleManualAnalysis}
        className="h-8 px-2 bg-blue-100 hover:bg-blue-200 rounded flex items-center gap-1 text-sm"
        title="Check text for clarity and consistency"
      >
        <span>🔍</span>
        <span className="text-xs text-gray-600">Review</span>
      </button>
    )}

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