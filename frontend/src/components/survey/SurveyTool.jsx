import React from 'react';
import { SplitSquareVertical, AlignJustify, Monitor, Info, Eye, EyeOff } from 'lucide-react';
import { useSurveyStore } from '../../stores/useSurveyStore';
import InstructionsModal from './InstructionPanel';

const ToolBox = () => {
  const { 
    globalDisplayMode, 
    setGlobalDisplayMode,
    showInstructions,
    toggleInstructions,
    interventionMode,  
    toggleInterventionMode,
    initiativeMode
  } = useSurveyStore();

  const cycleDisplayMode = () => {
    // Check if in fixed mode before allowing display mode changes
    if (initiativeMode === "fixed") return; // Don't allow changes in fixed mode
    
    // Normal cycling logic for mixed mode
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
        {/* Intervention Mode Toggle */}
        <button
          onClick={toggleInterventionMode}
          className="w-full px-3 py-2 rounded text-sm bg-gray-100 hover:bg-gray-200 transition-colors flex items-center gap-2"
          title={interventionMode === 'on' ? 
            "System automatically reviews text as you make changes" : 
            "Use 'Review' button to check for issues when needed"}
        >
          <div className="w-4">
            {interventionMode === 'on' ? <Eye size={16} /> : <EyeOff size={16} />}
          </div>
          <span className="text-gray-700 text-left flex-grow">
            {interventionMode === 'on' ? 'Live Analysis' : 'Manual Review'}
          </span>
        </button>

        {/* Display Mode Toggle */}
        <button
          onClick={cycleDisplayMode}
          className="w-full px-3 py-2 rounded text-sm bg-gray-100 hover:bg-gray-200 transition-colors flex items-center gap-2"
          title="Change intervention display mode"
        >
          <div className="w-4">
            {getDisplayModeIcon()}
          </div>
          <span className="text-gray-700 text-left flex-grow">{getDisplayModeLabel()}</span>
        </button>

        {/* Instructions Toggle */}
        <button
          onClick={toggleInstructions}
          className="w-full px-3 py-2 rounded text-sm bg-gray-100 hover:bg-gray-200 transition-colors flex items-center gap-2"
          title="Show instructions"
        >
          <div className="w-4">
            <Info size={16} />
          </div>
          <span className="text-gray-700 text-left flex-grow">Instructions</span>
        </button>
      </div>
      </div>

      <InstructionsModal 
        isOpen={showInstructions}
        onClose={toggleInstructions}
      />
    </>
  );
};

export default ToolBox;