// API Configuration
const API_BASE_URL = import.meta.env.PROD
  ? 'https://api.theepicmind.com.sg'          // Production (NAS)
  : 'http://localhost:5008';                   // Local development

export default API_BASE_URL;

/**
 * Wrapper around fetch that automatically adds Authorization header
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function authFetch(url, options = {}) {
  const token = sessionStorage.getItem('token');

  const headers = {
    ...options.headers,
  };

  // Add auth header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Add Content-Type for JSON if body is present and not FormData
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

// Debug helper for development
if (!import.meta.env.PROD) {
  console.log('🔧 Development Mode');
  console.log('🔗 API Base URL:', API_BASE_URL);
}