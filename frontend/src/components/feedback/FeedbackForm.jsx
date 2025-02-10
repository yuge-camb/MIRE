import React, { useState } from 'react';

const FeedbackForm = ({ isOpen, onClose, onSubmit, intervention }) => {
  const [issueValidation, setIssueValidation] = useState('');
  const [partialExplanation, setPartialExplanation] = useState('');
  const [activity, setActivity] = useState('');
  const [otherActivity, setOtherActivity] = useState('');
  const [timingRating, setTimingRating] = useState(3);
  const [focusImpact, setFocusImpact] = useState(3);
  const [experienceFeedback, setExperienceFeedback] = useState('');

  const resetForm = () => {
    setIssueValidation('');
    setPartialExplanation('');
    setActivity('');
    setOtherActivity('');
    setTimingRating(3);
    setFocusImpact(3);
    setExperienceFeedback('');
  };

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
    resetForm();
    onClose();
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg mt-12 mb-4">
        {/* Header */}
        <div className="sticky top-0 bg-white p-2 border-b rounded-t-lg">
          <h2 className="text-lg font-semibold">Provide Feedback</h2>
          <p className="text-sm text-gray-600 mt-2">Your feedback is mandatory for every intervention you deal with. They help inform how useful/timely each intervention is. Thank you!</p>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          <div className="space-y-6">
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
                  'Editing previous requirements',
                  'Dealing with other interventions',
                  'Thinking/Pausing/Reviewing',
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

            {/* Timing and Focus Impact Ratings */}
            <div className="space-y-4">
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

              <div>
                <label className="block text-sm font-medium mb-2">
                How disruptive was this intervention to your focus?
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
            </div>

            {/* Experience Feedback */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Additional comments about how this intervention fit into your work process:
              </label>
              <textarea
                value={experienceFeedback}
                onChange={(e) => setExperienceFeedback(e.target.value)}
                className="w-full p-3 border rounded resize-y"
                rows={4}
              />
            </div>
          </div>
        </div>

        {/* Footer - Fixed at bottom */}
        <div className="sticky bottom-0 bg-white p-4 border-t flex justify-end">
            {/* Only using the Submit button, removed cancel button to force users to submit feedback */}
            {/* <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            >
            Cancel
            </button> */}
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={!issueValidation || !activity || (activity === 'other' && !otherActivity)}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackForm;