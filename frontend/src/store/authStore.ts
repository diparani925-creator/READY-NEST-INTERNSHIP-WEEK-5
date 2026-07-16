import { create } from 'zustand';
import axios from 'axios';
import api from '../lib/axios';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  profileImage?: string | null;
  tenant: Tenant;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: Record<string, string>) => Promise<void>;
  register: (data: Record<string, string>) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearAuth: () => void;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Listen for the custom logout event dispatched by Axios interceptor
  if (typeof window !== 'undefined') {
    window.addEventListener('auth-logout', () => {
      set({ user: null, isAuthenticated: false, isLoading: false });
    });
  }

  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,

    login: async (credentials) => {
      set({ isLoading: true });
      try {
        const response = await api.post('/auth/login', credentials);
        const user = response.data.data.user;
        set({ user, isAuthenticated: true, isLoading: false });
      } catch (error: unknown) {
        set({ isLoading: false });
        let message = 'Login failed';
        if (axios.isAxiosError(error) && error.response?.data?.message) {
          message = error.response.data.message;
        } else if (error instanceof Error) {
          message = error.message;
        }
        throw message;
      }
    },

    register: async (data) => {
      set({ isLoading: true });
      try {
        const response = await api.post('/auth/register', data);
        const user = response.data.data.user;
        set({ user, isAuthenticated: true, isLoading: false });
      } catch (error: unknown) {
        set({ isLoading: false });
        let message = 'Registration failed';
        if (axios.isAxiosError(error) && error.response?.data?.message) {
          message = error.response.data.message;
        } else if (error instanceof Error) {
          message = error.message;
        }
        throw message;
      }
    },

    logout: async () => {
      set({ isLoading: true });
      try {
        await api.post('/auth/logout');
      } catch {
        console.error('Logout error occurred');
      } finally {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    },

    checkAuth: async () => {
      try {
        const response = await api.get('/auth/me');
        const user = response.data.data.user;
        set({ user, isAuthenticated: true, isLoading: false });
      } catch {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    },

    clearAuth: () => {
      set({ user: null, isAuthenticated: false, isLoading: false });
    },

    setUser: (user) => {
      set({ user });
    },
  };
});
