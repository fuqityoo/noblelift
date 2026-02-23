import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Modal,
  Platform,
  Pressable,
} from 'react-native';
import { getJSON, patchJSON, postJSON, uploadAvatar } from '../lib/api';
import Avatar from '../components/Avatar';

// ===== Типы под бэкенд =====
type Role = { id?: number; code?: string; name?: string };
type Status = { code: string; label?: string };
type Links = { telegram?: string | null; whatsapp?: string | null; email?: string | null; phone?: string | null };

type ProfileInner = {
  userId: number;
  status: Status;
  statusPayload?: Record<string, unknown> | null;
  links?: Links | null;
  arrivedAt?: number | null;
  lastSeenAt?: number | null;
};

type User = {
  id: number;
  email?: string;
  phone?: string | null;
  fullName?: string;
  title?: string;
  avatarUrl?: string | null;
  role?: Role;
  isActive?: boolean;
  createdAt?: number;
  profile: ProfileInner;
};

type MeResponse = { userId: number };
type StatusRef = { code: string; label: string };

// ===== Мелкие утилиты =====
function prettyTime(ms?: number | null): string {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

export default React.memo(function ProfileScreen() {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const [user, setUser] = useState<User | null>(null);
  const [statuses, setStatuses] = useState<StatusRef[]>([]);

  // editable
  const [fullName, setFullName] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [statusCode, setStatusCode] = useState<string>('');
  const [telegram, setTelegram] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [emailLink, setEmailLink] = useState<string>('');
  const [phone, setPhone] = useState<string>('');

  const [statusModal, setStatusModal] = useState<boolean>(false);
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const placeholderColor = '#6b7280';

  useEffect(() => {
    (async () => {
      try {
        // 1) Берём только id
        const me = await getJSON<MeResponse>('/profiles/me');

        // 2) Весь профиль — из users/{id}
        const u = await getJSON<User>(`/users/${me.userId}`);

        // 3) Справочник статусов
        const stsRaw = await getJSON<any>('/statuses');
        const list: StatusRef[] = Array.isArray(stsRaw?.items) ? stsRaw.items : Array.isArray(stsRaw) ? stsRaw : [];
        setStatuses(list);

        setUser(u);
        // Инициализация формы
        setFullName(u.fullName || '');
        setTitle(u.title || '');
        setStatusCode(u.profile?.status?.code || '');
        const links = u.profile?.links || {};
        setTelegram(links.telegram || '');
        setWhatsapp(links.whatsapp || '');
        setEmailLink(links.email || '');
        setPhone(links.phone || u.phone || '');
      } catch (e: any) {
        Alert.alert('Ошибка', e?.message || 'Не удалось загрузить профиль');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const currentStatusLabel = useMemo(() => {
    const f = statuses.find((s) => s.code === statusCode);
    return f?.label ?? '—';
  }, [statuses, statusCode]);

async function onSave() {
  if (!user) return;
  setSaving(true);
  try {
    // 1) users/{id}: ФИО/должность/телефон
    await patchJSON<User>(`/users/${user.id}`, {
      fullName: fullName || '',
      title: title || '',
      phone: phone || null,
    });

    // 2) profiles/me: ссылки (telegram, whatsapp, email)
    await patchJSON('/profiles/me', {
      links: { telegram: telegram || null, whatsapp: whatsapp || null, email: emailLink || null, phone: phone || null },
    });

    // 3) profiles/me/status: статус
    const prevStatus = user.profile?.status?.code || '';
    const statusChanged = statusCode && statusCode !== prevStatus;
    const statusObj = statuses.find(s => s.code === statusCode);
    if (!statusObj) throw new Error(`Неизвестный статус: ${statusCode}`);

    if (statusChanged) {
      await postJSON(`/profiles/me/status`, {
        status: { code: statusObj.code, label: statusObj.label },
      });
    }

    // 4) рефетчим профиль, чтобы увидеть актуальные данные и arrivedAt от сервера
    const fresh = await getJSON<User>(`/users/${user.id}`);

    const label =
      statuses.find(s => s.code === fresh.profile?.status?.code)?.label ??
      statuses.find(s => s.code === statusCode)?.label ??
      fresh.profile?.status?.label;

    setUser({
      ...fresh,
      profile: { ...fresh.profile, status: { code: fresh.profile?.status?.code || statusCode, label } },
    });

    Alert.alert('Сохранено', 'Профиль обновлён');
  } catch (e: any) {
    Alert.alert('Ошибка сохранения', e?.message || 'Не удалось сохранить изменения');
  } finally {
    setSaving(false);
  }
}



  async function onAvatarPick(file: File | null) {
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const { avatarUrl } = await uploadAvatar(file, file.name);
      setUser((u) => (u ? { ...u, avatarUrl } : null));
      Alert.alert('Готово', 'Аватар обновлён');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить аватар');
    } finally {
      setUploadingAvatar(false);
    }
  }

  function onReset() {
    if (!user) return;
    setFullName(user.fullName || '');
    setTitle(user.title || '');
    setStatusCode(user.profile?.status?.code || '');
    const links = user.profile?.links || {};
    setTelegram(links.telegram || '');
    setWhatsapp(links.whatsapp || '');
    setEmailLink(links.email || '');
    setPhone(links.phone || user.phone || '');
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Загрузка…</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Не удалось получить данные пользователя</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>Профиль</Text>
        <View style={styles.metaRow}>
          <Text style={styles.badge}>{user.role?.name ?? '—'}</Text>
          <Text style={styles.meta}>ID: {user.id}</Text>
          <Text style={styles.meta}>Активен: {user.isActive ? 'да' : 'нет'}</Text>
          {!!user.createdAt && <Text style={styles.meta}>Создан: {prettyTime(user.createdAt)}</Text>}
        </View>

        <View style={styles.avatarRow}>
          <Avatar avatarUrl={user.avatarUrl} fullName={user.fullName} size={72} />
          <View style={styles.avatarActions}>
            {Platform.OS === 'web' ? (
              <>
                <Pressable
                  onPress={() => (fileInputRef as any).current?.click?.()}
                  style={styles.avatarBtn}
                  disabled={uploadingAvatar}
                >
                  <Text style={styles.avatarBtnText}>{uploadingAvatar ? 'Загрузка…' : 'Загрузить с устройства'}</Text>
                </Pressable>
                {/* @ts-ignore */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e: any) => {
                    const f = e.target?.files?.[0];
                    onAvatarPick(f ?? null);
                    e.target.value = '';
                  }}
                />
              </>
            ) : (
              <Text style={styles.muted}>На мобильных загрузка аватара — через веб-версию</Text>
            )}
          </View>
        </View>

        <Text style={styles.label}>ФИО</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Иван Иванов"
          placeholderTextColor={placeholderColor}
        />

        <Text style={styles.label}>Должность</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Инженер"
          placeholderTextColor={placeholderColor}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          value={emailLink}
          onChangeText={setEmailLink}
          placeholder="name@example.com"
          placeholderTextColor={placeholderColor}
        />

        <Text style={styles.label}>Телефон</Text>
        <TextInput
          style={styles.input}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          placeholder="+49 123 456"
          placeholderTextColor={placeholderColor}
        />

        <Text style={styles.label}>Telegram</Text>
        <TextInput
          style={styles.input}
          value={telegram}
          onChangeText={setTelegram}
          placeholder="@username"
          placeholderTextColor={placeholderColor}
        />

        <Text style={styles.label}>WhatsApp</Text>
        <TextInput
          style={styles.input}
          value={whatsapp}
          onChangeText={setWhatsapp}
          placeholder="+49 123 456"
          placeholderTextColor={placeholderColor}
        />

        <Text style={styles.label}>Статус</Text>
        <TouchableOpacity onPress={() => setStatusModal(true)} style={styles.select}>
          <Text style={styles.selectText}>
            {currentStatusLabel !== '—' ? `${currentStatusLabel} (${statusCode})` : 'Выберите статус'}
          </Text>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity onPress={onReset} style={[styles.btn, styles.btnGhost]}>
            <Text style={styles.btnTextGhost}>Сброс</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onSave}
            disabled={saving}
            style={[styles.btn, saving ? styles.btnDisabled : styles.btnPrimary]}
          >
            {saving ? <ActivityIndicator /> : <Text style={styles.btnText}>Сохранить</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Кастомный селект статусов */}
      <Modal visible={statusModal} transparent animationType="fade" onRequestClose={() => setStatusModal(false)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Выберите статус</Text>

          <View style={styles.grid}>
            {statuses.map((s) => (
              <TouchableOpacity
                key={s.code}
                style={[styles.statusBtn, s.code === statusCode && styles.statusBtnActive]}
                onPress={() => {
                  setStatusCode(s.code);
                  setStatusModal(false);
                }}
              >
                <Text style={[styles.statusBtnText, s.code === statusCode && styles.statusBtnTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity onPress={() => setStatusModal(false)} style={[styles.btn, styles.btnGhost]}>
              <Text style={styles.btnTextGhost}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: '#6b7280', marginTop: 8 },

  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },

  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  badge: { backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, marginRight: 8, color: '#111827' },
  meta: { color: '#6b7280', marginRight: 10, marginTop: 4 },

  label: { marginTop: 12, marginBottom: 6, fontSize: 13, color: '#374151' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#111827', backgroundColor: 'white', minHeight: 44 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 16 },
  avatarActions: { flex: 1 },
  avatarBtn: { backgroundColor: '#111827', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignSelf: 'flex-start' },
  avatarBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  mono: { fontFamily: 'Courier' },

  select: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 14, backgroundColor: 'white' },
  selectText: { color: '#111827', fontSize: 16 },

  hint: { color: '#6b7280', fontSize: 12, marginTop: 6 },

  metaBox: { marginTop: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, backgroundColor: '#fafafa' },

  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  btn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, minWidth: 120, alignItems: 'center', marginLeft: 12 },
  btnPrimary: { backgroundColor: '#111827' },
  btnDisabled: { backgroundColor: '#9ca3af' },
  btnText: { color: 'white', fontWeight: '600' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#e5e7eb' },
  btnTextGhost: { color: '#111827', fontWeight: '600' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  optionRow: { paddingVertical: 12 },
  optionText: { fontSize: 16 },
  separator: { height: 1, backgroundColor: '#e5e7eb' },
  modalActions: { marginTop: 12, alignItems: 'flex-end' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  statusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: 'white',
  },
  statusBtnActive: { borderColor: '#111827', backgroundColor: '#11182710' },
  statusBtnText: { fontSize: 14, color: '#111827' },
  statusBtnTextActive: { fontWeight: '700' },
});
