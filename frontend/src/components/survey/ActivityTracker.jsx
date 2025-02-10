import React, { useEffect, useRef } from 'react';
import { useSurveyStore } from '../../stores/useSurveyStore';
import _ from 'lodash';

const ActivityTracker = () => {
  const { addActivityEvent, isPaused } = useSurveyStore();
  
  // Refs for tracking typing patterns
  const typingRef = useRef({
    isTyping: false,
    lastTypeTime: null,
    typeCount: 0,
    typingStartTime: null,
    currentSegmentId: null
  });

  // Ref for scroll tracking
  const scrollRef = useRef({
    lastPosition: 0,
    lastTimestamp: Date.now()
  });

  // Handle typing activity
  const handleTypingStart = (segmentId) => {
    if (!typingRef.current.isTyping && !isPaused) {
      typingRef.current = {
        isTyping: true,
        lastTypeTime: Date.now(),
        typeCount: 1,
        typingStartTime: Date.now(),
        currentSegmentId: segmentId
      };

      addActivityEvent({
        type: 'activity',
        eventType: 'typing_started',
        timestamp: Date.now(),
        timestampString: new Date().toISOString(),
        context: {
          segmentId: segmentId
        }
      });
    }
  };

  const handleTypingStop = () => {
    if (typingRef.current.isTyping && !isPaused) {
      const duration = Date.now() - typingRef.current.typingStartTime;
      const typingSpeed = typingRef.current.typeCount / (duration / 1000); // characters per second

      addActivityEvent({
        type: 'activity',
        eventType: 'typing_stopped',
        timestamp: Date.now(),
        timestampString: new Date().toISOString(),
        context: {
          segmentId: typingRef.current.currentSegmentId,
          duration: duration,
          typingSpeed: typingSpeed,
          characterCount: typingRef.current.typeCount
        }
      });

      typingRef.current.isTyping = false;
    }
  };

  // Debounced version of typing stop
  const debouncedTypingStop = _.debounce(handleTypingStop, 1500);

  const handleKeyPress = (e) => {
    if (isPaused) return; // Don't track when paused
    
    const segmentId = e.target.getAttribute('data-segment-id');
    if (!segmentId) return; // Only track typing in segments

    typingRef.current.typeCount++;
    typingRef.current.lastTypeTime = Date.now();
    
    handleTypingStart(segmentId);
    debouncedTypingStop();
  };

  // Handle segment focus changes
  const handleFocusChange = (e) => {
    if (isPaused) return; // Don't track when paused
    
    const segmentId = e.target.getAttribute('data-segment-id');
    if (!segmentId) return;

    addActivityEvent({
      type: 'activity',
      eventType: 'segment_focus_changed',
      timestamp: Date.now(),
      timestampString: new Date().toISOString(),
      context: {
        segmentId: segmentId,
        previousSegmentId: typingRef.current.currentSegmentId
      }
    });

    // Update current segment
    typingRef.current.currentSegmentId = segmentId;
  };

  // Handle scroll with velocity
  const handleScroll = _.throttle(() => {
    if (isPaused) return; // Don't track when paused
    
    const currentPosition = window.scrollY;
    const currentTime = Date.now();
    
    // Calculate scroll velocity
    const timeDiff = currentTime - scrollRef.current.lastTimestamp;
    const positionDiff = Math.abs(currentPosition - scrollRef.current.lastPosition);
    const velocity = timeDiff > 0 ? (positionDiff / timeDiff) * 1000 : 0; // pixels per second

    addActivityEvent({
      type: 'activity',
      eventType: 'scroll',
      timestamp: Date.now(),
      timestampString: new Date().toISOString(),
      context: {
        position: currentPosition,
        velocity: velocity,
        direction: currentPosition > scrollRef.current.lastPosition ? 'down' : 'up'
      }
    });

    // Update scroll tracking ref
    scrollRef.current = {
      lastPosition: currentPosition,
      lastTimestamp: currentTime
    };
  }, 500);

  // Handle cursor movement
  const handleCursorMove = _.throttle((e) => {
    if (isPaused) return; // Don't track when paused
    
    addActivityEvent({
      type: 'activity',
      eventType: 'cursor_moved',
      timestamp: Date.now(),
      timestampString: new Date().toISOString(),
      context: {
        position: {
          x: e.clientX,
          y: e.clientY
        }
      }
    });
  }, 1000); // Track cursor position every second

  // Setup event listeners
  useEffect(() => {
    const surveyContainer = document.getElementById('survey-container');
    if (!surveyContainer) return;

    surveyContainer.addEventListener('keypress', handleKeyPress);
    surveyContainer.addEventListener('focusin', handleFocusChange);
    window.addEventListener('scroll', handleScroll);
    surveyContainer.addEventListener('mousemove', handleCursorMove);

    return () => {
      surveyContainer.removeEventListener('keypress', handleKeyPress);
      surveyContainer.removeEventListener('focusin', handleFocusChange);
      window.removeEventListener('scroll', handleScroll);
      surveyContainer.removeEventListener('mousemove', handleCursorMove);
      
      handleTypingStop(); // Clean up any ongoing typing tracking
      debouncedTypingStop.cancel();
      handleScroll.cancel();
      handleCursorMove.cancel();
    };
  }, [isPaused]); // Re-attach listeners when pause state changes

  return null; // This component doesn't render anything
};

export default ActivityTracker;