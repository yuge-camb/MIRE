import React, { useState, useEffect } from 'react';
import { useSurveyStore } from '../../stores/useSurveyStore';
import FeedbackForm from './FeedbackForm';

const FeedbackManager = () => {
  const { 
    interventions, 
    submitInterventionFeedback,
    submitBulkFeedback,
    bulkDismissalMode,
    bulkDismissalInterventions,
    wsService, 
    pauseActivityTracking, 
    resumeActivityTracking 
  } = useSurveyStore();
  
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentIntervention, setCurrentIntervention] = useState(null);

  useEffect(() => {
    // Handle bulk dismissal mode
    if (bulkDismissalMode && bulkDismissalInterventions.length > 0) {
      setShowFeedback(true);
      return;
    }

    // Regular single intervention feedback
    const lastResponded = interventions.find(int => 
      int.responseTime && 
      !int.isStale && 
      !int.feedbackSubmitted
    );
      
    if (lastResponded) {
      wsService?.pauseAnalysis();
      pauseActivityTracking();
      setCurrentIntervention(lastResponded);
      setShowFeedback(true);
    }
  }, [interventions, bulkDismissalMode, bulkDismissalInterventions]);

  const handleClose = () => {
    setShowFeedback(false);
    setCurrentIntervention(null);
  };

  const handleSubmit = (feedbackData) => {
    if (bulkDismissalMode) {
      submitBulkFeedback(feedbackData);
    } else {
      submitInterventionFeedback(currentIntervention.id, feedbackData);
      wsService?.resumeAnalysis();
      resumeActivityTracking();
    }
    handleClose();
  };

  return (
    <FeedbackForm 
      isOpen={showFeedback}
      onClose={handleClose}
      onSubmit={handleSubmit}
      intervention={currentIntervention}
      isBulkDismissal={bulkDismissalMode}
      bulkCount={bulkDismissalInterventions.length}
    />
  );
};

export default FeedbackManager;