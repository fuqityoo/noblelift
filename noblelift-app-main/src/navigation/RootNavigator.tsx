import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, ScrollView } from 'react-native';
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

const TABS: { key: Tab; label: string }[] = [
  { key: 'tasks', label: 'Задачи' },
  { key: 'available', label: 'Доступные' },
  { key: 'create', label: 'Создать' },
  { key: 'profile', label: 'Профиль' },
  { key: 'directory', label: 'Справочник' },
  { key: 'cars', label: 'Автопарк' },
  { key: 'archive', label: 'Завершённые' },
];

const TITLE_MAP: Record<Tab, string> = {
  tasks: 'Мои задачи',
  available: 'Доступные задачи',
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

  const setTab = (tab: Tab) => dispatch({ type: 'SET_TAB', tab });

  if (!isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        <View style={[styles.topbar, isNarrow && styles.topbarNarrow]}>
          <Text style={[styles.brand, isNarrow && styles.brandSmall]} numberOfLines={1}>NOBLELIFT</Text>
          <Text style={[styles.title, isNarrow && styles.titleSmall]} numberOfLines={1}>{TITLE_MAP[activeTab]}</Text>
        </View>
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
        <Text style={styles.sidebarBrand}>NOBLELIFT</Text>
        {TABS.map(t => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.sideItem, activeTab === t.key && styles.sideActive]}>
            <Text style={[styles.sideTxt, activeTab === t.key && styles.sideTxtActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.topbar}>
          <Text style={styles.brand}></Text>
          <Text style={styles.title}>{TITLE_MAP[activeTab]}</Text>
        </View>
        <View style={{ flex: 1, padding: spacing(4) }}>{screen}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { height: 56, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: spacing(2), paddingHorizontal: spacing(3), minHeight: 48 },
  topbarNarrow: { height: 48, paddingHorizontal: spacing(2) },
  brand: { fontWeight: '800', letterSpacing: 1, color: colors.primary, fontSize: 14 },
  brandSmall: { fontSize: 12 },
  title: { fontWeight: '700', color: colors.text, fontSize: 16, flex: 1 },
  titleSmall: { fontSize: 14 },
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
