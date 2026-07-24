import axios from "axios";

// Use Next.js API route proxy — strips Origin header so Railway CORS doesn't block
const BASE_URL = "/api/proxy";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// Request interceptor — attach token (only if not already set)
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined" && !config.headers.Authorization) {
    const token = localStorage.getItem("zencrus_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor — 401 dispara un refresh silencioso antes de cerrar sesión.
// La sesión NUNCA se cierra sola por expiración del access token (15 min) — solo
// se cierra si el refresh token también falla (o el usuario pulsa "Cerrar sesión").
let refreshing: Promise<string | null> | null = null;

async function silentRefresh(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const rt = localStorage.getItem("zencrus_refresh_token");
      if (!rt) return null;
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: rt });
      const newToken = data?.data?.accessToken;
      const newRefresh = data?.data?.refreshToken;
      if (!newToken) return null;
      localStorage.setItem("zencrus_token", newToken);
      if (newRefresh) localStorage.setItem("zencrus_refresh_token", newRefresh);
      return newToken;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthEndpoint = original?.url?.includes("/auth/login") || original?.url?.includes("/auth/register") || original?.url?.includes("/auth/refresh");

    if (error.response?.status === 401 && typeof window !== "undefined" && !isAuthEndpoint && !original?._retry) {
      original._retry = true;
      const newToken = await silentRefresh();
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      // El refresh token también falló (o no existe) — ahí sí cerramos sesión
      localStorage.removeItem("zencrus_token");
      localStorage.removeItem("zencrus_user");
      localStorage.removeItem("zencrus_refresh_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Auth
export const auth = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),

  register: (email: string, password: string, fullName: string, username: string) =>
    api.post("/auth/register", { email, password, fullName, username }),

  logout: () => api.post("/auth/logout"),

  me: (token?: string) => api.get("/users/me", token ? { headers: { Authorization: `Bearer ${token}` } } : undefined),

  forgotPassword: (email: string) => api.post("/auth/forgot-password", { email }),

  checkUsername: (username: string) =>
    api.get(`/auth/check-username?username=${encodeURIComponent(username)}`),

  verifyEmail: (email: string, code: string) =>
    api.post("/auth/verify-email", { email, code }),

  resendVerification: (email: string) =>
    api.post("/auth/resend-verification", { email }),
};

// User
export const user = {
  getProfile: () => api.get("/users/profile"),
  updateProfile: (data: Record<string, unknown>) => api.put("/users/profile", data),
};

// Nutrition
export const nutrition = {
  getPlans: () => api.get("/nutrition/plans"),
  getDashboard: () => api.get("/nutrition/dashboard"),
  logMeal: (data: Record<string, unknown>) => api.post("/nutrition/log", data),
  generatePlan: () => api.post("/nutrition/generate"),
};

// AI Chat
export const chat = {
  createSession: (title?: string) => api.post("/chat/sessions", { title: title ?? "Chat con ZENA" }),
  getSessions: () => api.get("/chat/sessions"),
  getSession: (id: string) => api.get(`/chat/sessions/${id}`),
  sendMessage: (sessionId: string, content: string) =>
    api.post(`/chat/sessions/${sessionId}/messages`, { content }),
};

// Social
export const social = {
  getFeed: (page = 1) => api.get(`/social/feed?page=${page}`),
  createPost: (content: string, imageUrl?: string) =>
    api.post("/social/posts", { content, imageUrl }),
  likePost: (id: string) => api.post(`/social/posts/${id}/like`),
};

// Subscriptions
export const subscriptions = {
  getPlans: () => api.get("/subscriptions/plans"),
  getStatus: () => api.get("/subscriptions/current"),
  startTrial: () => api.post("/subscriptions/start-trial"),
  checkout: (tier: string, extraMembers = 0, provider: "stripe" | "mercadopago" = "stripe") =>
    api.post("/subscriptions/checkout", { tier, provider, extraMembers }),
  checkoutWeb: (tier: string, extraMembers = 0) =>
    api.post("/subscriptions/checkout-web", { tier, extraMembers }),
  cancel: () => api.post("/subscriptions/cancel"),
};

