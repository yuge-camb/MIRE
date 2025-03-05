import React, { useEffect } from 'react';
import { useSurveyStore } from './stores/useSurveyStore';
import SurveyContainer from './components/survey/SurveyContainer';
// import FeedbackManager from './components/feedback/FeedbackManager';
import ToolBox from './components/survey/SurveyTool';
import RequirementsPanel from './components/requirement/RequirementPanel';
import BaselineRequirementPanel from './components/requirement/BaselineRequirementPanel';

function App() {
  const { 
    initializeWebSocket, 
    disconnectWebSocket, 
    // activeChat,
    debugMode,
    showBaselinePanel
  } = useSurveyStore();

  useEffect(() => {
    initializeWebSocket();
    return () => disconnectWebSocket();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {debugMode && <DebugPanel />}
      <SurveyContainer />
      <ToolBox />
      <RequirementsPanel />
      {showBaselinePanel && <BaselineRequirementPanel />}
      {/* <FeedbackManager /> */}
    </div>
  );
}

export default App;