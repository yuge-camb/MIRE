import React from 'react';
import QuestionSection from './QuestionSection';
import { useSurveyStore} from '../../stores/useSurveyStore';
import { v4 as uuidv4 } from 'uuid';
import  ActivityTracker from './ActivityTracker';

const QUESTIONS = [
  { id: 0, text: "If you were using an app to look up module reviews, what information would you want to see?"},
  { id: 1, text: "What information about a reviewer would make their feedback more relevant for someone choosing a module?" },
  { id: 2, text: "What filtering or sorting options should the app offer to help students find modules aligned with their priorities?" },
  { id: 3, text: "What features in a review app would make it more likely for you to submit reviews for modules you've taken?" },
  { id: 4, text: "How could the app help professors or departments use student reviews to improve modules?" },
  { id: 5, text: "What additional features do you wish a module review app would have?" }
];

const StartSurveyPage = ({ onStart }) => (
  <div className="max-w-2xl mx-auto text-center py-16">
  <h1 className="text-3xl font-bold mb-6">Improving the Module Review System – Requirement Elicitation Survey</h1>
  <p className="text-gray-600 mb-4 text-left">
    Welcome! This survey aims to gather insights about improving the module review web app 
    (Camments) for Cambridge Engineering students. Your responses will be analysed to develop 
    requirements to enhance both module selection and course improvement processes.
  </p>
  <p className="text-gray-600 mb-4 text-left">
    Your goal is to actively provide answers that are both understandable and consistent. Take time to make your responses clear and specific, review them to ensure they can be easily interpreted, and check that they align with your other answers.
    </p>
  <p className="text-gray-600 mb-4 text-left">
    As you go through the survey, you may receive clarifications or consistency checks to refine your responses.
  </p>
  <p className="text-gray-600 mb-4 text-left">
    For each question, please provide one clear point per response box. 
    Use the "Add Another Point" button to break down your complete answer into separate parts.
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
    <div className="max-w-4xl mx-auto space-y-8" id="survey-container">
      <ActivityTracker />
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