// Onboarding
export const onboarding = {
  complete: (data: Record<string, unknown>) => api.post("/onboarding/complete", data),
};

// Diet & Workout — AI-generated, personalized plans
export const diet = {
  generate: (opts?: { durationDays?: number }) => api.post("/diet/generate", { durationDays: opts?.durationDays ?? 7 }),
  getActive: () => api.get("/diet/active"),
  getAll: () => api.get("/diet"),
};

export const workout = {
  generate: (opts: { level?: string; goal?: string; daysPerWeek?: number; equipment?: string[] }) =>
    api.post("/workout/generate", opts),
  getActive: () => api.get("/workout/active"),
  getAll: () => api.get("/workout"),
};

// Admin — control total
export const admin = {
  dashboard: () => api.get("/admin/dashboard"),
  analytics: () => api.get("/admin/analytics"),

  // Users
  getUsers: (q?: Record<string, string | number>) =>
    api.get("/admin/users", { params: q }),
  getUserDetail: (id: string) => api.get(`/admin/users/${id}`),
  setUserStatus: (id: string, isActive: boolean) =>
    api.patch(`/admin/users/${id}/status`, { isActive }),
  setUserRole: (id: string, role: string) =>
    api.patch(`/admin/users/${id}/role`, { role }),
  unlockUser: (id: string) => api.patch(`/admin/users/${id}/unlock`),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),

  // Subscriptions
  getSubscriptions: (q?: Record<string, string | number>) =>
    api.get("/admin/subscriptions", { params: q }),
  getRevenue: () => api.get("/admin/subscriptions/revenue"),
  extendSubscription: (id: string, days: number) =>
    api.patch(`/admin/subscriptions/${id}/extend`, { days }),
  cancelSubscription: (id: string) =>
    api.patch(`/admin/subscriptions/${id}/cancel`),
  refundSubscription: (id: string) =>
    api.post(`/admin/subscriptions/${id}/refund`),

  // Logs
  getAuditLogs: (q?: Record<string, string | number>) =>
    api.get("/admin/logs/audit", { params: q }),

  // Content
  getMessages: (q?: Record<string, string | number>) =>
    api.get("/admin/content/messages", { params: q }),
  deleteMessage: (id: string) => api.delete(`/admin/content/messages/${id}`),

  // Notifications
  notifyUser: (id: string, subject: string, message: string) =>
    api.post(`/admin/notify/user/${id}`, { subject, message }),
  notifyAll: (subject: string, message: string, tierFilter?: string) =>
    api.post("/admin/notify/all", { subject, message, tierFilter }),

  // Detail & social
  getUserSocial: (id: string) => api.get(`/admin/users/${id}/social`),

  // Fase 2: gestión avanzada
  grantSubscription: (id: string, tier: string, days: number) =>
    api.post(`/admin/users/${id}/grant-subscription`, { tier, days }),
  revokeSubscription: (id: string) => api.post(`/admin/users/${id}/revoke-subscription`),
  verifyEmail: (id: string) => api.post(`/admin/users/${id}/verify-email`),
  resetPassword: (id: string, password: string) =>
    api.post(`/admin/users/${id}/reset-password`, { password }),
  impersonate: (id: string) => api.post(`/admin/users/${id}/impersonate`),

  // Trials
  getTrials: (q?: Record<string, string | number>) =>
    api.get("/admin/subscriptions/trials", { params: q }),

  // Cohortes
  getCohorts: () => api.get("/admin/analytics/cohorts"),

  // Notas internas
  getUserNotes: (id: string) => api.get(`/admin/users/${id}/notes`),
  addUserNote: (id: string, note: string) => api.post(`/admin/users/${id}/note`, { note }),

  // Feature flags
  getFlags: () => api.get("/admin/flags"),
  setFlag: (key: string, enabled: boolean, description?: string) =>
    api.patch(`/admin/flags/${key}`, { enabled, description }),

  // System health
  health: () => api.get("/health"),

  // Export
  exportUsersUrl: () => "/api/proxy/admin/export/users",
};

export default api;
