import React, { useEffect } from 'react';
import { useSurveyStore } from './stores/useSurveyStore';
import SurveyContainer from './components/survey/SurveyContainer';
import ChatInterface from './components/chat/ChatInterface';
import DebugPanel from './components/debug/DebugPanel';
import FeedbackManager from './components/feedback/FeedbackManager';
import ToolBox from './components/survey/SurveyTool';

function App() {
  const { 
    initializeWebSocket, 
    disconnectWebSocket, 
    // activeChat,
    debugMode
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
      {/* {activeChat !== undefined && (
        <ChatInterface questionId={activeChat} />
      )} */}
      {/* <FeedbackManager /> */}
    </div>
  );
}

export default App;