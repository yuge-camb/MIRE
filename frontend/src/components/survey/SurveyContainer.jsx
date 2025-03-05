import React from 'react';
import QuestionSection from './QuestionSection';
import { useSurveyStore} from '../../stores/useSurveyStore';
import { v4 as uuidv4 } from 'uuid';
import  ActivityTracker from './ActivityTracker';
import { useState } from 'react';
import { CONTEXTS, getQuestionsForContext, getContextDetails } from './QuestionContexts';

const StartSurveyPage = ({ onStart }) => {
  const selectedContext = useSurveyStore(state => state.activeContext);
  const setSelectedContext = useSurveyStore(state => state.setActiveContext);

  const contextDetails = getContextDetails(selectedContext);
  // Get initiative mode and setters from the store
  const initiativeMode = useSurveyStore(state => state.initiativeMode);
  const setInitiativeMode = useSurveyStore(state => state.setInitiativeMode);
  

  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      
      <h1 className="text-3xl font-bold mb-6">{contextDetails.title} – Requirement Elicitation Survey</h1>
      {initiativeMode === "mixed" && (
        <div className="text-gray-600 mb-4 text-left">
          <p>
            {contextDetails.description}
          </p>
          <p className="mt-2">
            Your task is to provide thoughtful responses to questions about what features this system should include. Please consider your needs as {contextDetails.user} who would use this platform. Be as specific and clear as possible in your responses.
          </p>
          <p className="mt-2">
            In this <strong>mixed-initiative mode</strong>, the system will automatically analyse your responses and provide interventions when it detects potential ambiguities or inconsistencies.  It also automatically generates requirements when it detects your answers for a question have stabilised. You can:
          </p>
          <ul className="list-disc pl-5 mt-1">
            <li>Turn off <strong>Live Analysis</strong> if you feel mentally overloaded, and turn it back on anytime using toolbox on the left</li>
            <li>When you turn off <strong>Live Analysis</strong>, you can still manually trigger analysis for a specific segment using the <strong>"Review"</strong> button</li>
            <li>(Note: The system will then provide interventions if it detects potential ambiguities or inconsistencies for the segment)</li>
            <li>Change how interventions are presented (changing from <strong>Default</strong> to <strong>Panel</strong> or <strong>Inline</strong>) using toolbox on the left</li>
            <li>You can also manually generate requirements when you're satisfied with your answers for a specific question using the <strong>"Generate Requirements"</strong> button</li>
          </ul>
          <p className="mt-2">
          As requirements are generated, you'll need to review and rate each one to indicate how well it expresses the system that answers to your need. Before submitting the survey, all questions must have generated requirements, and all requirements must be rated.
          </p>
          <p className="mt-2">
            Your careful consideration will directly impact the quality of the requirements generated, so please take your time with each response.
          </p>
        </div>
      )}
    {initiativeMode === "fixed" && (
      <div className="text-gray-600 mb-4 text-left">
        <p>
          {contextDetails.description}
        </p>
        <p className="mt-2">
          Your task is to provide thoughtful responses to questions about what features this system should include. Please consider your needs as {contextDetails.user} who would use this platform. Be as specific and clear as possible in your responses.
        </p>
        <p className="mt-2">
          In this <strong>fixed-initiative mode</strong>, you'll have manual control over when to check your responses:
        </p>
        <ul className="list-disc pl-5 mt-1">
          <li>Use the <strong>"Review"</strong> button when you want to check your a specific segment answer for clarity or consistency</li>
          <li>The system will then provide interventions if it detects potential ambiguities or inconsistencies for the segment.</li>
          <li>Any interventions will appear in the side panel</li>
          <li>You can click <strong>"Generate Requirements"</strong> when you're satisfied with your answers for a specific question</li>
        </ul>
        <p className="mt-2">
        As requirements are generated, you'll need to review and rate each one to indicate how well it expresses the system that answers to your need. Before submitting the survey, all questions must have generated requirements, and all requirements must be rated.
        </p>
        <p className="mt-2">
          Your careful consideration will directly impact the quality of the requirements generated, so please take your time with each response.
        </p>
      </div>
    )}
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
  const activeContext = useSurveyStore(state => state.activeContext);
  const [QUESTIONS, setQUESTIONS] = useState(getQuestionsForContext(activeContext));
  
  const handleStartSurvey = (selectedContext) => {
    const newSessionId = uuidv4();
    startSession(newSessionId, selectedContext, initiativeMode);  
    setSurveyStarted(true);
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
    generateRequirements,
    baselineRequirements,
    baselineRequirementRatings,
    showBaselinePanel
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

    // 4. Generate baseline requirements if not already done
    const hasBaselineRequirements = Object.keys(baselineRequirements).length > 0;
  
    if (!hasBaselineRequirements) {
      setSubmissionStatus('Generating baseline requirements from your initial answers...');
      wsService?.sendGenerateAllBaselineRequirements();
      return;
    }
  
    // 5. Check if all baseline requirements have been rated
    let hasPendingBaselineRequirements = false;
    Object.entries(baselineRequirements).forEach(([_, reqs]) => {
      if (reqs) {
        reqs.forEach(req => {
          if (!baselineRequirementRatings[req.id]) {
            hasPendingBaselineRequirements = true;
          }
        });
      }
    });
  
    if (hasPendingBaselineRequirements) {
      setSubmissionStatus('Please rate all requirements in the Initial Requirements Panel before submitting.');
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