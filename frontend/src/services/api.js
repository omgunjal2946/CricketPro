import axios from 'axios';

const TOKEN_KEY = 'cricketpro_token';
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY)
};

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 on anything except the login call means the session ended.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    if (err.response?.status === 401 && !url.includes('/auth/login')) {
      tokenStore.clear();
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(err);
  }
);

/** Human-readable message from any axios error. */
export const errMsg = (e) =>
  e?.response?.data?.message || (e?.code === 'ECONNABORTED' ? 'The server took too long to respond' : e?.request && !e?.response ? 'Cannot reach the server. Is the backend running?' : e?.message) || 'Something went wrong';

const data = (p) => p.then((r) => r.data);
const clean = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null));

export const authApi = {
  setupStatus: () => data(api.get('/auth/setup-status')),
  login: (body) => data(api.post('/auth/login', body)),
  register: (body) => data(api.post('/auth/register', body)),
  me: () => data(api.get('/auth/me')),
  updateProfile: (body) => data(api.put('/auth/profile', body)),
  changePassword: (body) => data(api.put('/auth/password', body))
};
export const teamsApi = {
  list: (params) => data(api.get('/teams', { params: clean(params) })),
  get: (id) => data(api.get(`/teams/${id}`)),
  create: (b) => data(api.post('/teams', b)),
  update: (id, b) => data(api.put(`/teams/${id}`, b)),
  remove: (id, deletePlayers = false) => data(api.delete(`/teams/${id}`, { params: deletePlayers ? { deletePlayers: 'true' } : {} }))
};
export const playersApi = {
  list: (params) => data(api.get('/players', { params: clean(params) })),
  get: (id) => data(api.get(`/players/${id}`)),
  create: (b) => data(api.post('/players', b)),
  update: (id, b) => data(api.put(`/players/${id}`, b)),
  remove: (id) => data(api.delete(`/players/${id}`))
};
export const matchesApi = {
  list: (params) => data(api.get('/matches', { params: clean(params) })),
  get: (id) => data(api.get(`/matches/${id}`)),
  create: (b) => data(api.post('/matches', b)),
  update: (id, b) => data(api.put(`/matches/${id}`, b)),
  remove: (id) => data(api.delete(`/matches/${id}`))
};
export const scoringApi = {
  overview: () => data(api.get('/scoring/overview')),
  state: (id) => data(api.get(`/scoring/${id}`)),
  startInnings: (id, battingTeam) => data(api.post(`/scoring/${id}/innings`, { battingTeam })),
  ball: (id, b) => data(api.post(`/scoring/${id}/ball`, b)),
  undo: (id) => data(api.post(`/scoring/${id}/undo`)),
  endInnings: (id) => data(api.post(`/scoring/${id}/end-innings`)),
  endMatch: (id, result) => data(api.post(`/scoring/${id}/end-match`, { result }))
};
export const tournamentsApi = {
  list: (params) => data(api.get('/tournaments', { params: clean(params) })),
  get: (id) => data(api.get(`/tournaments/${id}`)),
  points: (id) => data(api.get(`/tournaments/${id}/points`)),
  create: (b) => data(api.post('/tournaments', b)),
  update: (id, b) => data(api.put(`/tournaments/${id}`, b)),
  remove: (id) => data(api.delete(`/tournaments/${id}`))
};
export const statsApi = {
  dashboard: () => data(api.get('/stats/dashboard')),
  analytics: () => data(api.get('/stats/analytics')),
  health: () => data(api.get('/health'))
};

export default api;
