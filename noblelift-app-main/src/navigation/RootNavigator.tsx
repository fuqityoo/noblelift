import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, ScrollView, Modal, TouchableOpacity, Alert, Platform } from 'react-native';
import { useTab } from '../store/TabContext';
import type { Tab } from '../store/TabContext';
import TasksScreen from '../screens/TasksScreen';
import AvailableTasksScreen from '../screens/AvailableTasksScreen';
import CreateTaskScreen from '../screens/CreateTaskScreen';
import ProfileScreen from '../screens/ProfileScreen';
import DirectoryScreen from '../screens/DirectoryScreen';
import ArchiveScreen from '../screens/ArchiveScreen';
import { colors, spacing, breakpoints } from '../ui/theme';
import VehicleScreen from '../screens/VehiclesScreen';
import { getJSON, postJSON } from '../lib/api';
import { auth } from '../store/auth';

type StatusRef = { code: string; label: string };
function statusLabelOnly(label?: string | null): string {
  if (!label) return '—';
  const m = label.match(/^(.+?)\s*\([a-z_]+\)\s*$/i);
  return m ? m[1].trim() : label;
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'tasks', label: 'Задачи' },
  { key: 'available', label: 'Общие' },
  { key: 'create', label: 'Создать' },
  { key: 'profile', label: 'Профиль' },
  { key: 'directory', label: 'Справочник' },
  { key: 'cars', label: 'Автопарк' },
  { key: 'archive', label: 'Завершённые' },
];

const TITLE_MAP: Record<Tab, string> = {
  tasks: 'Мои задачи',
  available: 'Общие задачи',
  create: 'Создать задачу',
  profile: 'Профиль',
  directory: 'Справочник',
  cars: 'Автопарк',
  archive: 'Завершённые',
  admin: 'Админ',
};

export default function RootNavigator() {
  const { activeTab, dispatch } = useTab();
  const { width } = useWindowDimensions();
  const isDesktop = width >= (breakpoints.lg ?? 1024);
  const isNarrow = width < breakpoints.sm;

  const [headerStatusLabel, setHeaderStatusLabel] = useState<string>('—');
  const [headerStatusCode, setHeaderStatusCode] = useState<string>('');
  const [statuses, setStatuses] = useState<StatusRef[]>([]);
  const [statusModalVisible, setStatusModalVisible] = useState(false);

  const loadHeaderStatus = useCallback(async () => {
    try {
      const me = await getJSON<{ userId: number }>('/profiles/me');
      const u = await getJSON<any>(`/users/${me.userId}`);
      const code = u?.profile?.status?.code ?? '';
      setHeaderStatusCode(code);
      const stsRaw = await getJSON<any>('/statuses');
      const list: StatusRef[] = Array.isArray(stsRaw?.items) ? stsRaw.items : Array.isArray(stsRaw) ? stsRaw : [];
      setStatuses(list);
      const f = list.find((s) => s.code === code);
      setHeaderStatusLabel(statusLabelOnly(f?.label ?? null));
    } catch {
      setHeaderStatusLabel('—');
      setHeaderStatusCode('');
    }
  }, []);

  useEffect(() => {
    loadHeaderStatus();
  }, [loadHeaderStatus]);

  const onStatusSelect = useCallback(async (code: string) => {
    const statusObj = statuses.find((s) => s.code === code);
    if (!statusObj) return;
    try {
      await postJSON('/profiles/me/status', { status: { code: statusObj.code, label: statusObj.label } });
      setHeaderStatusCode(code);
      setHeaderStatusLabel(statusLabelOnly(statusObj.label));
      setStatusModalVisible(false);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось обновить статус');
    }
  }, [statuses]);

  const setTab = (tab: Tab) => dispatch({ type: 'SET_TAB', tab });

  const goTasks = () => setTab('tasks');
  const onLogout = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm('Выйти из аккаунта?')) {
      auth.logout();
    } else {
      Alert.alert('Выйти', 'Выйти из аккаунта?', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Выйти', style: 'destructive', onPress: () => auth.logout() },
      ]);
    }
  };

  const screen = (() => {
    switch (activeTab) {
      case 'available': return <AvailableTasksScreen />;
      case 'create': return <CreateTaskScreen />;
      case 'profile': return <ProfileScreen />;
      case 'directory': return <DirectoryScreen />;
      case 'cars': return <VehicleScreen />;
      case 'archive': return <ArchiveScreen />;
      default: return <TasksScreen />;
    }
  })();

  if (!isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        <View style={[styles.topbar, isNarrow && styles.topbarNarrow]}>
          <Pressable onPress={goTasks} style={styles.brandTouch}>
            <Text style={[styles.brand, isNarrow && styles.brandSmall]} numberOfLines={1}>NOBLELIFT</Text>
          </Pressable>
          <Text style={[styles.title, isNarrow && styles.titleSmall]} numberOfLines={1}>{TITLE_MAP[activeTab]}</Text>
          <Pressable onPress={() => setStatusModalVisible(true)} style={styles.headerStatusBtn}>
            <Text style={styles.headerStatusBtnText}>{headerStatusLabel}</Text>
          </Pressable>
          <Pressable onPress={onLogout} style={styles.headerLogoutBtn}>
            <Text style={styles.headerLogoutBtnText}>Выйти</Text>
          </Pressable>
        </View>
        <HeaderStatusModal
          visible={statusModalVisible}
          onClose={() => setStatusModalVisible(false)}
          statuses={statuses}
          currentCode={headerStatusCode}
          onSelect={onStatusSelect}
          statusLabelOnly={statusLabelOnly}
        />
        <View style={{ flex: 1, minHeight: 0 }}>{screen}</View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bottomTabs}
          style={styles.bottomTabsScroll}
        >
          {TABS.map(t => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tabItem, activeTab === t.key && styles.tabItemActive]}>
              <Text style={[styles.tabTxt, activeTab === t.key && styles.tabTxtActive]} numberOfLines={1}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={styles.sidebar}>
        <Pressable onPress={goTasks}>
          <Text style={styles.sidebarBrand}>NOBLELIFT</Text>
        </Pressable>
        {TABS.map(t => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.sideItem, activeTab === t.key && styles.sideActive]}>
            <Text style={[styles.sideTxt, activeTab === t.key && styles.sideTxtActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.topbar}>
          <View style={styles.brandTouch} />
          <Text style={styles.title}>{TITLE_MAP[activeTab]}</Text>
          <Pressable onPress={() => setStatusModalVisible(true)} style={styles.headerStatusBtn}>
            <Text style={styles.headerStatusBtnText}>{headerStatusLabel}</Text>
          </Pressable>
          <Pressable onPress={onLogout} style={styles.headerLogoutBtn}>
            <Text style={styles.headerLogoutBtnText}>Выйти</Text>
          </Pressable>
        </View>
        <HeaderStatusModal
          visible={statusModalVisible}
          onClose={() => setStatusModalVisible(false)}
          statuses={statuses}
          currentCode={headerStatusCode}
          onSelect={onStatusSelect}
          statusLabelOnly={statusLabelOnly}
        />
        <View style={{ flex: 1, padding: spacing(4) }}>{screen}</View>
      </View>
    </View>
  );
}

