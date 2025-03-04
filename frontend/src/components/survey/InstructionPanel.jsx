import React from 'react';
import { useSurveyStore } from '../../stores/useSurveyStore';
import { getContextDetails } from './QuestionContexts';

const InstructionsModal = ({ isOpen, onClose }) => {
    
    // Get initiative mode and active context from store
    const initiativeMode = useSurveyStore(state => state.initiativeMode);
    const sessionId = useSurveyStore(state => state.sessionId);
    const activeContext = useSurveyStore(state => state.activeContext);
    const contextDetails = getContextDetails(activeContext);
    
    if (!isOpen) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-semibold">Instructions</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          {initiativeMode === "mixed" && (
            <div className="text-gray-600 mb-4 text-left">
              <p>
                {contextDetails.description}
              </p>
              <p className="mt-2">
                Your task is to provide thoughtful responses to questions about what features this system should include. Please consider your needs as {contextDetails.user} who would use this platform. Be as specific and clear as possible in your responses.
              </p>
              <p className="mt-2">
                In this <strong>mixed-initiative mode</strong>, the system will automatically analyse your responses and provide interventions when it detects potential ambiguities or inconsistencies. It also automatically generates requirements when it detects your answers for a question have stabilised. You can:
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

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  };

export default InstructionsModal;