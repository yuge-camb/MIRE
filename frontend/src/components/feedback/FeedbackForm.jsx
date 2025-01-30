import React, { useState } from 'react';

const FeedbackForm = ({ isOpen, onClose, onSubmit, intervention }) => {
  const [issueValidation, setIssueValidation] = useState('');
  const [partialExplanation, setPartialExplanation] = useState('');
  const [activity, setActivity] = useState('');
  const [otherActivity, setOtherActivity] = useState('');
  const [timingRating, setTimingRating] = useState(3);
  const [focusImpact, setFocusImpact] = useState(3);
  const [experienceFeedback, setExperienceFeedback] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSubmit({
      issueValidation,
      ...(issueValidation === 'partially' && { partialExplanation }),
      activity: activity === 'other' ? otherActivity : activity,
      timingRating,
      focusImpact,
      experienceFeedback,
      interventionId: intervention.id,
      timestamp: new Date().toISOString()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full">
        <h2 className="text-lg font-semibold mb-4">Provide Feedback</h2>
        
        <div className="space-y-4">
          {/* Issue Validation */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Was this actually an issue that needed addressing?
            </label>
            <div className="space-y-2">
              {[
                { value: 'yes', label: 'Yes, the text was truly ambiguous/inconsistent' },
                { value: 'no', label: 'No, the text was already clear/consistent' },
                { value: 'partially', label: 'Partially' }
              ].map((option) => (
                <div key={option.value}>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      value={option.value}
                      checked={issueValidation === option.value}
                      onChange={(e) => setIssueValidation(e.target.value)}
                      className="rounded-full border-gray-300"
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                  {option.value === 'partially' && issueValidation === 'partially' && (
                    <textarea
                      value={partialExplanation}
                      onChange={(e) => setPartialExplanation(e.target.value)}
                      placeholder="Please explain..."
                      className="mt-2 w-full p-2 text-sm border rounded"
                      rows={2}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Activity Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              What were you doing when interrupted?
            </label>
            <div className="space-y-2">
              {[
                'Typing new requirement',
                'Reviewing previous requirements',
                'Editing/modifying requirements',
                'Thinking/pausing',
                'Other'
              ].map((option) => (
                <div key={option}>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      value={option.toLowerCase()}
                      checked={activity === option.toLowerCase()}
                      onChange={(e) => setActivity(e.target.value)}
                      className="rounded-full border-gray-300"
                    />
                    <span className="text-sm">{option}</span>
                  </label>
                  {option === 'Other' && activity === 'other' && (
                    <textarea
                      value={otherActivity}
                      onChange={(e) => setOtherActivity(e.target.value)}
                      placeholder="Please specify..."
                      className="mt-2 w-full p-2 text-sm border rounded"
                      rows={2}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Timing Rating */}
          <div>
            <label className="block text-sm font-medium mb-2">
              How well did the timing of this intervention align with your work flow?
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={timingRating}
              onChange={(e) => setTimingRating(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Very Poorly Timed</span>
              <span>Very Well Timed</span>
            </div>
          </div>

          {/* Focus Impact */}
          <div>
            <label className="block text-sm font-medium mb-2">
              How did this intervention affect your focus at that moment?
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={focusImpact}
              onChange={(e) => setFocusImpact(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Very Disruptive</span>
              <span>Very Natural</span>
            </div>
          </div>

          {/* Experience Feedback */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Additional comments about how this intervention fit into your work process:
            </label>
            <textarea
              value={experienceFeedback}
              onChange={(e) => setExperienceFeedback(e.target.value)}
              className="w-full p-3 border rounded min-h-[100px] resize-y"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-2 mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              disabled={!issueValidation || !activity || (activity === 'other' && !otherActivity) || (issueValidation === 'partially' && !partialExplanation)}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackForm;