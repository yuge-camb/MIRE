import React from 'react';
import QuestionSection from './QuestionSection';
import { useSurveyStore} from '../../stores/useSurveyStore';
import { v4 as uuidv4 } from 'uuid';
import  ActivityTracker from './ActivityTracker';
import { useState } from 'react';
import { CONTEXTS, DEFAULT_CONTEXT, getQuestionsForContext, getContextDetails } from './QuestionContexts';

const StartSurveyPage = ({ onStart }) => {
  const [selectedContext, setSelectedContext] = useState(DEFAULT_CONTEXT);
  
  const contextDetails = getContextDetails(selectedContext);
  // Get initiative mode and setters from the store
  const initiativeMode = useSurveyStore(state => state.initiativeMode);
  const setInitiativeMode = useSurveyStore(state => state.setInitiativeMode);
  

  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      
      <h1 className="text-3xl font-bold mb-6">{contextDetails.title} – Requirement Elicitation Survey</h1>
      <p className="text-gray-600 mb-4 text-left">
        {contextDetails.description}
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
        onClick={() => onStart(selectedContext)}
        className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        Start Survey
      </button>
      <div className="mt-12 mb-4 text-left p-3 bg-gray-50 rounded-lg max-w-md ml-0">
        <h3 className="font-medium mb-2 text-sm">Study Configuration</h3>
        
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1">Select Survey Context:</label>
          <select 
            value={selectedContext}
            onChange={(e) => setSelectedContext(e.target.value)}
            className="w-full p-1.5 border rounded text-sm"
          >
            {Object.keys(CONTEXTS).map(contextId => (
              <option key={contextId} value={contextId}>
                {CONTEXTS[contextId].title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Select System Mode:</label>
          <select 
            value={initiativeMode}
            onChange={(e) => setInitiativeMode(e.target.value)}
            className="w-full p-1.5 border rounded text-sm"
          >
            <option value="mixed">Mixed-Initiative Mode</option>
            <option value="fixed">Fixed-Initiative Mode</option>
          </select>
        </div>
      </div>
    </div>
  );
};

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
  const { startSession, wsService, answers, submissionStatus, setSubmissionStatus, surveyStarted, setSurveyStarted, getActiveInterventions, startBulkDismissal,  setInitiativeMode, initiativeMode} = useSurveyStore();
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showBulkDismissButton, setShowBulkDismissButton] = useState(false);
  const [QUESTIONS, setQUESTIONS] = useState(getQuestionsForContext(DEFAULT_CONTEXT));
  const [activeContext, setActiveContext] = useState(DEFAULT_CONTEXT);
  
  const handleStartSurvey = (selectedContext) => {
    const newSessionId = uuidv4();
    startSession(newSessionId, selectedContext, initiativeMode);  
    setSurveyStarted(true);
    setActiveContext(selectedContext);
    setQUESTIONS(getQuestionsForContext(selectedContext));
  };

  const handleSubmitSurvey = () => {
    //Interventions check (all dealt with)
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
  //Requirements check (all generated and validated)
  const {
    pendingRequirementGeneration,
    requirements,
    requirementStates,
    questionHasSegmentsNeedingGeneration,
    generateRequirements
  } = useSurveyStore.getState();

  // 1. Check for any questions that need requirement generation
  const questionIds = Object.keys(answers).map(Number);
  const questionsNeedingGeneration = questionIds.filter(questionId => 
    questionHasSegmentsNeedingGeneration(questionId)
  );
  
  if (questionsNeedingGeneration.length > 0) {
    setSubmissionStatus('Please wait - generating missing requirements. You will need to rate them before submission.');
    // Trigger generation for all questions that need it
    questionsNeedingGeneration.forEach(questionId => {
      generateRequirements(questionId, 'survey_end');
    });
    return;
  }

  // 2. Check for pending requirement generation
  if (Object.keys(pendingRequirementGeneration).length > 0) {
    setSubmissionStatus('Please wait for requirement generation to complete, then rate them before submission.');
    return;
  }

  // 3. Check for pending requirement ratings
  let hasPendingRequirements = false;
  Object.entries(requirements).forEach(([_, reqs]) => {
    if (reqs) {
      reqs.forEach(req => {
        if (requirementStates[req.id] === 'pending') {
          hasPendingRequirements = true;
        }
      });
    }
  });

  if (hasPendingRequirements) {
    setSubmissionStatus('Please rate all requirements in the Requirements Panel before submitting.');
    return;
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
        <h1 className="text-2xl font-bold">{getContextDetails(activeContext).title}</h1>
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