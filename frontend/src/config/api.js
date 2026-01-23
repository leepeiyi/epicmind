// API Configuration
const API_BASE_URL = import.meta.env.PROD
  ? 'https://api.theepicmind.com.sg'          // Production (NAS)
  : 'http://localhost:5008';                   // Local development

export default API_BASE_URL;

/**
 * Convert relative image URLs to absolute URLs with API base
 * Handles /uploads/ paths and ensures proper URL encoding for special characters
 */
export function getAbsoluteImageUrl(input) {
  if (!input) return input;

  // Handle object input (e.g., {url: "...", is_answer: true})
  let url = input;
  if (typeof input === 'object') {
    url = input.url || input.image_url || input.path || input.src || '';
  }

  // Ensure url is a string
  if (typeof url !== 'string') return '';

  // If already absolute URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // If relative path starting with /uploads, prepend API base URL
  if (url.startsWith('/uploads')) {
    return `${API_BASE_URL}${url}`;
  }

  // For other relative paths, also prepend API base URL
  if (url.startsWith('/')) {
    return `${API_BASE_URL}${url}`;
  }

  return url;
}

/**
 * Process markdown/HTML content to convert relative image URLs to absolute URLs
 * Handles both markdown syntax ![alt](url) and HTML <img src="url">
 */
export function processMarkdownImages(content) {
  if (!content) return content;

  // Replace relative image URLs in markdown syntax: ![alt](/uploads/...)
  let processed = content.replace(
    /!\[(.*?)\]\((\/uploads\/[^)]+)\)/g,
    (match, alt, url) => `![${alt}](${API_BASE_URL}${url})`
  );

  // Replace relative image URLs in HTML img tags: <img src="/uploads/...">
  processed = processed.replace(
    /<img([^>]*)\ssrc=["'](\/uploads\/[^"']+)["']([^>]*)>/gi,
    (match, before, url, after) => `<img${before} src="${API_BASE_URL}${url}"${after}>`
  );

  return processed;
}

/**
 * Get auth token from localStorage or sessionStorage
 */
export function getToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

/**
 * Get user from localStorage or sessionStorage
 */
export function getUser() {
  const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Clear auth from both storages
 */
export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
}

/**
 * Wrapper around fetch that automatically adds Authorization header
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function authFetch(url, options = {}) {
  const token = getToken();

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