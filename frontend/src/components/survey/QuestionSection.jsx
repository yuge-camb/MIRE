import React, { useMemo } from 'react';
import { useSurveyStore } from '../../stores/useSurveyStore';
import TextSegment from './TextSegment';

const QuestionSection = ({ question }) => {
  const { 
    answers,
    addSegment,
    // removeSegment,
    setActiveChat
  } = useSurveyStore();

  // Get segments for this question
  const segmentIds = useMemo(() => 
    Object.keys(answers[question.id] || { 0: '' }).map(Number),
    [question.id, answers]
  );
  
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
        
        {/* <button
          onClick={() => setActiveChat(question.id)}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          Ask AI for Help 💬
        </button> */}
      </div>

      <div className="mt-4 border-t border-gray-200" />
    </div>
  );
};

export default QuestionSection;