import React, { useState, useEffect } from 'react';
import { useSurveyStore } from '../../stores/useSurveyStore';
import { usePopper } from 'react-popper';

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

const StaleIndicator = ({ intervention, children }) => {
  const { respondToIntervention } = useSurveyStore();
  
  React.useEffect(() => {
    if (intervention.isStale) {
      const timer = setTimeout(() => {
        respondToIntervention(intervention.id, 'dismissed');
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [intervention.isStale, intervention.id, respondToIntervention]);

  return (
    <div className={intervention.isStale ? 'opacity-50' : ''}>
      {intervention.isStale && (
        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded mb-2">
          ⚠️ Content has changed. This intervention will be automatically dismissed.
        </div>
      )}
      {children}
    </div>
  );
};

const InterventionWrapper = ({ intervention, children }) => {
  const { trackInterventionInteraction } = useSurveyStore();
  return (
    <div 
      onClick={() => trackInterventionInteraction(intervention.id)}
      onFocus={() => trackInterventionInteraction(intervention.id)}
    >
      {children}
    </div>
  );
};

const AmbiguityChoiceIntervention = ({ intervention, onApply, onDismiss, isOpen}) => {
  const displayMode = useSurveyStore(state => state.getInterventionDisplayMode(intervention));
  const [selectedOption, setSelectedOption] = useState(null);
  const [showOther, setShowOther] = useState(false);
  const [otherText, setOtherText] = useState('');

  const [referenceElement, setReferenceElement] = useState(null);
  const [popperElement, setPopperElement] = useState(null);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'bottom-start',
    modifiers: [{ name: 'offset', options: { offset: [0, 10] } }]
  });
  
  // Find and set the reference element when isOpen changes
  useEffect(() => {
    if (isOpen) {
      const highlight = document.querySelector(`span[data-intervention-id="${intervention.id}"]`);
      setReferenceElement(highlight);
    }
  }, [isOpen, intervention.id]);


  const content = (
    <div className="space-y-2">
      {intervention.suggestions.map((suggestion, idx) => (
        <div key={idx} className="flex items-center gap-2">
        <button
          onClick={() => {
            setSelectedOption(idx);
            setShowOther(false);
          }}
          className="flex-1 text-left px-3 py-2 text-sm rounded hover:bg-yellow-100 transition-colors flex items-center group"
        >
          <RadioButton isSelected={selectedOption === idx} />
          {suggestion}
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(suggestion)}
          className="px-2 py-1 text-xs text-gray-500 hover:bg-yellow-100 rounded"
          title="Copy text"
        >
          📋
        </button>
      </div>
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
            disabled={intervention.isStale || selectedOption === null || (selectedOption === 'other' && !otherText)}
            className="px-3 py-1.5 text-sm bg-yellow-100 hover:bg-yellow-200 rounded transition-colors disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>
  );

  if (displayMode === 'inline') {
    // Only render the popover when isOpen is true
    if (isOpen) {
      return (
        <InterventionWrapper intervention={intervention}>
          <div
            ref={setPopperElement}
            style={styles.popper}
            {...attributes.popper}
            className="bg-white p-4 border rounded-lg shadow-lg z-50 popover-content"
          >
            <div className="space-y-3">
            {content}
            </div>
          </div>
      </InterventionWrapper>
    );
  }
    // Return null if in inline mode but not open
    return null;
  }

  return (
    <InterventionWrapper intervention={intervention}>
      <StaleIndicator intervention={intervention}>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm">
        <div className="space-y-3"> 
        <h3 className="text-sm font-medium mb-2">🤔 Choose the Most Accurate Interpretation</h3>
          <p className="text-sm mb-3">
            The phrase '<strong>{intervention.trigger_phrase}</strong>' could be interpreted in different ways:
          </p>
          {content}
          </div> 
        </div>
      </StaleIndicator>
    </InterventionWrapper>
  );
};

const AmbiguityClarificationIntervention = ({ intervention, onApply, onDismiss, isOpen }) => {
  const displayMode = useSurveyStore(state => state.getInterventionDisplayMode(intervention));

  const [referenceElement, setReferenceElement] = useState(null);
  const [popperElement, setPopperElement] = useState(null);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'bottom-start',
    modifiers: [{ name: 'offset', options: { offset: [0, 10] } }]
  });
  
  // Find and set the reference element when isOpen changes
  useEffect(() => {
    if (isOpen) {
      const highlight = document.querySelector(`span[data-intervention-id="${intervention.id}"]`);
      setReferenceElement(highlight);
    }
  }, [isOpen, intervention.id]);
  
  const content = (
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
              disabled={intervention.isStale}
              className="px-3 py-1.5 text-sm bg-yellow-100 hover:bg-yellow-200 rounded transition-colors disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>
  );

  if (displayMode === 'inline') {
    // Only render the popover when isOpen is true
    if (isOpen) {
      return (
        <InterventionWrapper intervention={intervention}>
          <div
            ref={setPopperElement}
            style={styles.popper}
            {...attributes.popper}
            className="bg-white p-4 border rounded-lg shadow-lg z-50 popover-content"
          >
            {content}
          </div>
      </InterventionWrapper>
    );
  }
    // Return null if in inline mode but not open
    return null;
  }

  return (
    <InterventionWrapper intervention={intervention}>
      <StaleIndicator intervention={intervention}>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm">
        <div className="space-y-3">
        <h3 className="text-sm font-medium mb-2">💭 Could you clarify?</h3>
          {content}
        </div>
        </div>
      </StaleIndicator>
    </InterventionWrapper>
  );
};


const InconsistencyIntervention = ({ intervention, onApply, onDismiss, isOpen }) => {
  const displayMode = useSurveyStore(state => state.getInterventionDisplayMode(intervention));

  const { segments } = useSurveyStore();
  const [showEdit, setShowEdit] = useState(false);
  const [editingText, setEditingText] = useState('');
  const [editingType, setEditingType] = useState(null); // 'current' or 'previous'
  
  const previousSegment = segments[intervention.previous_segment.uuid];
  const prevQuestionIdx = previousSegment?.questionIdx ?? intervention.previous_segment.questionIdx;
  const prevSegmentIdx = previousSegment?.segmentIdx ?? intervention.previous_segment.segmentIdx;

  const [referenceElement, setReferenceElement] = useState(null);
  const [popperElement, setPopperElement] = useState(null);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'bottom-start',
    modifiers: [{ name: 'offset', options: { offset: [0, 10] } }]
  });
  
  // Reference element is the warning box itself for inconsistency
  useEffect(() => {
    if (isOpen) {
      const warningBox = document.querySelector(`[data-warning-id="${intervention.id}"]`);
      setReferenceElement(warningBox);
    }
  }, [isOpen, intervention.id]);

  const content = (
    <div className="space-y-3 text-sm">
      <p>
        {displayMode === 'inline' 
          ? `This may contradict with response in Q${prevQuestionIdx + 1}, Segment ${prevSegmentIdx + 1}:` 
          : 'This may contradict with a previous statement:'}
      </p>
      {displayMode === 'inline' ? (
        <p className="mt-1 italic">"{intervention.previous_segment.text}"</p>
      ) : (
        <div className="p-2 bg-white/50 rounded">
          <p className="text-xs text-gray-500">
            Previous statement (Q{prevQuestionIdx + 1}, Segment {prevSegmentIdx + 1}):
          </p>
          <p className="mt-1">"{intervention.previous_segment.text}"</p>
        </div>
      )}
      
      {!showEdit ? (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingType('previous');
              setShowEdit(true);
            }}
            disabled={intervention.isStale}
            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 rounded text-sm transition-colors disabled:opacity-50"
          >
            Edit Previous
          </button>
          <button
            onClick={() => {
              setEditingType('current');
              setShowEdit(true);
            }}
            disabled={intervention.isStale}
            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 rounded text-sm transition-colors disabled:opacity-50"
          >
            Edit Current
          </button>
          <button onClick={onDismiss} className="px-3 py-1.5 hover:bg-red-100 rounded text-sm transition-colors">
            Dismiss
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            className="w-full p-2 text-sm border rounded"
            rows={3}
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            placeholder={`Type your revised ${editingType === 'current' ? 'current' : 'previous'} statement...`}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowEdit(false);
                setEditingText('');
              }}
              className="px-3 py-1.5 text-sm hover:bg-red-100 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onApply(editingType === 'current' ? 'editCurrent' : 'editPrevious', editingText)}
              disabled={intervention.isStale || !editingText.trim()}
              className="px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 rounded transition-colors disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (displayMode === 'inline') {
    if (isOpen) {
      return (
          <InterventionWrapper intervention={intervention}>
            <div
              ref={setPopperElement}
              style={styles.popper}
              {...attributes.popper}
              className="bg-white p-4 border rounded-lg shadow-lg z-50 popover-content"
            >
              {content}
            </div>
          </InterventionWrapper>
        );
      }
      return null;
  }
  
    // Default sidebar view
    return (
      <InterventionWrapper intervention={intervention}>
        <StaleIndicator intervention={intervention}>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium mb-2">⚠️ Possible Inconsistency</h3>
            {content}
          </div>
        </StaleIndicator>
      </InterventionWrapper>
    );
  };