function HeaderStatusModal({
  visible,
  onClose,
  statuses,
  currentCode,
  onSelect,
  statusLabelOnly,
}: {
  visible: boolean;
  onClose: () => void;
  statuses: StatusRef[];
  currentCode: string;
  onSelect: (code: string) => void;
  statusLabelOnly: (l: string | null | undefined) => string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.statusModalBackdrop} onPress={onClose}>
        <View style={styles.statusModalCard} onStartShouldSetResponder={() => true}>
          <Text style={styles.statusModalTitle}>Выберите статус</Text>
          <View style={styles.statusModalGrid}>
            {statuses.map((s) => (
              <TouchableOpacity
                key={s.code}
                style={[styles.statusModalBtn, s.code === currentCode && styles.statusModalBtnActive]}
                onPress={() => onSelect(s.code)}
              >
                <Text style={[styles.statusModalBtnText, s.code === currentCode && styles.statusModalBtnTextActive]}>
                  {statusLabelOnly(s.label)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.statusModalCancel}>
            <Text style={styles.statusModalCancelText}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topbar: { height: 56, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: spacing(2), paddingHorizontal: spacing(3), minHeight: 48 },
  topbarNarrow: { height: 48, paddingHorizontal: spacing(2) },
  brandTouch: { paddingVertical: 4, paddingRight: 8 },
  brand: { fontWeight: '800', letterSpacing: 1, color: colors.primary, fontSize: 14 },
  brandSmall: { fontSize: 12 },
  title: { fontWeight: '700', color: colors.text, fontSize: 16, flex: 1 },
  titleSmall: { fontSize: 14 },
  headerStatusBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerStatusBtnText: { color: '#000', fontWeight: '600', fontSize: 13 },
  headerLogoutBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerLogoutBtnText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  statusModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 16 },
  statusModalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  statusModalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  statusModalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statusModalBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  statusModalBtnActive: { borderColor: '#111827', backgroundColor: '#11182710' },
  statusModalBtnText: { fontSize: 14, color: '#111827' },
  statusModalBtnTextActive: { fontWeight: '700' },
  statusModalCancel: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 12 },
  statusModalCancelText: { color: '#111827', fontWeight: '600' },
  bottomTabsScroll: { maxHeight: 52, borderTopWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  bottomTabs: { flexDirection: 'row', paddingVertical: spacing(2), paddingHorizontal: spacing(1), minWidth: '100%' },
  tabItem: { paddingHorizontal: spacing(2.5), paddingVertical: spacing(2), alignItems: 'center', justifyContent: 'center', minWidth: 64 },
  tabItemActive: { backgroundColor: '#fff3ee' },
  tabTxt: { color: colors.mut, fontSize: 12 },
  tabTxtActive: { color: colors.text, fontWeight: '700' },
  sidebar: { width: 240, borderRightWidth: 1, borderColor: colors.border, paddingVertical: spacing(3), backgroundColor: '#fff' },
  sidebarBrand: { fontWeight: '800', color: colors.primary, paddingHorizontal: spacing(3), marginBottom: spacing(2) },
  sideItem: { paddingVertical: spacing(2), paddingHorizontal: spacing(3) },
  sideActive: { backgroundColor: '#fff3ee' },
  sideTxt: { color: colors.mut },
  sideTxtActive: { color: colors.text, fontWeight: '700' },
});
