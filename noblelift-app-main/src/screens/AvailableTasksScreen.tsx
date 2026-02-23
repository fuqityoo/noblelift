import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Platform, Alert, useWindowDimensions } from 'react-native';
import { useApp } from '../state/AppContext';
import { useMyUserId } from '../hooks/useMyUserId';
import { useIsSuperAdmin } from '../hooks/useIsSuperAdmin';
import { colors, spacing, radii } from '../ui/theme';
import { getStatusCode, getAssigneeId } from '../lib/utils';
import { api } from '../lib/api';
import TaskCard from '../components/TaskCard';

const isWeb = Platform.OS === 'web';
const BREAKPOINT = 600;

export default React.memo(function AvailableTasksScreen() {
  const { width } = useWindowDimensions();
  const useTwoColumns = isWeb && width >= BREAKPOINT;
  const { state, dispatch, service } = useApp();
  const myUserId = useMyUserId();
  const isSuperAdmin = useIsSuperAdmin();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());

  // Загружаем задачи (в т.ч. общие) при открытии экрана «Общие»
  useEffect(() => {
    service.refreshAvailableTasks();
  }, [service]);

  const available = useMemo(() => {
    return state.tasks.filter(t => {
      const code = getStatusCode(t);
      const assignee = getAssigneeId(t);
      const unassigned = assignee == null || assignee === '' || assignee === 0;
      return code !== 'done' && unassigned;
    });
  }, [state.tasks]);

  const filtered = useMemo(
    () =>
      available
        .filter(t => t.title.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => ((a.due ?? 0) as number) - ((b.due ?? 0) as number)),
    [available, query],
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

  const handleTake = useCallback(async (t: any) => {
    if (busy.has(t.id) || myUserId == null) return;
    setBusy(prev => new Set(prev).add(t.id));
    try {
      const res = await api(`/tasks/${t.id}/take`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body?.detail || body?.message || `Не удалось взять задачу (${res.status})`;
        isWeb ? alert(msg) : Alert.alert('Ошибка', msg);
        return;
      }
      const next = state.tasks.map(x =>
        x.id === t.id ? { ...x, assigneeId: myUserId, statusCode: 'in_progress' } : x,
      );
      dispatch({ type: 'SET_TASKS', tasks: next });
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(t.id); return n; });
    }
  }, [busy, myUserId, state.tasks, dispatch]);

  const handleDelete = useCallback((t: any) => {
    const msg = 'Задача будет удалена из базы. Продолжить?';
    const doDelete = async () => {
      try {
        const res = await api(`/tasks/${t.id}`, { method: 'DELETE' });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `Ошибка ${res.status}`);
        }
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

  const renderCard = (t: any) => (
    <TaskCard
      key={t.id}
      task={t}
      variant="available"
      isExpanded={expanded.has(t.id)}
      onToggleExpand={() => toggleExpanded(t.id)}
      isBusy={busy.has(t.id)}
      onAction={() => handleTake(t)}
      showDelete={isSuperAdmin}
      onDelete={() => handleDelete(t)}
    />
  );

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.h1}>Общие</Text>
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
        <View style={styles.footer}><Text style={styles.muted}>Нет доступных задач</Text></View>
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
