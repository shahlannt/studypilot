// Central API client with token injection and error normalization

const API_URL = '/api';

export class ApiError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    // Preserve any extra fields the server sent (e.g. needsVerification on a
    // 403) so consumers can branch on them.
    Object.assign(this, extra);
  }
}

function getToken() {
  return localStorage.getItem('sp_token');
}

export async function api(path, { method = 'GET', body, params } = {}) {
  let url = `${API_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const str = qs.toString();
    if (str) url += `?${str}`;
  }

  const token = getToken();
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // no body
  }

  if (!res.ok) {
    // 401 means token invalid/expired
    if (res.status === 401) {
      localStorage.removeItem('sp_token');
      localStorage.removeItem('sp_user');
    }
    throw new ApiError(res.status, data?.error || 'Something went wrong', data || {});
  }

  return { status: res.status, data };
}

export const authApi = {
  register: (payload) => api('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => api('/auth/login', { method: 'POST', body: payload }),
  me: () => api('/auth/me'),
  verifyEmail: (token) => api('/auth/verify-email', { method: 'POST', body: { token } }),
  resendVerification: (email) => api('/auth/resend-verification', { method: 'POST', body: { email } }),
  forgotPassword: (email) => api('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (token, password) => api('/auth/reset-password', { method: 'POST', body: { token, password } })
};

export const subjectApi = {
  list: () => api('/subjects'),
  get: (id) => api(`/subjects/${id}`),
  create: (payload) => api('/subjects', { method: 'POST', body: payload }),
  update: (id, payload) => api(`/subjects/${id}`, { method: 'PUT', body: payload }),
  remove: (id) => api(`/subjects/${id}`, { method: 'DELETE' })
};

export const taskApi = {
  list: (params) => api('/tasks', { params }),
  get: (id) => api(`/tasks/${id}`),
  create: (payload) => api('/tasks', { method: 'POST', body: payload }),
  update: (id, payload) => api(`/tasks/${id}`, { method: 'PUT', body: payload }),
  toggle: (id) => api(`/tasks/${id}/toggle`, { method: 'PATCH' }),
  remove: (id) => api(`/tasks/${id}`, { method: 'DELETE' })
};

export const noteApi = {
  list: (params) => api('/notes', { params }),
  get: (id) => api(`/notes/${id}`),
  create: (payload) => api('/notes', { method: 'POST', body: payload }),
  update: (id, payload) => api(`/notes/${id}`, { method: 'PUT', body: payload }),
  toggleFavorite: (id) => api(`/notes/${id}/favorite`, { method: 'PATCH' }),
  remove: (id) => api(`/notes/${id}`, { method: 'DELETE' }),
  addAttachment: (id, payload) => api(`/notes/${id}/attachments`, { method: 'POST', body: payload }),
  removeAttachment: (id, attachId) => api(`/notes/${id}/attachments/${attachId}`, { method: 'DELETE' })
};

export const sessionApi = {
  list: () => api('/study-sessions'),
  start: (payload) => api('/study-sessions/start', { method: 'POST', body: payload }),
  end: (id) => api(`/study-sessions/${id}/end`, { method: 'POST' }),
  remove: (id) => api(`/study-sessions/${id}`, { method: 'DELETE' })
};

export const quizApi = {
  list: () => api('/quizzes'),
  get: (id) => api(`/quizzes/${id}`),
  create: (payload) => api('/quizzes', { method: 'POST', body: payload }),
  remove: (id) => api(`/quizzes/${id}`, { method: 'DELETE' }),
  attempts: () => api('/quiz-attempts'),
  submitAttempt: (payload) => api('/quiz-attempts', { method: 'POST', body: payload })
};

export const aiApi = {
  chat: (payload) => api('/ai/chat', { method: 'POST', body: payload }),
  summarize: (payload) => api('/ai/summarize', { method: 'POST', body: payload }),
  generateQuiz: (payload) => api('/ai/generate-quiz', { method: 'POST', body: payload }),
  explain: (payload) => api('/ai/explain', { method: 'POST', body: payload }),
  recommend: () => api('/ai/recommend', { method: 'POST' }),
  conversations: () => api('/ai/conversations'),
  conversation: (id) => api(`/ai/conversations/${id}`),
  deleteConversation: (id) => api(`/ai/conversations/${id}`, { method: 'DELETE' })
};

export const analyticsApi = {
  dashboard: () => api('/analytics/dashboard'),
  all: () => api('/analytics')
};

export const notificationApi = {
  list: () => api('/notifications'),
  markRead: (id) => api(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => api('/notifications/read-all', { method: 'PATCH' }),
  remove: (id) => api(`/notifications/${id}`, { method: 'DELETE' })
};

export const userApi = {
  profile: () => api('/users/profile'),
  updateProfile: (payload) => api('/users/profile', { method: 'PUT', body: payload }),
  updateSettings: (payload) => api('/users/settings', { method: 'PUT', body: payload }),
  changePassword: (payload) => api('/users/password', { method: 'PUT', body: payload }),
  deleteAccount: () => api('/users/profile', { method: 'DELETE' })
};