import React, { useMemo, useEffect, useRef } from 'react';
import { useSurveyStore } from '../../stores/useSurveyStore';
import TextSegment from './TextSegment';

const QuestionSection = ({ question }) => {
  const { 
    answers,
    addSegment,
    // removeSegment,
    // setActiveChat,
    resetTimerIfActive,
    handleManualGenerateRequirements,
    // Get interventions to detect new ones
    interventions
  } = useSurveyStore();

  // Track previous intervention count for this question
  const prevInterventionCountRef = useRef(0);

  // Get segments for this question
  const segmentIds = useMemo(() => 
    Object.keys(answers[question.id] || { 0: '' }).map(Number),
    [question.id, answers]
  );
  
  // Get segment UUIDs for this question from answers
  const segmentUuids = useMemo(() => {
    const uuids = [];
    Object.values(answers[question.id] || {}).forEach(text => {
      // Find the UUID for this segment text
      for (const [uuid, segment] of Object.entries(answers)) {
        if (segment.questionIdx === question.id && segment.text === text) {
          uuids.push(uuid);
          break;
        }
      }
    });
    return uuids;
  }, [question.id, answers]);
  
  // Count interventions for this question's segments
  const interventionCount = useMemo(() => {
    return interventions.filter(int => 
      segmentUuids.includes(int.uuid) && 
      !int.response && 
      !int.responseTime
    ).length;
  }, [interventions, segmentUuids]);
  
  // Monitor for new interventions
  useEffect(() => {
    if (interventionCount > prevInterventionCountRef.current) {
      // New intervention appeared
      console.log(`New intervention detected for question ${question.id}`);
      resetTimerIfActive(question.id);
    }
    prevInterventionCountRef.current = interventionCount;
  }, [interventionCount, question.id, resetTimerIfActive]);
  
  // Handle "Generate Requirements" button click
  const handleGenerateRequirements = (questionId) => {
    console.log("Manually triggering requirement generation for question", questionId);
    handleManualGenerateRequirements(questionId);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">
        Question {question.id + 1}
      </h2>
      <p className="mb-4 text-gray-700">{question.text}</p>

      <div className="space-y-4">
        {segmentIds.map((segmentId) => (
          <TextSegment
            key={segmentId}
            questionId={question.id}
            segmentId={segmentId}
            // onRemove={() => removeSegment(question.id, segmentId)}
          />
        ))}
      </div>

      <div className="mt-4 space-x-4">
        <button
          onClick={() => addSegment(question.id)}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          ➕ Add Another Point
        </button>
        
        <button
          onClick={() => handleGenerateRequirements(question.id)}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          📝 Generate Requirements 
        </button>
      </div>

      <div className="mt-4 border-t border-gray-200" />
    </div>
  );
};

export default QuestionSection;