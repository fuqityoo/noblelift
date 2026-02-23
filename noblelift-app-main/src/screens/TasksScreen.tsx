import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Platform, Alert, useWindowDimensions } from 'react-native';
import { useApp } from '../state/AppContext';
import { useMyUserId } from '../hooks/useMyUserId';
import { colors, spacing, radii } from '../ui/theme';
import { getStatusCode, getAssigneeId, uniqById, TASK_STATUS_OPTIONS } from '../lib/utils';
import { api } from '../lib/api';
import TaskCard from '../components/TaskCard';

const isWeb = Platform.OS === 'web';
const BREAKPOINT = 600;

export default React.memo(function TasksScreen() {
  const { width } = useWindowDimensions();
  const useTwoColumns = isWeb && width >= BREAKPOINT;
  const { state, dispatch } = useApp();
  const myUserId = useMyUserId();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const myTasks = useMemo(() => {
    if (myUserId == null) return [];
    const onlyMine = state.tasks.filter(t => Number(getAssigneeId(t)) === myUserId);
    const notDone = onlyMine.filter(t => getStatusCode(t) !== 'done');
    return uniqById(notDone);
  }, [state.tasks, myUserId]);

  const filtered = useMemo(
    () =>
      myTasks
        .filter(t => t.title.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => ((a.due ?? 0) as number) - ((b.due ?? 0) as number)),
    [myTasks, query],
  );

  const leftCol = useTwoColumns ? filtered.filter((_, i) => i % 2 === 0) : filtered;
  const rightCol = useTwoColumns ? filtered.filter((_, i) => i % 2 === 1) : [];

  const toggleExpanded = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const setBusyOn = useCallback((id: string, on: boolean) => {
    setBusy(prev => {
      const next = new Set(prev);
      on ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  const handleStatusChange = useCallback(async (t: any, code: string) => {
    if (busy.has(t.id)) return;
    setBusyOn(t.id, true);
    try {
      const res = await api(`/tasks/${t.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ statusCode: String(code).toLowerCase() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body?.detail || body?.message || `Не удалось обновить статус (${res.status})`;
        isWeb ? alert(msg) : Alert.alert('Ошибка', msg);
        return;
      }
      const updated = await res.json().catch(() => null);
      const next = state.tasks.map((x: any) => {
        if (x.id !== t.id) return x;
        return updated ? { ...x, ...updated, statusCode: updated.statusCode ?? code } : { ...x, statusCode: code };
      });
      dispatch({ type: 'SET_TASKS', tasks: next });
    } finally {
      setBusyOn(t.id, false);
    }
  }, [busy, dispatch, state.tasks, setBusyOn]);

  const handleDone = useCallback((t: any) => handleStatusChange(t, 'done'), [handleStatusChange]);

  const renderCard = (t: any) => (
    <TaskCard
      key={t.id}
      task={t}
      variant="my"
      isExpanded={expanded.has(t.id)}
      onToggleExpand={() => toggleExpanded(t.id)}
      isBusy={busy.has(t.id)}
      onAction={() => handleDone(t)}
      onStatusChange={(code) => handleStatusChange(t, code)}
      statusOptions={TASK_STATUS_OPTIONS}
    />
  );

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.h1}>Мои задачи</Text>
        <TextInput
          placeholder="Поиск задач…"
          placeholderTextColor={colors.mut}
          value={query}
          onChangeText={setQuery}
          style={styles.input}
        />
      </View>

      {useTwoColumns ? (
        <View style={styles.columns}>
          <View style={styles.column}>{leftCol.map(renderCard)}</View>
          <View style={styles.column}>{rightCol.map(renderCard)}</View>
        </View>
      ) : (
        filtered.map(renderCard)
      )}

      {myUserId == null && (
        <View style={styles.footer}><Text style={styles.muted}>Загружаем профиль…</Text></View>
      )}
      {myUserId != null && filtered.length === 0 && (
        <View style={styles.footer}><Text style={styles.muted}>Задач нет</Text></View>
      )}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  page: { padding: spacing(3), paddingBottom: spacing(6), flexGrow: 1 },
  header: { width: '100%', gap: spacing(2), marginBottom: spacing(1) },
  h1: { fontSize: 18, fontWeight: '800', color: colors.text },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: radii.md,
    padding: spacing(2.5),
    paddingHorizontal: spacing(3),
    color: colors.text,
    fontSize: 16,
    minHeight: 44,
  },
  columns: { flexDirection: 'row', alignItems: 'flex-start', width: '100%' },
  column: { flex: 1, paddingHorizontal: spacing(1) },
  footer: { width: '100%' },
  muted: { color: colors.mut },
});
