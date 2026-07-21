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
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: (user, token) => {
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
    }
    set({ user, token, isLoading: false });
  },

  clearAuth: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("zencrus_token");
      localStorage.removeItem("zencrus_user");
    }
    set({ user: null, token: null, isLoading: false });
  },

  loadFromStorage: () => {
    if (typeof window === "undefined") {
      set({ isLoading: false });
      return;
    }
    try {
      const token = localStorage.getItem("zencrus_token");
      const userStr = localStorage.getItem("zencrus_user");
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
        set({ user, token, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
