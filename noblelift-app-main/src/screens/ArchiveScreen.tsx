import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useApp } from '../state/AppContext';
import { colors, spacing } from '../ui/theme';
import { api, getJSON } from '../lib/api';
import { TASK_STATUS_OPTIONS } from '../lib/utils';
import TaskCard from '../components/TaskCard';
import Button from '../components/Button';

const isWeb = Platform.OS === 'web';

type TaskItem = {
  id: string | number;
  title?: string;
  content?: string;
  due?: number;
  dueDate?: number;
  statusCode?: string;
  status?: string;
  priorityCode?: string;
  priority?: string;
  topic?: { id?: number; name?: string };
  attachments?: Array<{ id?: string; url?: string; name?: string }>;
};

export default function ArchiveScreen() {
  const { state, dispatch } = useApp();
  const [doneTasks, setDoneTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadDone = useCallback(async () => {
    try {
      const r = await api('/tasks?status=done&limit=200');
      if (!r.ok) return;
      const data = await r.json();
      const items = (data?.items ?? []).map((t: any) => ({
        id: t.id,
        title: t.title,
        content: t.content,
        due: t.due ?? t.dueDate,
        dueDate: t.dueDate ?? t.due,
        statusCode: (t.statusCode ?? 'done').toLowerCase(),
        status: t.status ?? 'Завершена',
        priorityCode: t.priorityCode,
        priority: t.priority,
        topic: t.topic ?? undefined,
        attachments: t.attachments ?? [],
      }));
      setDoneTasks(items);
    } catch {
      setDoneTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = await getJSON<{ userId: number }>('/profiles/me');
        const user = await getJSON<{ role?: { code?: string } }>(`/users/${me.userId}`);
        if (mounted) setIsSuperAdmin(String(user?.role?.code ?? '').toLowerCase() === 'super_admin');
      } catch {
        if (mounted) setIsSuperAdmin(false);
      }
      if (mounted) await loadDone();
    })();
    return () => { mounted = false; };
  }, [loadDone]);

  const runDownloadAndClear = useCallback(async () => {
    setExporting(true);
    try {
      const r = await api('/tasks/archive/download-and-clear', { method: 'POST' });
      if (!r.ok) throw new Error('Ошибка загрузки архива');
      const blob = await r.blob();
      if (isWeb && typeof URL !== 'undefined') {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = 'archive_tasks.csv';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
      setDoneTasks([]);
      const listRes = await api('/tasks?limit=200');
      if (listRes.ok) {
        const data = await listRes.json();
        dispatch({ type: 'SET_TASKS', tasks: data?.items ?? [] });
      }
      if (!isWeb) Alert.alert('Готово', 'Архив скачан. Завершённые задачи удалены.');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить архив');
    } finally {
      setExporting(false);
    }
  }, [dispatch]);

  const handleDownloadArchive = useCallback(() => {
    const msg = 'При скачивании архива все задачи будут удалены. Продолжить?';
    if (isWeb && typeof window !== 'undefined') {
      if (window.confirm(msg)) runDownloadAndClear();
    } else {
      Alert.alert('Загрузить архив', msg, [
        { text: 'Отмена', style: 'cancel' },
        { text: 'ОК', onPress: runDownloadAndClear },
      ]);
    }
  }, [runDownloadAndClear]);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleStatusChange = useCallback(async (t: TaskItem, code: string) => {
    const statusCode = String(code).toLowerCase();
    try {
      const res = await api(`/tasks/${t.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ statusCode }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body?.detail || body?.message || `Не удалось обновить статус (${res.status})`;
        isWeb ? alert(msg) : Alert.alert('Ошибка', msg);
        return;
      }
      const updated = await res.json().catch(() => null);
      setDoneTasks((prev) =>
        prev.map((x) =>
          x.id === t.id ? { ...x, statusCode: updated?.statusCode ?? statusCode } : x,
        ),
      );
      if (updated) {
        dispatch({
          type: 'SET_TASKS',
          tasks: state.tasks.map((x: any) => (x.id === t.id ? { ...x, ...updated } : x)),
        });
      }
      if (statusCode !== 'done') {
        setDoneTasks((prev) => prev.filter((x) => x.id !== t.id));
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось обновить статус');
    }
  }, [dispatch, state.tasks]);

  const handleDeleteTask = useCallback(async (t: TaskItem) => {
    const msg = 'Задача будет удалена из базы. Продолжить?';
    const doDelete = async () => {
      try {
        const res = await api(`/tasks/${t.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Не удалось удалить');
        setDoneTasks((prev) => prev.filter((x) => x.id !== t.id));
        dispatch({ type: 'SET_TASKS', tasks: state.tasks.filter((x: any) => x.id !== t.id) });
      } catch (e: any) {
        Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить задачу');
      }
    };
    if (isWeb && typeof window !== 'undefined') {
      if (window.confirm(msg)) doDelete();
    } else {
      Alert.alert('Удалить задачу', msg, [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: doDelete },
      ]);
    }
  }, [dispatch, state.tasks]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Загрузка…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Завершённые</Text>
        {isSuperAdmin && (
          <Button
            title={exporting ? 'Загрузка…' : 'Загрузить архив'}
            onPress={handleDownloadArchive}
            disabled={exporting}
          />
        )}
      </View>
      {doneTasks.length === 0 ? (
        <Text style={styles.empty}>Пока нет завершённых задач</Text>
      ) : (
        <View style={styles.list}>
          {doneTasks.map((t) => (
            <TaskCard
              key={String(t.id)}
              task={t}
              variant="archive"
              isExpanded={expanded.has(String(t.id))}
              onToggleExpand={() => toggleExpanded(String(t.id))}
              isBusy={false}
              onAction={() => {}}
              statusOptions={isSuperAdmin ? TASK_STATUS_OPTIONS : []}
              onStatusChange={isSuperAdmin ? (code) => handleStatusChange(t, code) : undefined}
              showDelete={isSuperAdmin}
              onDelete={() => handleDeleteTask(t)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(3), paddingBottom: spacing(6) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: colors.mut, marginTop: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing(2), flexWrap: 'wrap', gap: 8 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  empty: { color: colors.mut },
  list: { gap: spacing(2) },
});
