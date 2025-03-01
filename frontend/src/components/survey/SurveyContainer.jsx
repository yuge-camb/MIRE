import React from 'react';
import QuestionSection from './QuestionSection';
import { useSurveyStore} from '../../stores/useSurveyStore';
import { v4 as uuidv4 } from 'uuid';
import  ActivityTracker from './ActivityTracker';
import { useState } from 'react';


const QUESTIONS = [
  { id: 0, text: "If you were using an app to look up module reviews, what information would you want to see? (one point per response box)"},
  { id: 1, text: "What information about a reviewer would make their feedback more relevant for someone choosing a module? (one point per response box)" },
  { id: 2, text: "What filtering or sorting options should the app offer to help students find modules aligned with their priorities? (one point per response box)" },
  { id: 3, text: "What features in a review app would make it more likely for you to submit reviews for modules you've taken? (one point per response box)" },
  { id: 4, text: "How could the app help professors or departments use student reviews to improve modules? (one point per response box)" },
  { id: 5, text: "What additional features do you wish a module review app would have? (one point per response box)" }
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

const ReviewModal = ({ isOpen, onClose, activeCount }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-lg">
        <h3 className="text-lg font-semibold mb-4">Review Remaining Interventions</h3>
        <p className="text-gray-600 mb-4">
          You have {activeCount} remaining interventions to review. Please check if you missed any important ones.
        </p>
        <p className="text-gray-600 mb-6">
          After reviewing, if there are interventions you choose to ignore, you can use the 'Dismiss All Remaining' button to handle them all at once.
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Review Interventions
        </button>
      </div>
    </div>
  );
};


const SurveyContainer = () => {
  const { toggleDebugMode, debugMode, startSession, wsService, answers, submissionStatus, setSubmissionStatus, surveyStarted, setSurveyStarted, getActiveInterventions, startBulkDismissal} = useSurveyStore();
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showBulkDismissButton, setShowBulkDismissButton] = useState(false);

  const handleStartSurvey = () => {
    const newSessionId = uuidv4();
    startSession(newSessionId);  
    setSurveyStarted(true);
  };

  const handleSubmitSurvey = () => {
      const activeCount = getActiveInterventions().total;
      if (activeCount > 0) {
        if (!showBulkDismissButton) {
            // First time seeing active interventions - show review modal
            setShowReviewModal(true);
            return;
        } else {
            // They've seen the review modal but haven't used bulk dismiss
            setSubmissionStatus('Please either address or dismiss remaining interventions before submitting.');
            return;
        }
    }
      setSubmissionStatus('Submitting survey...');
      wsService?.sendSurveySubmission(answers);
      setShowBulkDismissButton(false);
    };
  
  const handleBulkDismiss = () => {
    startBulkDismissal();
  };

  if (!surveyStarted) {
    return <StartSurveyPage onStart={handleStartSurvey} />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8" id="survey-container">
      <ActivityTracker />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Module Review System</h1>
        <div className="flex gap-2">
          {/* <button
            onClick={toggleDebugMode}
            className={`px-3 py-1 rounded ${
              debugMode 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {debugMode ? 'Debug Mode: ON' : 'Debug Mode: OFF'}
          </button> */}
        </div>
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
      
      <div className="flex gap-4 mt-8">
        <button 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={handleSubmitSurvey}
        >
          Submit Survey
        </button>

        {showBulkDismissButton && getActiveInterventions().total > 0 && (
          <button
            onClick={handleBulkDismiss}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Dismiss All Remaining ({getActiveInterventions().total})
          </button>
        )}
      </div>

    <ReviewModal 
      isOpen={showReviewModal}
      onClose={() => {
        setShowReviewModal(false);
        setShowBulkDismissButton(true);
      }}
      activeCount={getActiveInterventions().total}
    />
  </div>
  );
};

export default SurveyContainer;