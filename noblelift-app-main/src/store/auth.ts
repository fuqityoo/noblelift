import { api, login as apiLogin, logout as apiLogout, hasTokens, setUnauthorizedHandler, initTokenStorage } from '../lib/api';

export type RoleCode = 'employee' | 'manager' | 'super_admin';
export type UserProfile = {
  userId: number;
  user: { id: number; fullName?: string; role?: { code: RoleCode } };
  status?: unknown;
};

type Listener = () => void;

class AuthStore {
  profile: UserProfile | null = null;
  loading = true;
  private listeners = new Set<Listener>();

  constructor() {
    setUnauthorizedHandler(() => {
      this.profile = null;
      this.loading = false;
      this.emit();
    });
  }

  subscribe(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { this.listeners.forEach(fn => { try { fn(); } catch {} }); }

  async bootstrap() {
    this.loading = true;
    this.emit();
    try {
      await initTokenStorage();
      if (!hasTokens()) { this.profile = null; return; }
      const r = await api('/profiles/me');
      if (!r.ok) throw new Error(String(r.status));
      this.profile = await r.json();
    } finally {
      this.loading = false;
      this.emit();
    }
  }

  async login(email: string, password: string) {
    await apiLogin(email, password);
    const me = await api('/profiles/me');
    if (!me.ok) throw new Error('me failed');
    this.profile = await me.json();
    this.emit();
  }

  logout() {
    apiLogout();
    this.profile = null;
    this.emit();
  }
}

export const auth = new AuthStore();
