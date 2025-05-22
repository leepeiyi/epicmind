// API Configuration
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://epic-mind-backend.onrender.com'  // Your actual Render URL
  : 'http://localhost:5008';

export default API_BASE_URL;