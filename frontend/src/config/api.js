// API Configuration
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://epic-mind-backend.onrender.com'  // Production
  : 'http://localhost:5008';                   // Local development

export default API_BASE_URL;

// Debug helper for development
if (!import.meta.env.PROD) {
  console.log('🔧 Development Mode');
  console.log('🔗 API Base URL:', API_BASE_URL);
}