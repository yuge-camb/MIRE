import React, { useState } from 'react';
import { useSurveyStore } from '../../stores/useSurveyStore';

const RadioButton = ({ isSelected }) => (
  <div 
    className="flex-shrink-0 inline-flex items-center justify-center mr-3"
    style={{ 
      width: '20px', 
      height: '20px',
      minWidth: '20px',
      minHeight: '20px',
      borderRadius: '50%',
      border: '2px solid #9ca3af'
    }}
  >
    <div 
      className={`rounded-full transition-all duration-150 ${
        isSelected ? 'bg-gray-600 scale-100' : 'bg-transparent scale-0'
      }`}
      style={{ 
        width: '10px', 
        height: '10px',
        minWidth: '10px',
        minHeight: '10px'
      }}
    />
  </div>
);

const AmbiguityChoiceIntervention = ({ intervention, onApply, onDismiss }) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [showOther, setShowOther] = useState(false);
  const [otherText, setOtherText] = useState('');

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm">
      <h3 className="text-sm font-medium mb-2">🤔 Choose the Most Accurate Interpretation</h3>
      <p className="text-sm mb-3">
        The phrase '<strong>{intervention.trigger_phrase}</strong>' could be interpreted in different ways:
      </p>
      <div className="space-y-2">
        {intervention.suggestions.map((suggestion, idx) => (
          <button
            key={idx}
            onClick={() => {
              setSelectedOption(idx);
              setShowOther(false);
            }}
            className="w-full text-left px-3 py-2 text-sm rounded hover:bg-yellow-100 transition-colors flex items-center group"
          >
            <RadioButton isSelected={selectedOption === idx} />
            {suggestion}
          </button>
        ))}
        <button
          onClick={() => {
            setShowOther(true);
            setSelectedOption('other');
          }}
          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-yellow-100 transition-colors flex items-center group"
        >
          <RadioButton isSelected={selectedOption === 'other'} />
          Other (please specify)
        </button>
        {showOther && (
          <textarea
            className="w-full p-2 text-sm border rounded mt-2"
            rows={2}
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            placeholder="Specify your interpretation..."
          />
        )}
        <div className="flex gap-2 justify-end mt-3">
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 text-sm hover:bg-yellow-100 rounded transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={() => {
              let textToApply;
              if (selectedOption === 'other') {
                textToApply = otherText;
              } else {
                textToApply = intervention.suggestions[selectedOption];
              }
              if (textToApply) onApply(textToApply);
            }}
            disabled={selectedOption === null || (selectedOption === 'other' && !otherText)}
            className="px-3 py-1.5 text-sm bg-yellow-100 hover:bg-yellow-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

const AmbiguityClarificationIntervention = ({ intervention, onApply, onDismiss }) => (
  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm">
    <h3 className="text-sm font-medium mb-2">💭 Could you clarify?</h3>
    <div className="space-y-3">
      <p className="text-sm">
        Please clarify what you mean by '<strong>{intervention.trigger_phrase}</strong>':
      </p>
      <textarea 
        className="w-full p-2 text-sm border rounded"
        rows={3}
        placeholder="Type your clarification here..."
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onApply(e.target.value);
          }
        }}
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 text-sm hover:bg-yellow-100 rounded transition-colors"
        >
          Dismiss
        </button>
        <button
          onClick={(e) => {
            const textarea = e.target.parentElement.parentElement.querySelector('textarea');
            if (textarea.value) onApply(textarea.value);
          }}
          className="px-3 py-1.5 text-sm bg-yellow-100 hover:bg-yellow-200 rounded transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  </div>
);

const InconsistencyIntervention = ({ intervention, onApply, onDismiss }) => {
  const { segments } = useSurveyStore();
  
  const previousSegment = segments[intervention.previous_segment.uuid];
  const prevQuestionIdx = previousSegment?.questionIdx ?? intervention.previous_segment.questionIdx;
  const prevSegmentIdx = previousSegment?.segmentIdx ?? intervention.previous_segment.segmentIdx;

  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg shadow-sm">
      <h3 className="text-sm font-medium mb-2">⚠️ Possible Inconsistency</h3>
      <div className="space-y-3 text-sm">
        <p>This may contradict with a previous statement:</p>
        <div className="p-2 bg-white/50 rounded">
          <p className="text-xs text-gray-500">
            Previous statement (Q{prevQuestionIdx + 1}, Segment {prevSegmentIdx + 1}):
          </p>
          <p className="mt-1">"{intervention.previous_segment.text}"</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onApply('editPrevious')}
            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 rounded text-sm transition-colors"
          >
            Edit Previous
          </button>
          <button
            onClick={() => onApply('editCurrent')}
            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 rounded text-sm transition-colors"
          >
            Edit Current
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 hover:bg-red-100 rounded text-sm transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

const InterventionDisplay = ({ uuid }) => {
  const { 
    segments,
    interventions, 
    respondToIntervention,
    updateSegment
  } = useSurveyStore();

  const [error, setError] = useState(null);

  const activeInterventions = interventions.filter(
    int => int && int.uuid === uuid && !int.response
  );

  if (!activeInterventions.length) return null;

  console.log('🎯 [Display] Rendering interventions for UUID:', uuid, 
    'Count:', activeInterventions.length);
    
  const handleApply = async (interventionId, selectedText) => {
    try {
      const intervention = activeInterventions.find(i => i.id === interventionId);
      if (!intervention) return;

      if (intervention.type === 'ambiguity_multiple_choice' || intervention.type === 'ambiguity_clarification') {
        const currentText = segments[uuid]?.text;
        if (!currentText) return;
        const newText = currentText.replace(
          intervention.trigger_phrase, 
          selectedText
        );
        updateSegment(uuid, newText);
      }
      await respondToIntervention(interventionId, 'applied');
    } catch (err) {
      setError('Failed to apply intervention.');
    }
  };

  return (
    <div className="overflow-y-auto max-h-[300px] pr-2">
      <div className="space-y-3">
        {activeInterventions.map((intervention, index) => (
          <div 
            key={`${intervention.id}-${index}`}
            className="min-w-[350px] transition-all"
          >
            {intervention && intervention.type && (
              intervention.type === 'ambiguity_multiple_choice' ? (
                <AmbiguityChoiceIntervention
                  intervention={intervention}
                  onApply={(text) => handleApply(intervention.id, text)}
                  onDismiss={() => respondToIntervention(intervention.id, 'dismissed')}
                />
              ) : intervention.type === 'ambiguity_clarification' ? (
                <AmbiguityClarificationIntervention
                  intervention={intervention}
                  onApply={(text) => handleApply(intervention.id, text)}
                  onDismiss={() => respondToIntervention(intervention.id, 'dismissed')}
                />
              ) : intervention.type === 'consistency' ? (
                <InconsistencyIntervention
                  intervention={intervention}
                  onApply={() => handleApply(intervention.id, 'revise')}
                  onDismiss={() => respondToIntervention(intervention.id, 'dismissed')}
                />
              ) : null
            )}
          </div>
        ))}
        {error && (
          <div className="text-red-500 text-sm mt-2">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default InterventionDisplay;