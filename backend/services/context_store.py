import os
import json
import logging

# Global storage for context data
_CURRENT_CONTEXT_ID = "context1"  # Default to context1
_CONTEXT_DATA = {}

def _init_contexts():
    """Initialize contexts from a single file (called on module import)"""
    global _CONTEXT_DATA
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    contexts_path = os.path.join(current_dir, 'contexts.json')
    
    try:
        with open(contexts_path, 'r') as f:
            _CONTEXT_DATA = json.load(f)
        logging.info(f"Loaded contexts from {contexts_path}")
    except Exception as e:
        logging.error(f"Failed to load contexts: {e}")

def set_context(context_id):
    """Set which context should be active"""
    global _CURRENT_CONTEXT_ID
    print(f"DEBUG: Setting context from {_CURRENT_CONTEXT_ID} to {context_id}")
    print(f"DEBUG: Available contexts: {list(_CONTEXT_DATA.keys())}")

    if context_id in _CONTEXT_DATA:
        _CURRENT_CONTEXT_ID = context_id
        logging.info(f"Context set to: {context_id}")
    else:
        logging.warning(f"Context '{context_id}' not found, using context1")
        _CURRENT_CONTEXT_ID = "context1"

def load_context():
    """Get current context data (questions and system_context)"""
    context = _CONTEXT_DATA.get(_CURRENT_CONTEXT_ID, _CONTEXT_DATA.get("context1", {}))
    return context.get("questions", {}), context.get("system_context", {
        "name": "System",
        "description": "",
        "type": "Web Application"
    })

# Initialize contexts when this module is imported
_init_contexts()