import { Platform, Linking } from 'react-native';

/** Формат даты дд.мм.гггг */
export function formatDate(ms?: number | null): string {
  if (ms == null) return '—';
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}

/** Дата из API: timestamp (мс/сек) или ISO-строка → дд.мм.гггг */
export function formatTaskDate(due?: number | string | null): string {
  if (due == null) return '—';
  let d: Date;
  if (typeof due === 'string') {
    d = new Date(due);
  } else {
    d = new Date(due < 1e12 ? due * 1000 : due);
  }
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}

export const STATUS_RU_TO_CODE: Record<string, string> = {
  'Завершена': 'done',
  'В работе': 'in_progress',
  'Пауза': 'pause',
  'Новая': 'new',
};

export const STATUS_CODE_TO_RU: Record<string, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  pause: 'Пауза',
  done: 'Завершена',
};

export const TASK_STATUS_OPTIONS = [
  { code: 'new', label: 'Новая' },
  { code: 'in_progress', label: 'В работе' },
  { code: 'pause', label: 'Пауза' },
  { code: 'done', label: 'Завершена' },
];

export const PRIORITY_CODE_TO_RU: Record<string, string> = {
  low: 'низкий',
  medium: 'средний',
  high: 'высокий',
};

export function getStatusCode(t: any): string {
  const code = t?.statusCode ?? t?.statuscode ?? t?.status_code ?? (t?.status ? STATUS_RU_TO_CODE[t.status] : '');
  return String(code).toLowerCase();
}

export function getAssigneeId(t: any): number | string | null {
  return t?.assigneeId ?? t?.assignedId ?? t?.assigneeID ?? null;
}

export function uniqById<T extends { id: string | number }>(list: T[]): T[] {
  const m = new Map<string, T>();
  for (const item of list) m.set(String(item.id), item);
  return Array.from(m.values());
}

/** Открыть URL: на web — window.open, иначе Linking */
export function openUrl(url: string | undefined): void {
  if (!url) return;
  if (Platform.OS === 'web') {
    try {
      const w = (globalThis as any).window;
      if (w?.open) w.open(url, '_blank'); else Linking.openURL(url);
    } catch { Linking.openURL(url); }
  } else {
    Linking.openURL(url);
  }
}
