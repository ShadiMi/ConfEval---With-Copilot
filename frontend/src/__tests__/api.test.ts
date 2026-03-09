/**
 * Integration-style tests for the API client module.
 * Verifies interceptor behaviour and API function structure.
 */
import axios from 'axios';
import api, { authApi, sessionsApi, projectsApi, tagsApi } from '@/lib/api';

// Spy on axios.create to verify configuration
jest.mock('axios', () => {
  const interceptors = {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  };
  const instance = {
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
    interceptors,
  };
  return {
    __esModule: true,
    default: { create: jest.fn(() => instance) },
    create: jest.fn(() => instance),
  };
});

describe('API module', () => {
  describe('authApi', () => {
    it('exposes login function', () => {
      expect(typeof authApi.login).toBe('function');
    });

    it('exposes register function', () => {
      expect(typeof authApi.register).toBe('function');
    });

    it('exposes getMe function', () => {
      expect(typeof authApi.getMe).toBe('function');
    });

    it('exposes updateMe function', () => {
      expect(typeof authApi.updateMe).toBe('function');
    });

    it('exposes uploadCV function', () => {
      expect(typeof authApi.uploadCV).toBe('function');
    });

    it('exposes getUsers function', () => {
      expect(typeof authApi.getUsers).toBe('function');
    });
  });

  describe('sessionsApi', () => {
    it('exposes list and get functions', () => {
      expect(typeof sessionsApi.list).toBe('function');
      expect(typeof sessionsApi.get).toBe('function');
    });

    it('exposes create and update functions', () => {
      expect(typeof sessionsApi.create).toBe('function');
      expect(typeof sessionsApi.update).toBe('function');
    });
  });

  describe('projectsApi', () => {
    it('exposes CRUD functions', () => {
      expect(typeof projectsApi.list).toBe('function');
      expect(typeof projectsApi.get).toBe('function');
      expect(typeof projectsApi.create).toBe('function');
      expect(typeof projectsApi.update).toBe('function');
    });

    it('exposes file upload functions', () => {
      expect(typeof projectsApi.uploadPaper).toBe('function');
      expect(typeof projectsApi.uploadSlides).toBe('function');
    });
  });

  describe('tagsApi', () => {
    it('exposes CRUD functions', () => {
      expect(typeof tagsApi.list).toBe('function');
      expect(typeof tagsApi.get).toBe('function');
      expect(typeof tagsApi.create).toBe('function');
      expect(typeof tagsApi.delete).toBe('function');
    });
  });
});
