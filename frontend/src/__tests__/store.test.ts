/**
 * Unit tests for Zustand auth store
 */
import { useAuthStore } from '@/lib/store';
import type { User } from '@/types';

const mockUser: User = {
  id: 1,
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'student',
  is_active: true,
  is_approved: true,
  created_at: '2024-01-01T00:00:00Z',
  interested_tags: [],
};

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  describe('login', () => {
    it('sets user, token, and isAuthenticated', () => {
      useAuthStore.getState().login(mockUser, 'test-token');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('test-token');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('persists to localStorage', () => {
      useAuthStore.getState().login(mockUser, 'test-token');

      expect(localStorage.getItem('token')).toBe('test-token');
      expect(JSON.parse(localStorage.getItem('user')!)).toEqual(mockUser);
    });
  });

  describe('logout', () => {
    it('clears state and localStorage', () => {
      useAuthStore.getState().login(mockUser, 'test-token');
      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });
  });

  describe('setUser', () => {
    it('sets user and isAuthenticated', () => {
      useAuthStore.getState().setUser(mockUser);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it('clears when null', () => {
      useAuthStore.getState().setUser(mockUser);
      useAuthStore.getState().setUser(null);

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('setToken', () => {
    it('persists token', () => {
      useAuthStore.getState().setToken('abc');
      expect(localStorage.getItem('token')).toBe('abc');
    });

    it('removes token when null', () => {
      useAuthStore.getState().setToken('abc');
      useAuthStore.getState().setToken(null);
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('updates loading state', () => {
      useAuthStore.getState().setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);

      useAuthStore.getState().setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });
});
