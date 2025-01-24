import React from 'react';
import QuestionSection from './QuestionSection';
import { useSurveyStore } from '../../stores/useSurveyStore';

const QUESTIONS = [
  { id: 0, text: "What specific problems do you face with the current module review system?" },
  { id: 1, text: "What improvements would you like to see in the module review process?" },
  { id: 2, text: "How do you think the review system could better help future students?" },
  { id: 3, text: "What specific features would make the review process more effective?" },
  { id: 4, text: "How could the system better capture feedback about teaching quality?" },
  { id: 5, text: "What additional information would help in module selection?" }
];

const SurveyContainer = () => {
  const { toggleDebugMode, debugMode } = useSurveyStore();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Module Review System</h1>
        <button
          onClick={toggleDebugMode}
          className={`px-3 py-1 rounded ${
            debugMode 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {debugMode ? 'Debug Mode: ON' : 'Debug Mode: OFF'}
        </button>
      </div>
      
      {QUESTIONS.map((question) => (
        <QuestionSection 
          key={question.id}
          question={question}
        />
      ))}
      
      <button 
        className="mt-8 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        onClick={() => console.log('Submit clicked - will implement later')}
      >
        Submit Survey
      </button>
    </div>
  );
};

export default SurveyContainer;