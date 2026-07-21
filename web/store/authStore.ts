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
        set({ user, token, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
