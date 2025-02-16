import React from 'react';
import QuestionSection from './QuestionSection';
import { useSurveyStore} from '../../stores/useSurveyStore';
import { v4 as uuidv4 } from 'uuid';

const QUESTIONS = [
  { id: 0, text: "What specific problems do you face with the current module review system?" },
  { id: 1, text: "What improvements would you like to see in the module review process?" },
  { id: 2, text: "How do you think the review system could better help future students?" },
  { id: 3, text: "What specific features would make the review process more effective?" },
  { id: 4, text: "How could the system better capture feedback about teaching quality?" },
  { id: 5, text: "What additional information would help in module selection?" }
];

const StartSurveyPage = ({ onStart }) => (
  <div className="max-w-2xl mx-auto text-center py-16">
  <h1 className="text-3xl font-bold mb-6">Improving the Module Review System – Requirement Elicitation Survey</h1>
  <p className="text-gray-600 mb-4 text-left">
    Welcome! This survey is designed to gather your needs and insights to improve the module review web app 
    (e.g., Camments) for Cambridge Engineering students. Your answers will help explore how a future software tool 
    can better support students in selecting modules and providing input that may inform course improvements.
  </p>
  <p className="text-gray-600 mb-4 text-left">
    As you go through the survey, you may receive clarifications or consistency checks to refine your responses.
  </p>
  <p className="text-gray-600 mb-8 text-left">
    Click below to begin.
  </p>
    <button
      onClick={onStart}
      className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
    >
      Start Survey
    </button>
  </div>
);

const SurveyContainer = () => {
  const { toggleDebugMode, debugMode, startSession, interventions, wsService, answers, submissionStatus, setSubmissionStatus, surveyStarted, setSurveyStarted } = useSurveyStore();

  const handleStartSurvey = () => {
    const newSessionId = uuidv4();
    startSession(newSessionId);  
    setSurveyStarted(true);
  };

  const handleSubmitSurvey = () => {
      const activeInterventions = interventions.filter(int => 
          !int.response && !int.responseTime
      );

      if (activeInterventions.length > 0) {
          setSubmissionStatus('Please address all outstanding interventions before submitting.');
          return;
      }

      setSubmissionStatus('Submitting survey...');
      wsService?.sendSurveySubmission(answers);
  };

  if (!surveyStarted) {
    return <StartSurveyPage onStart={handleStartSurvey} />;
  }

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
      
      {submissionStatus && (
          <div className="mt-4 p-4 rounded bg-blue-50 text-blue-700">
              {submissionStatus}
          </div>
      )}
      
      <button 
          className="mt-8 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={handleSubmitSurvey}
      >
          Submit Survey
      </button>
    </div>
  );
};

export default SurveyContainer;