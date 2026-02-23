import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { colors, spacing } from '../ui/theme';
import Card from '../components/Card';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
import { api, getJSON, API_URL, getAccessToken } from '../lib/api';

const isWeb = Platform.OS === 'web';
const ROLE_ORDER: Record<string, number> = { super_admin: 0, manager: 1, employee: 2 };

type Dir = { id: number; parentId: number | null; name: string; createdAt?: number };
type Doc = { id: number; directoryId: number | null; title: string; description?: string | null };
type DocVersion = { id: number; version: number; originalName: string };
type UserColleague = {
  id: number;
  fullName: string;
  title?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
  profile?: { status?: { label?: string }; links?: { phone?: string; email?: string; telegram?: string; whatsapp?: string } };
};

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, '');
  const p = path.replace(/^\/+/, '');
  return `${b}/${p}`;
}

export default function DirectoryScreen() {
  const [dirs, setDirs] = useState<Dir[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [colleagues, setColleagues] = useState<UserColleague[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [newDirName, setNewDirName] = useState('');
  const [showNewDir, setShowNewDir] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parentId = useMemo(() => {
    if (selectedId == null) return null;
    const d = dirs.find((x) => x.id === selectedId);
    return d?.parentId ?? null;
  }, [selectedId, dirs]);

  const currentDirs = useMemo(() => {
    return dirs.filter((d) => d.parentId === parentId);
  }, [dirs, parentId]);

  const subDirs = useMemo(() => {
    if (selectedId == null) return [];
    return dirs.filter((d) => d.parentId === selectedId);
  }, [dirs, selectedId]);

  const pathDirs = useMemo(() => {
    if (selectedId == null) return [];
    const path: Dir[] = [];
    let cur: number | null = selectedId;
    while (cur != null) {
      const d = dirs.find((x) => x.id === cur);
      if (!d) break;
      path.unshift(d);
      cur = d.parentId;
    }
    return path;
  }, [selectedId, dirs]);

  const loadDirs = useCallback(async () => {
    const r = await api('/directories');
    if (!r.ok) return;
    const data = await r.json();
    setDirs(data?.items ?? []);
  }, []);

  const loadDocs = useCallback(async (dirId: number) => {
    setLoadingDocs(true);
    try {
      const r = await api(`/documents?directory_id=${dirId}&limit=200`);
      if (!r.ok) return;
      const data = await r.json();
      setDocs(data?.items ?? []);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [meRes, dirRes, usersRes] = await Promise.all([
          api('/profiles/me'),
          api('/directories'),
          api('/users?limit=200'),
        ]);
        if (dirRes.ok && mounted) {
          const d = await dirRes.json();
          setDirs(d?.items ?? []);
        }
        if (usersRes.ok && mounted) {
          const u = await usersRes.json();
          const list: UserColleague[] = (u?.items ?? []).filter((x: any) => x.isActive !== false);
          list.sort((a: any, b: any) => {
            const ra = ROLE_ORDER[String(a?.role?.code ?? '').toLowerCase()] ?? 3;
            const rb = ROLE_ORDER[String(b?.role?.code ?? '').toLowerCase()] ?? 3;
            if (ra !== rb) return ra - rb;
            return (a.fullName ?? '').localeCompare(b.fullName ?? '');
          });
          setColleagues(list);
        }
        if (meRes.ok && mounted) {
          const me = await meRes.json();
          const uid = me?.userId ?? me?.userId;
          const userRes = await api(`/users/${uid}`);
          if (userRes.ok) {
            const user = await userRes.json();
            setIsSuperAdmin(String(user?.role?.code ?? '').toLowerCase() === 'super_admin');
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (selectedId != null) loadDocs(selectedId);
    else setDocs([]);
  }, [selectedId, loadDocs]);

  const handleCreateDir = async () => {
    const name = newDirName.trim();
    if (!name) return;
    try {
      const r = await api('/directories', {
        method: 'POST',
        body: JSON.stringify({ parentId: selectedId, name }),
        headers: { 'Content-Type': 'application/json', ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}) },
      });
      if (!r.ok) throw new Error('Ошибка создания');
      setNewDirName('');
      setShowNewDir(false);
      loadDirs();
      Alert.alert('Готово', 'Директория создана');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось создать директорию');
    }
  };

  const handleDocClick = async (doc: Doc) => {
    try {
      const r = await api(`/documents/${doc.id}/versions`);
      if (!r.ok) throw new Error('Версии не получены');
      const data = await r.json();
      const items: DocVersion[] = data?.items ?? [];
      const latest = items.sort((a, b) => b.version - a.version)[0];
      if (!latest) {
        Alert.alert('Нет файла', 'У документа пока нет загруженных версий.');
        return;
      }
      const res = await api(`/documents/${doc.id}/versions/${latest.version}`);
      if (!res.ok) throw new Error('Скачивание не удалось');
      const blob = await res.blob();
      if (Platform.OS === 'web') {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = latest.originalName || 'document';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } else {
        Alert.alert('Готово', `Файл: ${latest.originalName}`);
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось скачать');
    }
  };

  const handleUploadDoc = () => {
    if (Platform.OS !== 'web' || selectedId == null) return;
    (fileInputRef as any).current?.click?.();
  };

  const onFileSelected = async (e: any) => {
    const file = e.target?.files?.[0];
    if (!file || selectedId == null) return;
    setUploading(true);
    try {
      const createRes = await api('/documents', {
        method: 'POST',
        body: JSON.stringify({ directoryId: selectedId, title: file.name, description: null }),
        headers: { 'Content-Type': 'application/json', ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}) },
      });
      if (!createRes.ok) throw new Error('Не удалось создать документ');
      const doc = await createRes.json();
      const form = new FormData();
      form.append('f', file);
      const uploadRes = await fetch(joinUrl(API_URL, `/documents/${doc.id}/versions`), {
        method: 'POST',
        headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
        body: form,
      });
      if (!uploadRes.ok) throw new Error('Не удалось загрузить файл');
      loadDocs(selectedId);
      Alert.alert('Готово', 'Документ загружен');
    } catch (err: any) {
      Alert.alert('Ошибка', err?.message ?? 'Ошибка загрузки');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

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
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.h1}>Справочник</Text>
          {selectedId != null && (
            <Pressable onPress={() => setSelectedId(parentId)} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Назад</Text>
            </Pressable>
          )}
        </View>
        {pathDirs.length > 0 && (
          <View style={styles.breadcrumb}>
            <Pressable onPress={() => setSelectedId(null)} style={styles.breadcrumbItem}>
              <Text style={styles.breadcrumbText}>Справочник</Text>
            </Pressable>
            {pathDirs.map((d) => (
              <View key={d.id} style={styles.breadcrumbRow}>
                <Text style={styles.breadcrumbSep}> / </Text>
                <Pressable onPress={() => setSelectedId(d.id)} style={styles.breadcrumbItem}>
                  <Text style={styles.breadcrumbText}>{d.name}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {selectedId == null ? (
          <>
            {isSuperAdmin && (
              <View style={styles.newDirRow}>
                {!showNewDir ? (
                  <Button title="Создать директорию" onPress={() => setShowNewDir(true)} />
                ) : (
                  <>
                    <TextInput
                      value={newDirName}
                      onChangeText={setNewDirName}
                      placeholder="Название директории"
                      placeholderTextColor={colors.mut}
                      style={styles.input}
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Button title="Создать" onPress={handleCreateDir} />
                      <Pressable onPress={() => { setShowNewDir(false); setNewDirName(''); }} style={styles.ghostBtn}>
                        <Text style={styles.ghostBtnText}>Отмена</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            )}
            {currentDirs.map((d) => (
              <View key={d.id} style={styles.docRow}>
                <Pressable style={{ flex: 1 }} onPress={() => setSelectedId(d.id)}>
                  <Card>
                    <Text style={styles.cardText}>📁 {d.name}</Text>
                  </Card>
                </Pressable>
                {isSuperAdmin && (
                  <Pressable
                    onPress={() => {
                      const msg = `Удалить директорию «${d.name}»?`;
                      const doDelete = async () => {
                        try {
                          const r = await api(`/directories/${d.id}`, { method: 'DELETE' });
                          if (!r.ok) throw new Error('Не удалось удалить');
                          loadDirs();
                        } catch (e: any) {
                          Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить директорию');
                        }
                      };
                      if (isWeb && typeof window !== 'undefined' && window.confirm(msg)) {
                        doDelete();
                      } else {
                        Alert.alert('Удалить директорию', msg, [
                          { text: 'Отмена', style: 'cancel' },
                          { text: 'Удалить', style: 'destructive', onPress: doDelete },
                        ]);
                      }
                    }}
                    style={styles.deleteDocBtn}
                  >
                    <Text style={styles.deleteDocBtnText}>Удалить</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </>
        ) : (
          <>
            {subDirs.map((d) => (
              <View key={d.id} style={styles.docRow}>
                <Pressable style={{ flex: 1 }} onPress={() => setSelectedId(d.id)}>
                  <Card>
                    <Text style={styles.cardText}>📁 {d.name}</Text>
                  </Card>
                </Pressable>
                {isSuperAdmin && (
                  <Pressable
                    onPress={() => {
                      const msg = `Удалить директорию «${d.name}»?`;
                      const doDelete = async () => {
                        try {
                          const r = await api(`/directories/${d.id}`, { method: 'DELETE' });
                          if (!r.ok) throw new Error('Не удалось удалить');
                          loadDirs();
                          if (selectedId != null) loadDocs(selectedId);
                        } catch (e: any) {
                          Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить директорию');
                        }
                      };
                      if (isWeb && typeof window !== 'undefined' && window.confirm(msg)) {
                        doDelete();
                      } else {
                        Alert.alert('Удалить директорию', msg, [
                          { text: 'Отмена', style: 'cancel' },
                          { text: 'Удалить', style: 'destructive', onPress: doDelete },
                        ]);
                      }
                    }}
                    style={styles.deleteDocBtn}
                  >
                    <Text style={styles.deleteDocBtnText}>Удалить</Text>
                  </Pressable>
                )}
              </View>
            ))}
            {loadingDocs ? (
              <ActivityIndicator style={{ marginVertical: 20 }} />
            ) : (
              <>
                <View style={styles.uploadRow}>
                  <Button title={uploading ? 'Загрузка…' : 'Загрузить документ'} onPress={handleUploadDoc} disabled={uploading} />
                  {/* @ts-ignore */}
                  <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={onFileSelected} />
                </View>
                {docs.map((doc) => (
                  <View key={doc.id} style={styles.docRow}>
                    <Pressable style={{ flex: 1 }} onPress={() => handleDocClick(doc)}>
                      <Card>
                        <Text style={styles.cardText}>📄 {doc.title}</Text>
                      </Card>
                    </Pressable>
                    {isSuperAdmin && (
                      <Pressable
                        onPress={() => {
                          const msg = `Удалить документ «${doc.title}»?`;
                          const doDelete = async () => {
                            try {
                              const r = await api(`/documents/${doc.id}`, { method: 'DELETE' });
                              if (!r.ok) throw new Error('Не удалось удалить');
                              if (selectedId != null) loadDocs(selectedId);
                            } catch (e: any) {
                              Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить документ');
                            }
                          };
                          if (isWeb && typeof window !== 'undefined' && window.confirm(msg)) {
                            doDelete();
                          } else {
                            Alert.alert('Удалить документ', msg, [
                              { text: 'Отмена', style: 'cancel' },
                              { text: 'Удалить', style: 'destructive', onPress: doDelete },
                            ]);
                          }
                        }}
                        style={styles.deleteDocBtn}
                      >
                        <Text style={styles.deleteDocBtnText}>Удалить</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </View>

      <Text style={[styles.h1, styles.sectionTitle]}>Коллеги</Text>
      <View style={styles.colleagues}>
        {colleagues.map((u) => (
          <Card key={u.id}>
            <View style={styles.colleagueRow}>
              <Avatar avatarUrl={u.avatarUrl} fullName={u.fullName} size={44} />
              <View style={styles.colleagueInfo}>
                <Text style={styles.colleagueName}>{u.fullName ?? '—'}</Text>
                {u.title ? <Text style={styles.colleagueTitle}>{u.title}</Text> : null}
                {u.profile?.status?.label ? <Text style={styles.colleagueStatus}>{u.profile.status.label}</Text> : null}
                <View style={styles.contacts}>
                  {[u.profile?.links?.phone, u.profile?.links?.email].filter(Boolean).map((c, i) => (
                    <Text key={i} style={styles.contact} numberOfLines={1}>{c}</Text>
                  ))}
                </View>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(3), paddingBottom: spacing(6) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: colors.mut, marginTop: 8 },
  section: { marginBottom: spacing(2) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(2) },
  h1: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing(2) },
  sectionTitle: { marginTop: spacing(4) },
  cardText: { color: colors.text, fontSize: 16 },
  backBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  backBtnText: { color: '#111827', fontWeight: '600' },
  breadcrumb: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: spacing(2), gap: 0 },
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center' },
  breadcrumbSep: { color: colors.mut, fontSize: 14 },
  breadcrumbItem: { paddingVertical: 2, paddingHorizontal: 4 },
  breadcrumbText: { color: '#111827', fontSize: 14, fontWeight: '500' },
  newDirRow: { marginBottom: spacing(2), gap: 8 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, color: colors.text, backgroundColor: '#fff', minHeight: 44 },
  ghostBtn: { paddingVertical: 10, paddingHorizontal: 14, justifyContent: 'center' },
  ghostBtnText: { color: '#111827', fontWeight: '600' },
  uploadRow: { marginBottom: spacing(2) },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing(2) },
  deleteDocBtn: {
    width: 72,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  deleteDocBtnText: { color: '#111827', fontWeight: '600', fontSize: 13 },
  colleagues: { gap: spacing(2) },
  colleagueRow: { flexDirection: 'row', alignItems: 'center' },
  colleagueInfo: { flex: 1, marginLeft: 12 },
  colleagueName: { fontSize: 16, fontWeight: '700', color: colors.text },
  colleagueTitle: { fontSize: 13, color: colors.mut, marginTop: 2 },
  colleagueStatus: { fontSize: 12, color: colors.text, marginTop: 2 },
  contacts: { marginTop: 4 },
  contact: { fontSize: 12, color: colors.mut },
});
