import React, { useState, useEffect } from 'react';
import { useSurveyStore } from '../../stores/useSurveyStore';
import FeedbackForm from './FeedbackForm';

const FeedbackManager = () => {
  const { interventions, submitInterventionFeedback, wsService, pauseActivityTracking, resumeActivityTracking } = useSurveyStore();
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentIntervention, setCurrentIntervention] = useState(null);

  useEffect(() => {
    const lastResponded = interventions.find(int => 
      int.responseTime && 
      !int.isStale && 
      !int.feedbackSubmitted
    );
      
    if (lastResponded) {
      // Pause analysis when feedback form opens
      wsService?.pauseAnalysis();
      pauseActivityTracking();
      setCurrentIntervention(lastResponded);
      setShowFeedback(true);
    }
  }, [interventions]);

  return (
    <FeedbackForm 
      isOpen={showFeedback}
      onClose={() => {
        setShowFeedback(false);
        setCurrentIntervention(null);
        // Resume analysis when feedback form closes
        wsService?.resumeAnalysis();
        resumeActivityTracking();
      }}
      onSubmit={(feedbackData) => {
        submitInterventionFeedback(currentIntervention.id, feedbackData);
        setShowFeedback(false);
        setCurrentIntervention(null);
      }}
      intervention={currentIntervention}
    />
  );
};

export default FeedbackManager;