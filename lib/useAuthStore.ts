import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface User {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  points: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

/**
 * Bumped when the shape or the meaning of what is stored changes. Anything
 * saved under an older version is dropped on load, which signs the customer
 * out once rather than letting a session from a previous deployment linger
 * and fail every request it is sent with.
 */
export const AUTH_STORAGE_VERSION = 2;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setToken: (token) => set({ token, isAuthenticated: !!token }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      version: AUTH_STORAGE_VERSION,
      migrate: (persistedState, version) => {
        if (version < AUTH_STORAGE_VERSION) {
          return { token: null, user: null, isAuthenticated: false } as AuthState;
        }
        return persistedState as AuthState;
      },
    }
  )
);

/** Drops the stored session. Safe to call from outside React. */
export const clearStoredSession = () => {
  useAuthStore.getState().logout();
};
