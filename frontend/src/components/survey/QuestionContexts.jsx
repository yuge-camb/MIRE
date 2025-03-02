export const CONTEXTS = {
    // Context 1: Engineering Project Collaboration Platform
    "context1": {
      title: "Engineering Project Collaboration Platform",
      description: "Help us design a platform for engineering students to find teammates, manage group projects, track contributions, and share project artifacts.",
      questions: [
        { id: 0, text: "What features would help you find suitable teammates for engineering projects? (one point per response box)"},
        { id: 1, text: "What tools would help your team coordinate tasks and deadlines effectively? (one point per response box)" },
        { id: 2, text: "What information should be tracked about individual contributions to group projects? (one point per response box)" },
        { id: 3, text: "What features would make sharing project files and documentation easier? (one point per response box)" },
        { id: 4, text: "How could the platform help teams communicate with their supervisors? (one point per response box)" },
        { id: 5, text: "What additional features would you want in a project collaboration platform? (one point per response box)" }
      ]
    },
    
    // Context 2: Engineering Resource Library System
    "context2": {
      title: "Engineering Resource Library System",
      description: "Help us design a platform for discovering, organizing, and rating study materials, reference documents, and practice problems for engineering courses.",
      questions: [
        { id: 0, text: "What search and filtering capabilities would help you find relevant engineering resources? (one point per response box)"},
        { id: 1, text: "What information about each resource would help you determine its usefulness? (one point per response box)" },
        { id: 2, text: "What features would encourage students to contribute and organize materials? (one point per response box)" },
        { id: 3, text: "How should resources be categorized or tagged for easy discovery? (one point per response box)" },
        { id: 4, text: "What feedback mechanisms would help improve resource quality over time? (one point per response box)" },
        { id: 5, text: "What additional features would make the resource library valuable for your studies? (one point per response box)" }
      ]
    }
  };

// Default context if none specified
export const DEFAULT_CONTEXT = "context1";

// Helper function to get questions from a context
export const getQuestionsForContext = (contextId) => {
  const context = CONTEXTS[contextId] || CONTEXTS[DEFAULT_CONTEXT];
  return context.questions;
};

// Helper function to get context details
export const getContextDetails = (contextId) => {
  return CONTEXTS[contextId] || CONTEXTS[DEFAULT_CONTEXT];
};

// const QUESTIONS = [
//   { id: 0, text: "If you were using an app to look up module reviews, what information would you want to see? (one point per response box)"},
//   { id: 1, text: "What information about a reviewer would make their feedback more relevant for someone choosing a module? (one point per response box)" },
//   { id: 2, text: "What filtering or sorting options should the app offer to help students find modules aligned with their priorities? (one point per response box)" },
//   { id: 3, text: "What features in a review app would make it more likely for you to submit reviews for modules you've taken? (one point per response box)" },
//   { id: 4, text: "How could the app help professors or departments use student reviews to improve modules? (one point per response box)" },
//   { id: 5, text: "What additional features do you wish a module review app would have? (one point per response box)" }
// ];
