import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  googleAuth: (token: string, role?: string) =>
    api.post('/auth/google', { token, role }),
  
  register: (data: FormData | {
    email: string;
    password: string;
    full_name: string;
    role: string;
    affiliation?: string;
  }) => {
    // If data is FormData, use multipart/form-data
    if (data instanceof FormData) {
      return api.post('/auth/register', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    // Otherwise use JSON
    return api.post('/auth/register', data);
  },
  
  getMe: () => api.get('/auth/me'),
  
  updateMe: (data: { full_name?: string; affiliation?: string; id_number?: string; phone_number?: string }) =>
    api.put('/auth/me', data),
  
  uploadCV: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/auth/me/cv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  updateTags: (tagIds: number[]) => api.put('/auth/me/tags', tagIds),
  
  getUsers: (role?: string) =>
    api.get('/auth/users', { params: { role } }),
  
  getUser: (userId: number) => api.get(`/auth/users/${userId}`),
  
  getPendingApprovalCount: () => api.get('/auth/users/pending-count'),
  
  toggleUserStatus: (userId: number, isActive: boolean) =>
    api.put(`/auth/users/${userId}/status`, null, { params: { is_active: isActive } }),
  
  approveReviewer: (userId: number, isApproved: boolean) =>
    api.put(`/auth/users/${userId}/approve`, null, { params: { is_approved: isApproved } }),
  
  updateUserRole: (userId: number, role: string) =>
    api.put(`/auth/users/${userId}/role`, null, { params: { role } }),
  
  deleteUser: (userId: number) =>
    api.delete(`/auth/users/${userId}`),
  
  downloadCV: (userId: number) => {
    const token = localStorage.getItem('token');
    window.open(`${api.defaults.baseURL}/auth/users/${userId}/cv?token=${token}`, '_blank');
  },
  
  // Site Settings
  getSetting: (key: string) => api.get(`/auth/settings/${key}`),
  updateSetting: (key: string, value: string) => api.put(`/auth/settings/${key}`, { value }),
};

// Sessions API
export const sessionsApi = {
  list: (status?: string) =>
    api.get('/sessions', { params: { status } }),
  
  listPublic: () => api.get('/sessions/public'),
  
  listAvailable: () => api.get('/sessions/available'),
  
  get: (id: number) => api.get(`/sessions/${id}`),
  
  create: (data: {
    name: string;
    description?: string;
    conference_id?: number;
    start_date: string;
    end_date: string;
    location?: string;
    max_projects?: number;
  }) => api.post('/sessions', data),
  
  update: (id: number, data: any) => api.put(`/sessions/${id}`, data),
  
  delete: (id: number) => api.delete(`/sessions/${id}`),
  
  addReviewer: (sessionId: number, userId: number) =>
    api.post(`/sessions/${sessionId}/reviewers/${userId}`),
  
  removeReviewer: (sessionId: number, userId: number) =>
    api.delete(`/sessions/${sessionId}/reviewers/${userId}`),
  
  addTag: (sessionId: number, tagId: number) =>
    api.post(`/sessions/${sessionId}/tags/${tagId}`),
  
  removeTag: (sessionId: number, tagId: number) =>
    api.delete(`/sessions/${sessionId}/tags/${tagId}`),
};

// Projects API
export const projectsApi = {
  list: (params?: { session_id?: number; status?: string }) =>
    api.get('/projects', { params }),
  
  getMyProjects: () => api.get('/projects/my'),
  
  getPendingCount: () => api.get('/projects/pending-count'),
  
  get: (id: number) => api.get(`/projects/${id}`),
  
  create: (data: {
    title: string;
    description?: string;
    session_id?: number;
    tag_ids?: number[];
    team_member_emails?: string[];
    mentor_email?: string;
  }) => api.post('/projects', data),
  
  update: (id: number, data: any) => api.put(`/projects/${id}`, data),
  
  updateStatus: (id: number, status: string, posterNumber?: string) =>
    api.put(`/projects/${id}/status`, { status, poster_number: posterNumber }),
  
  delete: (id: number) => api.delete(`/projects/${id}`),
  
  uploadPaper: (projectId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/projects/${projectId}/paper`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  uploadSlides: (projectId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/projects/${projectId}/slides`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  uploadDocs: (projectId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/projects/${projectId}/docs`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  deletePaper: (projectId: number) => api.delete(`/projects/${projectId}/paper`),
  
  deleteSlides: (projectId: number) => api.delete(`/projects/${projectId}/slides`),
  
  deleteDocs: (projectId: number) => api.delete(`/projects/${projectId}/docs`),
  
  downloadPaper: (projectId: number) => {
    const token = localStorage.getItem('token');
    window.open(`${api.defaults.baseURL}/projects/${projectId}/paper/download?token=${token}`, '_blank');
  },
  
  downloadSlides: (projectId: number) => {
    const token = localStorage.getItem('token');
    window.open(`${api.defaults.baseURL}/projects/${projectId}/slides/download?token=${token}`, '_blank');
  },
  
  downloadDocs: (projectId: number) => {
    const token = localStorage.getItem('token');
    window.open(`${api.defaults.baseURL}/projects/${projectId}/docs/download?token=${token}`, '_blank');
  },
  
  reassignStudent: (projectId: number, studentId: number) =>
    api.put(`/projects/${projectId}/reassign-student/${studentId}`),
  
  reassignSession: (projectId: number, sessionId: number | null) =>
    api.put(`/projects/${projectId}/reassign-session`, null, { params: { session_id: sessionId } }),
  
  // Team member management
  getTeamMembers: (projectId: number) =>
    api.get(`/projects/${projectId}/team-members`),
  
  addTeamMember: (projectId: number, studentId: number) =>
    api.post(`/projects/${projectId}/team-members/${studentId}`),
  
  removeTeamMember: (projectId: number, studentId: number) =>
    api.delete(`/projects/${projectId}/team-members/${studentId}`),
  
  // Reviewer assignment
  getReviewers: (projectId: number) =>
    api.get(`/projects/${projectId}/reviewers`),
  
  assignReviewer: (projectId: number, reviewerId: number) =>
    api.post(`/projects/${projectId}/reviewers/${reviewerId}`),
  
  unassignReviewer: (projectId: number, reviewerId: number) =>
    api.delete(`/projects/${projectId}/reviewers/${reviewerId}`),
  
  // Assignment management
  getAllReviewersForAssignment: (sessionId?: number) =>
    api.get('/projects/assignments/reviewers', { params: sessionId ? { session_id: sessionId } : {} }),
  
  getAllProjectsForAssignment: (sessionId?: number) =>
    api.get('/projects/assignments/projects', { params: sessionId ? { session_id: sessionId } : {} }),
  
  autoAssignReviewers: (sessionId?: number, reviewersPerProject: number = 2, preview: boolean = false) =>
    api.post('/projects/assignments/auto-assign', null, {
      params: { session_id: sessionId, reviewers_per_project: reviewersPerProject, preview }
    }),
  
  clearAllAssignments: (sessionId?: number) =>
    api.delete('/projects/assignments/clear', { params: sessionId ? { session_id: sessionId } : {} }),
  
  // Team invitations
  getMyInvitations: () => api.get('/projects/my/invitations'),
  
  acceptInvitation: (invitationId: number) =>
    api.post(`/projects/invitations/${invitationId}/accept`),
  
  declineInvitation: (invitationId: number) =>
    api.post(`/projects/invitations/${invitationId}/decline`),
};

// Criteria API
export const criteriaApi = {
  listForSession: (sessionId: number) =>
    api.get(`/criteria/session/${sessionId}`),
  
  get: (id: number) => api.get(`/criteria/${id}`),
  
  create: (data: {
    session_id: number;
    name: string;
    description?: string;
    max_score?: number;
    weight?: number;
  }) => api.post('/criteria', data),
  
  update: (id: number, data: any) => api.put(`/criteria/${id}`, data),
  
  delete: (id: number) => api.delete(`/criteria/${id}`),
  
  reorder: (sessionId: number, criteriaOrder: number[]) =>
    api.put(`/criteria/session/${sessionId}/reorder`, criteriaOrder),
};

// Reviews API
export const reviewsApi = {
  listForProject: (projectId: number) =>
    api.get(`/reviews/project/${projectId}`),
  
  getMyReviews: (isCompleted?: boolean) =>
    api.get('/reviews/my', { params: { is_completed: isCompleted } }),
  
  get: (id: number) => api.get(`/reviews/${id}`),
  
  create: (data: {
    project_id: number;
    comments?: string;
    criteria_scores: { criteria_id: number; score: number }[];
  }) => api.post('/reviews', data),
  
  update: (id: number, data: any) => api.put(`/reviews/${id}`, data),
  
  delete: (id: number) => api.delete(`/reviews/${id}`),
};

// Applications API
export const applicationsApi = {
  list: (params?: { session_id?: number; status?: string }) =>
    api.get('/applications', { params }),
  
  getMyApplications: () => api.get('/applications/my'),
  
  get: (id: number) => api.get(`/applications/${id}`),
  
  create: (data: { session_id: number; message?: string }) =>
    api.post('/applications', data),
  
  updateStatus: (id: number, status: string) =>
    api.put(`/applications/${id}/status`, { status }),
  
  delete: (id: number) => api.delete(`/applications/${id}`),
};

// Tags API
export const tagsApi = {
  list: () => api.get('/tags'),
  
  get: (id: number) => api.get(`/tags/${id}`),
  
  create: (data: { name: string; description?: string }) =>
    api.post('/tags', data),
  
  update: (id: number, data: { name: string; description?: string }) =>
    api.put(`/tags/${id}`, data),
  
  delete: (id: number) => api.delete(`/tags/${id}`),
};

// Stats API
export const statsApi = {
  get: () => api.get('/stats'),
  health: () => api.get('/health'),
};

// Reports API (Admin)
export const reportsApi = {
  getOverview: () => api.get('/reports/overview'),
  
  getSessionDetails: (sessionId: number) => 
    api.get(`/reports/sessions/${sessionId}/details`),
  
  exportSession: (sessionId: number) => {
    const token = localStorage.getItem('token');
    window.open(`${api.defaults.baseURL}/reports/sessions/${sessionId}/export?token=${token}`, '_blank');
  },
  
  exportAll: () => {
    const token = localStorage.getItem('token');
    window.open(`${api.defaults.baseURL}/reports/export/all?token=${token}`, '_blank');
  },
};

// Notifications API
export const notificationsApi = {
  list: (isRead?: boolean) => 
    api.get('/notifications', { params: { is_read: isRead } }),
  
  getUnreadCount: () => api.get('/notifications/unread-count'),
  
  markAsRead: (id: number) => api.put(`/notifications/${id}/read`),
  
  markAllAsRead: () => api.put('/notifications/mark-all-read'),
  
  delete: (id: number) => api.delete(`/notifications/${id}`),
  
  clearAll: () => api.delete('/notifications/clear-all'),
};

// Conferences API
export const conferencesApi = {
  listPublic: () => api.get('/conferences/public'),
  
  list: (status?: string) => 
    api.get('/conferences', { params: { status } }),
  
  get: (id: number) => api.get(`/conferences/${id}`),
  
  create: (data: {
    name: string;
    description?: string;
    start_date: string;
    end_date: string;
    location?: string;
    max_sessions?: number;
  }) => api.post('/conferences', data),
  
  update: (id: number, data: {
    name?: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    location?: string;
    status?: string;
    max_sessions?: number;
  }) => api.put(`/conferences/${id}`, data),
  
  delete: (id: number) => api.delete(`/conferences/${id}`),
  
  getSessions: (id: number) => api.get(`/conferences/${id}/sessions`),
  
  addSession: (conferenceId: number, sessionId: number) => 
    api.post(`/conferences/${conferenceId}/sessions/${sessionId}`),
  
  removeSession: (conferenceId: number, sessionId: number) => 
    api.delete(`/conferences/${conferenceId}/sessions/${sessionId}`),
};
