import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const sessionId = sessionStorage.getItem('session_id');
  if (sessionId) {
    config.headers['x-session-id'] = sessionId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401 || status === 403) {
        const code = data?.error?.code;
        // Session-related errors → force logout
        if (code === 503 || code === 504) {
          sessionStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
