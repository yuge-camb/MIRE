import React from 'react';
const InstructionsModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-semibold">Survey Instructions</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="space-y-4">
            <p className="text-gray-600">
              Welcome! This survey aims to gather insights about improving the module review web app 
              (Camments) for Cambridge Engineering students. Your responses will be analysed to develop 
              requirements to enhance both module selection and course improvement processes.
            </p>
            <p className="text-gray-600">
              Your goal is to actively provide answers that are both understandable and consistent. 
              Take time to make your responses clear and specific, review them to ensure they can be 
              easily interpreted, and check that they align with your other answers.
            </p>
            <p className="text-gray-600">
              As you go through the survey, you may receive clarifications and consistency checks 
              to refine your responses.
            </p>
            <p className="text-gray-600">
              For each question, please provide one clear point per response box. 
              Use the "Add Another Point" button to break down your complete answer into separate parts.
            </p>
          </div>
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