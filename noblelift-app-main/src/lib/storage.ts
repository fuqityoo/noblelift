/**
 * Кроссплатформенное хранилище для Expo/React Native:
 * - Web: localStorage (синхронно)
 * - iOS/Android: AsyncStorage с in-memory кэшем (синхронное чтение после init)
 */
import { Platform } from 'react-native';

const TOKEN_KEY = 'tokens';
let inMemoryCache: string | null = null;
const isWeb = Platform.OS === 'web';

// Ленивая загрузка AsyncStorage только на нативных платформах (не тащить в web-бандл)
let AsyncStorage: typeof import('@react-native-async-storage/async-storage').default | null = null;
async function getAsyncStorage() {
  if (isWeb) return null;
  if (!AsyncStorage) {
    AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  }
  return AsyncStorage;
}

/** Вызвать при старте приложения (например в auth.bootstrap). На native загружает токены из AsyncStorage в память. */
export async function initTokenStorage(): Promise<void> {
  if (isWeb) return;
  const AS = await getAsyncStorage();
  if (!AS) return;
  try {
    const value = await AS.getItem(TOKEN_KEY);
    inMemoryCache = value;
  } catch {
    inMemoryCache = null;
  }
}

/** Синхронное чтение (на native — из кэша после init). */
export function getTokenStorageSync(): string | null {
  if (isWeb) {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    } catch {
      return null;
    }
  }
  return inMemoryCache;
}

/** Запись. На native пишем в кэш сразу и в AsyncStorage. */
export async function setTokenStorage(value: string | null): Promise<void> {
  if (isWeb) {
    try {
      if (typeof localStorage !== 'undefined') {
        if (value == null) localStorage.removeItem(TOKEN_KEY);
        else localStorage.setItem(TOKEN_KEY, value);
      }
    } catch {}
    return;
  }
  inMemoryCache = value;
  const AS = await getAsyncStorage();
  if (!AS) return;
  try {
    if (value == null) await AS.removeItem(TOKEN_KEY);
    else await AS.setItem(TOKEN_KEY, value);
  } catch {}
}

/** Синхронная очистка кэша (для logout без await). */
export function clearTokenStorageSync(): void {
  if (!isWeb) inMemoryCache = null;
}
