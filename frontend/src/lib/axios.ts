import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor to handle silent token refreshing on 401 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isAuthPath =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthPath) {
      originalRequest._retry = true;

      try {
        // Call the refresh endpoint to get a new access_token cookie
        await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        // Retry original request
        return api(originalRequest);
      } catch (refreshError) {
        if (typeof window !== 'undefined') {
          // Dispatch a custom logout event to be captured by Zustand or page controllers
          window.dispatchEvent(new Event('auth-logout'));
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
