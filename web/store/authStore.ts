import { create } from "zustand";

export interface User {
  id: string;
  email: string;
  fullName: string;
  username: string;
  role: string;
  subscriptionTier: "free" | "premium" | "annual";
  avatarUrl?: string;
  isEmailVerified: boolean;
}

function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string, refreshToken?: string) => void;
  setTokens: (token: string, refreshToken: string) => void;
  clearAuth: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  refreshToken: null,
  isLoading: true,

  setAuth: (user, token, refreshToken) => {
    // Always trust JWT for role — override stored user role with JWT role
    const payload = decodeJWT(token);
    if (payload) {
      user = {
        ...user,
        role: (payload.role as string) ?? user.role ?? "user",
        id: (payload.userId as string) ?? user.id,
        email: (payload.email as string) ?? user.email,
      };
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("zencrus_token", token);
      localStorage.setItem("zencrus_user", JSON.stringify(user));
      if (refreshToken) localStorage.setItem("zencrus_refresh_token", refreshToken);
    }
    set({ user, token, refreshToken: refreshToken ?? null, isLoading: false });
  },

  // Actualiza solo los tokens (usado tras un refresh silencioso en segundo plano)
  setTokens: (token, refreshToken) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("zencrus_token", token);
      localStorage.setItem("zencrus_refresh_token", refreshToken);
    }
    set({ token, refreshToken });
  },

  clearAuth: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("zencrus_token");
      localStorage.removeItem("zencrus_user");
      localStorage.removeItem("zencrus_refresh_token");
    }
    set({ user: null, token: null, refreshToken: null, isLoading: false });
  },

  loadFromStorage: () => {
    if (typeof window === "undefined") {
      set({ isLoading: false });
      return;
    }
    try {
      const token = localStorage.getItem("zencrus_token");
      const userStr = localStorage.getItem("zencrus_user");
      const refreshToken = localStorage.getItem("zencrus_refresh_token");
      if (token && userStr) {
        const user = JSON.parse(userStr) as User;
        // Always sync role from JWT — fixes stale role in stored user
        const payload = decodeJWT(token);
        if (payload?.role) {
          user.role = payload.role as string;
        }
        if (payload?.userId) {
          user.id = payload.userId as string;
        }
        set({ user, token, refreshToken, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
