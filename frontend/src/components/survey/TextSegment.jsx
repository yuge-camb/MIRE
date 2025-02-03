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
    // removeSegment,
    setSegmentEditStart,
    updateSegmentTiming
  } = useSurveyStore();

  const [uuid] = useState(() => uuidv4());

  // Move initialization to effect
  useEffect(() => {
    setAnswer(questionId, segmentId, '', uuid);
  }, []); // Run once on mount

  // Get current segmentIdx from segments state
  const currentSegmentIdx = segments[uuid]?.segmentIdx ?? segmentId;
  const text = answers[questionId]?.[segmentId] || '';

  const handleTextChange = (e) => {
    const newText = e.target.value;
    setAnswer(questionId, currentSegmentIdx, newText, uuid);
  };

  const handleBlur = () => {
    // Called when leaving/unfocusing from this segment
    setActiveEditingSegment(null);  
    updateSegmentTiming(uuid, text);  // End timing when focus ends
  };

  const handleFocus = () => {
    // Called when focusing on this segment
    setActiveEditingSegment(uuid);
    setSegmentEditStart(uuid);  // Start timing when focus begins
  };

  // const handleDelete = () => {
  //   removeSegment(uuid);
  // };

  return (
    <div className="relative">
      <div className="flex gap-4">
        <div className="flex-grow">
          <textarea
            value={text}
            onChange={handleTextChange}
            onBlur={handleBlur}    
            onFocus={handleFocus}  
            className="w-full p-3 border rounded min-h-[100px] resize-y"
            placeholder="Enter your response..."
          />
        </div>
        {/* <button
          onClick={handleDelete}
          className="h-8 px-2 text-gray-500 hover:text-red-500"
        >
          🗑️
        </button> */}
  
        {/* Added to same flex row instead of below */}
        <div className="w-96">
          <InterventionDisplay uuid={uuid} />
        </div>
      </div>
    </div>
  );
};

export default TextSegment;