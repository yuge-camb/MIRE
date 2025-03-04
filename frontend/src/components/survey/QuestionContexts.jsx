export const CONTEXTS = {
    // Context 1: JCR Welfare System
    "context1": {
      title: "Cambridge College JCR Welfare System",
      description: "Help us design a digital platform to support the JCR welfare team in providing student support services, managing resources, and coordinating welfare activities within a Cambridge college.",
      user: "a member of your college's JCR team",
      questions: [
        { id: 0, text: "What communication features should the system include for students to request welfare support from the JCR team? (at least 2 general ideas and 2 specific implementation details; one point per response box)"},
        { id: 1, text: "What inventory management capabilities does the welfare team need to track and distribute physical resources (e.g., wellbeing materials, snacks)? (at least 2 general ideas and 2 specific implementation details; one point per response box)" },
        { id: 2, text: "What features should the system include to help the welfare team plan, schedule, and manage welfare events and support sessions? (at least 2 general ideas and 2 specific implementation details; one point per response box)" },
        { id: 3, text: "What functions should be available to allow for smooth annual handover between outgoing and incoming welfare officers? (at least 2 general ideas and 2 specific implementation details; one point per response box)" }]
    },
    
    // Context 2: Student Society Event Management
    "context2": {
      title: "Cambridge Student Society Event Management Platform",
      description: "Help us design a digital platform for student societies to plan, promote, execute, and evaluate events, while managing resources, member participation, and society growth.",
      user: "a committee member of a Cambridge student society",
      questions: [
        { id: 0, text: "What event planning tools should the system provide for society committees to organize events from conception to execution? (at least 2 general ideas and 2 specific implementation details; one point per response box)"},
        { id: 1, text: "What features should the system include to help societies during the actual execution of events (e.g., check-in, attendee management, real-time coordination)? (at least 2 general ideas and 2 specific implementation details; one point per response box)" },
        { id: 2, text: "What financial management capabilities should the system offer to help societies track event budgets and expenses? (at least 2 general ideas and 2 specific implementation details; one point per response box)" },
        { id: 3, text: "What analytics and reporting features should the system provide to help societies evaluate past events and plan future ones? (at least 2 general ideas and 2 specific implementation details; one point per response box)" }
      ]
    }
  };
  
  // Helper function to get questions from a context
  export const getQuestionsForContext = (contextId) => {
    const context = CONTEXTS[contextId];
    return context.questions;
  };
  
  // Helper function to get context details
  export const getContextDetails = (contextId) => {
    return CONTEXTS[contextId];
  };

// const QUESTIONS = [
//   { id: 0, text: "If you were using an app to look up module reviews, what information would you want to see? (one point per response box)"},
//   { id: 1, text: "What information about a reviewer would make their feedback more relevant for someone choosing a module? (one point per response box)" },
//   { id: 2, text: "What filtering or sorting options should the app offer to help students find modules aligned with their priorities? (one point per response box)" },
//   { id: 3, text: "What features in a review app would make it more likely for you to submit reviews for modules you've taken? (one point per response box)" },
//   { id: 4, text: "How could the app help professors or departments use student reviews to improve modules? (one point per response box)" },
//   { id: 5, text: "What additional features do you wish a module review app would have? (one point per response box)" }
// ];
