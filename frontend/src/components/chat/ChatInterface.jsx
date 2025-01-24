import React, { useState } from 'react';
import { useSurveyStore } from '../../stores/useSurveyStore';

const ChatInterface = ({ questionId }) => {
  const [message, setMessage] = useState('');
  const { 
    chatHistory, 
    addChatMessage, 
    setActiveChat,
    wsService 
  } = useSurveyStore();
  
  const messages = chatHistory[questionId] || [];

  const handleSend = () => {
    if (!message.trim()) return;
    
    // Add user message
    addChatMessage(questionId, 'user', message);
    
    // TODO: Send to backend and get AI response
    // For now, simulate AI response
    setTimeout(() => {
      addChatMessage(questionId, 'assistant', 'This is a simulated AI response.');
    }, 1000);
    
    setMessage('');
  };

  return (
    <div className="fixed right-4 bottom-4 w-96 h-[500px] bg-white shadow-lg rounded-lg flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold">AI Assistant - Question {questionId + 1}</h3>
        <button 
          onClick={() => setActiveChat(undefined)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <div 
            key={index}
            className={`p-3 rounded-lg max-w-[80%] ${
              msg.role === 'user' 
                ? 'bg-blue-100 ml-auto' 
                : 'bg-gray-100'
            }`}
          >
            {msg.content}
          </div>
        ))}
      </div>
      
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 p-2 border rounded"
            placeholder="Type your message..."
          />
          <button
            onClick={handleSend}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;