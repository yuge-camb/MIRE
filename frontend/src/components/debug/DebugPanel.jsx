import React from 'react';
import { useSurveyStore } from '../../stores/useSurveyStore';

const DebugPanel = () => {
  const { 
    debugMode,
    answers,
    analysisStatus,
    interventions,
    segmentTimings,
    lastInterventionTime
  } = useSurveyStore();

  if (!debugMode) return null;

  return (
    <div className="fixed left-4 top-4 w-80 bg-white shadow-lg rounded-lg p-4 overflow-y-auto max-h-[90vh]">
      <h2 className="text-lg font-semibold mb-4">Debug Information</h2>
      
      <div className="space-y-4">
        <section>
          <h3 className="font-medium text-sm text-gray-700 mb-2">Analysis Status</h3>
          <pre className="text-xs bg-gray-50 p-2 rounded">
            {JSON.stringify(analysisStatus, null, 2)}
          </pre>
        </section>

        <section>
          <h3 className="font-medium text-sm text-gray-700 mb-2">Active Interventions</h3>
          <pre className="text-xs bg-gray-50 p-2 rounded">
            {JSON.stringify(
              interventions.filter(i => !i.response),
              null, 
              2
            )}
          </pre>
        </section>

        <section>
          <h3 className="font-medium text-sm text-gray-700 mb-2">Timing Information</h3>
          <div className="text-xs">
            <p>Last Intervention: {lastInterventionTime?.toLocaleString()}</p>
            <p>Active Segments: {Object.keys(segmentTimings).length}</p>
          </div>
        </section>

        <section>
          <h3 className="font-medium text-sm text-gray-700 mb-2">Current Answers</h3>
          <pre className="text-xs bg-gray-50 p-2 rounded">
            {JSON.stringify(answers, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
};

export default DebugPanel;