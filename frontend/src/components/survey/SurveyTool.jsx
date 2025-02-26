import React from 'react';
import { SplitSquareVertical, AlignJustify, Monitor, Info } from 'lucide-react';
import { useSurveyStore } from '../../stores/useSurveyStore';
import InstructionsModal from './InstructionPanel';

const ToolBox = () => {
  const { 
    globalDisplayMode, 
    setGlobalDisplayMode,
    showInstructions,
    toggleInstructions
  } = useSurveyStore();

  const cycleDisplayMode = () => {
    const modes = ['panel', 'inline', 'default'];
    const currentIndex = modes.indexOf(globalDisplayMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setGlobalDisplayMode(nextMode);
  };

  const getDisplayModeIcon = () => {
    switch (globalDisplayMode) {
      case 'panel':
        return <SplitSquareVertical size={16} />;
      case 'inline':
        return <AlignJustify size={16} />;
      case 'default':
        return <Monitor size={16} />;
    }
  };

  const getDisplayModeLabel = () => {
    switch (globalDisplayMode) {
      case 'panel':
        return 'Panel';
      case 'inline':
        return 'Inline';
      case 'default':
        return 'Default';
    }
  };

  return (
    <>
      <div className="fixed left-4 top-1/3 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2 w-[140px]">
        <div className="space-y-2">
          {/* Display Mode Toggle */}
          <button
            onClick={cycleDisplayMode}
            className="w-full px-3 py-2 rounded text-sm bg-gray-100 hover:bg-gray-200 transition-colors flex items-center gap-2"
            title="Change intervention display mode"
          >
            {getDisplayModeIcon()}
            <span className="text-gray-700">{getDisplayModeLabel()}</span>
          </button>

          {/* Instructions Toggle */}
          <button
            onClick={toggleInstructions}
            className="w-full px-3 py-2 rounded text-sm bg-gray-100 hover:bg-gray-200 transition-colors flex items-center gap-2"
            title="Show instructions"
          >
            <Info size={16} />
            <span className="text-gray-700">Instructions</span>
          </button>
        </div>
      </div>

          {/* Requirements Panel Toggle */}
            {/* <button
            onClick={toggleRequirementsPanel}
            className={`w-full px-3 py-2 rounded text-sm ${
              showRequirementsPanel ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
            } hover:bg-gray-200 transition-colors flex items-center gap-2`}
            title="Toggle requirements panel"
          >
            <FileText size={16} />
            <span>Requirements</span>
          </button> */}

      <InstructionsModal 
        isOpen={showInstructions}
        onClose={toggleInstructions}
      />
    </>
  );
};

export default ToolBox;