const InterventionDisplay = ({ uuid, openInterventionId}) => {
  const { 
    segments,
    interventions, 
    respondToIntervention,
  } = useSurveyStore();

  const [error, setError] = useState(null);

  const activeInterventions = interventions.filter(int => 
    int && 
    int.uuid === uuid && 
    !int.response &&
    !int.responseTime  // Optional extra check
  );

  if (!activeInterventions.length) return null;

  // console.log('🎯 [Display] Rendering interventions for UUID:', uuid, 
  //   'Count:', activeInterventions.length);

  // Handle ambiguity cases (both multiple choice and clarification)
  const handleAmbiguityApply = async (interventionId, selectedText, triggerPhrase) => {
    try {
      const currentText = segments[uuid]?.text;
      if (!currentText) return;
      
      let newText;
      // Try to replace trigger phrase if it exists
      if (currentText.includes(triggerPhrase)) {
        newText = currentText.replace(triggerPhrase, selectedText);
      } else {
        // If trigger phrase not found (possibly due to previous edits)
        // just use the selected text as the whole segment
        newText = selectedText;
      }

      // const newText = currentText.replace(triggerPhrase, selectedText);
      await respondToIntervention(interventionId, 'applied', newText);
    } catch (err) {
      setError('Failed to apply ambiguity intervention.');
    }
  };

  // Handle inconsistency cases with text editing
  const handleInconsistencyApply = async (interventionId, prevUuid, action, newText) => {
    try {
      if (action === 'editCurrent') {
        // Update the current segment text
        await respondToIntervention(interventionId, 'applied', newText);
      } else if (action === 'editPrevious') {
        // Update the previous segment text
        await respondToIntervention(interventionId, 'applied', newText, prevUuid);
      }
    } catch (err) {
      console.error('Detailed error in handleInconsistencyApply:', err)
      setError('Failed to apply inconsistency intervention.');
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
                  onApply={(text) => handleAmbiguityApply(
                    intervention.id, 
                    text, 
                    intervention.trigger_phrase
                  )}
                  onDismiss={() => respondToIntervention(intervention.id, 'dismissed')}
                  isOpen={openInterventionId === intervention.id}
                />
              ) : intervention.type === 'ambiguity_clarification' ? (
                <AmbiguityClarificationIntervention
                  intervention={intervention}
                  onApply={(text) => handleAmbiguityApply(
                    intervention.id, 
                    text, 
                    intervention.trigger_phrase
                  )}
                  onDismiss={() => respondToIntervention(intervention.id, 'dismissed')}
                  isOpen={openInterventionId === intervention.id}

                />
              ) : intervention.type === 'consistency' ? (
                <InconsistencyIntervention
                  intervention={intervention}
                  onApply={(action, newText) => handleInconsistencyApply(
                    intervention.id,
                    intervention.previous_segment.uuid, // prevUuid
                    action,
                    newText
                  )}
                  onDismiss={() => respondToIntervention(intervention.id, 'dismissed')}
                  isOpen={openInterventionId === intervention.id}
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