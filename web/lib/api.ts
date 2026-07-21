import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://web-production-1d2e22.up.railway.app/api";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// Request interceptor — attach token
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("zencrus_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor — handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("zencrus_token");
      localStorage.removeItem("zencrus_user");
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
  send: (message: string, history: { role: string; content: string }[]) =>
    api.post("/ai/chat", { message, history }),
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
  getStatus: () => api.get("/subscriptions/status"),
  createSession: (priceId: string) =>
    api.post("/subscriptions/create-session", { priceId }),
  cancel: () => api.post("/subscriptions/cancel"),
};

// Onboarding
export const onboarding = {
  complete: (data: Record<string, unknown>) => api.post("/onboarding/complete", data),
};

export default api;
