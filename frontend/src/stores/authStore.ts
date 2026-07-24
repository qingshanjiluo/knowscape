import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  bio?: string;
  is_admin?: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isLoading: false,
      setAuth: (token, user) => set({ token, user }),
      logout: () => {
        const t = useAuthStore.getState().token;
        if (t) {
          fetch('/api/v1/auth/logout', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + t },
          }).catch(() => {});
        }
        set({ token: null, user: null });
      },
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    { name: 'knowscape-auth' }
  )
);
