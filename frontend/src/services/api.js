// api.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api'
});

export const apiService = {
  // // Interventions 
  // respondToIntervention: async (interventionId, response) => {
  //   await api.post(`/interventions/${interventionId}/response`, { response });
  // },

  // Chat
  sendChatMessage: async (questionId, message) => {
    const response = await api.post('/chat/message', {
      questionId,
      message
    });
    return response.data;
  },

  // Survey submission
  submitSurvey: async (data) => {
    const response = await api.post('/survey/submit', data);
    return response.data;
  }
};