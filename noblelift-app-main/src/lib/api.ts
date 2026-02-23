import { getTokenStorageSync, setTokenStorage, clearTokenStorageSync } from './storage';

export { initTokenStorage } from './storage';

const g: any = typeof globalThis !== 'undefined' ? (globalThis as any) : (typeof global !== 'undefined' ? (global as any) : {});

function env(name: string, fallback?: string) {
  return g?.process?.env?.[name] ?? g?.[name] ?? fallback;
}

export const API_URL: string =
  env('EXPO_PUBLIC_API_BASE_URL') ||
  env('__API_BASE_URL') ||
  'http://26.102.245.102:8000/api/v1';

type TokensShape =
  | { access?: string; refresh?: string }
  | { access_token?: string; refresh_token?: string }
  | { accessToken?: string; refreshToken?: string }
  | null;

type NormalizedTokens = { accessToken: string | null; refreshToken?: string | null };

function normalizeTokens(obj: TokensShape): NormalizedTokens | null {
  if (!obj) return null;
  const access =
    (obj as any).accessToken ?? (obj as any).access_token ?? (obj as any).access ?? null;
  const refresh =
    (obj as any).refreshToken ?? (obj as any).refresh_token ?? (obj as any).refresh ?? null;
  if (!access) return null;
  return { accessToken: String(access), refreshToken: refresh ? String(refresh) : null };
}

function getTokens(): NormalizedTokens | null {
  try {
    const raw = getTokenStorageSync();
    return normalizeTokens(raw ? JSON.parse(raw) : null);
  } catch { return null; }
}

async function setTokens(raw: TokensShape | null): Promise<void> {
  const norm = normalizeTokens(raw);
  if (!norm) {
    await setTokenStorage(null);
    return;
  }
  await setTokenStorage(JSON.stringify({
    accessToken: norm.accessToken,
    ...(norm.refreshToken ? { refreshToken: norm.refreshToken } : {}),
  }));
}

function clearTokens(): void {
  clearTokenStorageSync();
  setTokenStorage(null).catch(() => {});
}

export function getAccessToken() { return getTokens()?.accessToken ?? null; }
export function getRefreshToken() { return getTokens()?.refreshToken ?? null; }
export function hasTokens() { return !!getTokens()?.accessToken; }

async function refresh(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('no refresh token');
  const r = await fetch(joinUrl(API_URL, '/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken }),
  });
  if (!r.ok) throw new Error('refresh failed');
  const raw = await r.json();
  await setTokens(raw);
  const access = getAccessToken();
  if (!access) throw new Error('no access after refresh');
  return access;
}

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, '');
  const p = path.replace(/^\/+/, '');
  return `${b}/${p}`;
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

export async function api(input: string, init: RequestInit = {}) {
  let access = getAccessToken();
  const method = (init.method || 'GET').toUpperCase();
  const hasBody = init.body != null && init.body !== '';
  const headers: Record<string, string> = {
    ...(access ? { Authorization: `Bearer ${access}` } : {}),
    ...(init.headers as Record<string, string> || {}),
  };
  if (hasBody && method !== 'GET' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const doFetch = async (retry = false): Promise<Response> => {
    const r = await fetch(joinUrl(API_URL, input), {
      ...init,
      headers,
    });
    if (r.status === 401) {
      if (!retry && getRefreshToken()) {
        try { access = await refresh(); return await doFetch(true); }
        catch { clearTokens(); onUnauthorized?.(); throw new Error('unauthorized'); }
      }
      clearTokens(); onUnauthorized?.(); throw new Error('unauthorized');
    }
    return r;
  };
  return doFetch();
}

export async function login(email: string, password: string) {
  const r = await fetch(joinUrl(API_URL, '/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) {
    if (r.status === 401) throw new Error('unauthorized');
    throw new Error(`login_failed_${r.status}`);
  }
  const tokens = await r.json();
  await setTokens(tokens);
  return tokens;
}
export function logout() {
  clearTokens();
  try { fetch(joinUrl(API_URL, '/auth/logout'), { method: 'POST' }); } catch {}
}

/** GET и парсинг JSON; бросает при !res.ok */
export async function getJSON<T>(path: string): Promise<T> {
  const r = await api(path);
  if (!r.ok) throw new Error(`GET ${path} failed: ${r.status}`);
  return r.json();
}

/** PATCH с телом; бросает при !res.ok */
export async function patchJSON<T>(path: string, body: unknown): Promise<T> {
  const r = await api(path, { method: 'PATCH', body: JSON.stringify(body) });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`PATCH ${path} failed: ${r.status} ${txt}`);
  }
  return r.json();
}

/** POST с телом; бросает при !res.ok */
export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const r = await api(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`POST ${path} failed: ${r.status} ${txt}`);
  }
  return r.json().catch(() => null as unknown as T);
}

/** POST без тела; бросает при !res.ok */
export async function postVoid(path: string): Promise<void> {
  const r = await api(path, { method: 'POST' });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`POST ${path} failed: ${r.status} ${txt}`);
  }
}

/** Full URL for avatar (relative path from API). */
export function getAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('http')) return avatarUrl;
  const base = API_URL.replace(/\/api\/v1\/?$/, '');
  return base + (avatarUrl.startsWith('/') ? avatarUrl : '/' + avatarUrl);
}

/** Upload avatar file (multipart). Returns { avatarUrl }. */
export async function uploadAvatar(file: File | Blob, fileName?: string): Promise<{ avatarUrl: string }> {
  const access = getAccessToken();
  const form = new FormData();
  form.append('file', file as any, fileName ?? 'avatar.jpg');
  const r = await fetch(joinUrl(API_URL, '/profiles/me/avatar'), {
    method: 'POST',
    headers: access ? { Authorization: `Bearer ${access}` } : {},
    body: form,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Upload failed: ${r.status} ${txt}`);
  }
  return r.json();
}
