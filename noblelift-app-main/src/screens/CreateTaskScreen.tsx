// src/screens/CreateTaskScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Platform, Pressable, Alert, Modal } from 'react-native';
import { useApp } from '../state/AppContext';
import { colors, spacing, radii } from '../ui/theme';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
import { api, API_URL, getAccessToken } from '../lib/api';
import { listTaskTopics, deleteTaskTopic } from '../services/taskTopics';
import type { Task } from '../models/Task';

const isWeb = Platform.OS === 'web';

type PriorityCode = 'low' | 'medium' | 'high';

const PRIORITY_OPTS: Array<{ label: string; value: PriorityCode }> = [
  { label: 'низкий',  value: 'low'    },
  { label: 'средний', value: 'medium' },
  { label: 'высокий', value: 'high'   },
];

const LINE = 20;
const MW   = 760;

// --- date helpers ---
function parseDateInput(d: string): Date | null {
  const m = d.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const dd = +m[1], mm = +m[2]-1, yyyy = +m[3];
  const dt = new Date(yyyy, mm, dd, 0, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
function fmtDate(d: Date) {
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}
function toIsoLocal(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString();
}

/** Ввод только цифр → автоформат ДД.ММ.ГГГГ */
function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

// --- DueDate: ручной ввод с автоформатом ДД.ММ.ГГГГ + кнопка «Календарь» (web: date input, mobile: модалка) ---
function DueDateField({
  valueText,
  onTextChange,
}: { valueText: string; onTextChange: (v: string)=>void }) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const webDateRef = useRef<HTMLInputElement | null>(null);
  const parsed = parseDateInput(valueText);
  const today = new Date();
  const [day, setDay] = useState(parsed ? parsed.getDate() : today.getDate());
  const [month, setMonth] = useState(parsed ? parsed.getMonth() + 1 : today.getMonth() + 1);
  const [year, setYear] = useState(parsed ? parsed.getFullYear() : today.getFullYear());

  const openPicker = () => {
    const d = parseDateInput(valueText) || new Date();
    setDay(d.getDate());
    setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
    setPickerVisible(true);
  };

  const applyPicker = () => {
    const mm = Math.max(1, Math.min(12, month));
    const d = new Date(year, mm - 1, 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const dd = Math.max(1, Math.min(lastDay, day));
    onTextChange(fmtDate(new Date(year, mm - 1, dd)));
    setPickerVisible(false);
  };

  const handleManualChange = (t: string) => {
    onTextChange(formatDateInput(t));
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>Срок выполнения</Text>
      <View style={styles.dateRow}>
        <TextInput
          placeholder="ДД.ММ.ГГГГ"
          placeholderTextColor={colors.mut}
          value={valueText}
          onChangeText={handleManualChange}
          style={[styles.input, { flex: 1 }]}
          keyboardType="number-pad"
        />
        <Pressable onPress={isWeb ? () => (webDateRef.current as any)?.showPicker?.() || webDateRef.current?.focus() : openPicker} style={styles.datePickerBtn}>
          <Text style={styles.datePickerBtnText}>Календарь</Text>
        </Pressable>
      </View>
      {isWeb && (
        <input
          ref={webDateRef}
          type="date"
          value={parsed ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}` : ''}
          onChange={(e: any) => {
            const v = e.target?.value;
            if (!v) { onTextChange(''); return; }
            const [yyyy, mm, dd] = v.split('-').map((s: string) => parseInt(s, 10));
            onTextChange(fmtDate(new Date(yyyy, mm - 1, dd)));
          }}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
        />
      )}
      {!isWeb && pickerVisible && (
        <Modal visible transparent animationType="fade">
          <Pressable style={styles.dateModalBackdrop} onPress={() => setPickerVisible(false)}>
            <View style={styles.dateModalCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.dateModalTitle}>Выберите дату</Text>
              <View style={styles.dateModalRow}>
                <View style={styles.dateModalField}>
                  <Text style={styles.dateModalLabel}>День</Text>
                  <TextInput value={String(day)} onChangeText={(t) => setDay(parseInt(t, 10) || 1)} keyboardType="number-pad" style={styles.dateModalInput} />
                </View>
                <View style={styles.dateModalField}>
                  <Text style={styles.dateModalLabel}>Месяц</Text>
                  <TextInput value={String(month)} onChangeText={(t) => setMonth(parseInt(t, 10) || 1)} keyboardType="number-pad" style={styles.dateModalInput} />
                </View>
                <View style={styles.dateModalField}>
                  <Text style={styles.dateModalLabel}>Год</Text>
                  <TextInput value={String(year)} onChangeText={(t) => setYear(parseInt(t, 10) || new Date().getFullYear())} keyboardType="number-pad" style={styles.dateModalInput} />
                </View>
              </View>
              <View style={styles.dateModalActions}>
                <Pressable onPress={() => setPickerVisible(false)} style={styles.dateModalCancel}>
                  <Text style={styles.dateModalCancelText}>Отмена</Text>
                </Pressable>
                <Pressable onPress={applyPicker} style={styles.dateModalOk}>
                  <Text style={styles.dateModalOkText}>Готово</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

type UserOption = { id: number; fullName: string; email?: string; avatarUrl?: string | null };
type RoleOption = { id: number; code: string; name: string };

const ROLE_CODE_TO_LABEL: Record<string, string> = {
  super_admin: 'Супер-админ',
  manager: 'Руководитель',
  employee: 'Сотрудник',
};

function getRoleLabel(r: RoleOption): string {
  const code = (r.code ?? '').toLowerCase();
  return ROLE_CODE_TO_LABEL[code] ?? r.name ?? code;
}

export default function CreateTaskScreen() {
  const { state, dispatch } = useApp();

  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [canCreateCommon, setCanCreateCommon] = useState<boolean>(false);
  const [isManagerOrSuperAdmin, setIsManagerOrSuperAdmin] = useState<boolean>(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [activeUsers, setActiveUsers] = useState<UserOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);

  // форма задачи
  const [type, setType] = useState<'personal' | 'common'>('personal');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dueDateText, setDueDateText] = useState('');
  const [priorityCode, setPriorityCode] = useState<PriorityCode>('medium');
  const [topicId, setTopicId] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState('');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<number | null>(null);
  const [topicsFromApi, setTopicsFromApi] = useState<Array<{ id: number; name: string }>>([]);

  // web file
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);

  // форма создания пользователя (Super Admin)
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserTitle, setNewUserTitle] = useState('');
  const [newUserRoleId, setNewUserRoleId] = useState<number | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);

  // профиль: userId, роль, активные пользователи, роли
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rMe = await api('/profiles/me');
        if (!rMe.ok) throw new Error('profiles/me failed');
        const meData = await rMe.json();
        const first = Array.isArray(meData) ? meData[0] : (meData?.items?.[0] ?? meData);
        const idRaw = first?.id ?? first?.userId ?? first?.userID;
        const myId = Number(idRaw);
        if (!Number.isNaN(myId) && mounted) {
          setMyUserId(myId);
          setSelectedAssigneeId(myId);
        }

        if (!Number.isNaN(myId)) {
          const rUser = await api(`/users/${myId}`);
          if (rUser.ok) {
            const user = await rUser.json();
            const roleCode = String(user?.role?.code ?? user?.roleCode ?? '').toLowerCase();
            const superadmin = roleCode === 'super_admin';
            const managerOrSuper = roleCode === 'super_admin' || roleCode === 'manager';
            if (mounted) {
              setCanCreateCommon(superadmin);
              setIsManagerOrSuperAdmin(managerOrSuper);
              setIsSuperAdmin(superadmin);
            }
          }
        }

        const [rUsers, rRoles] = await Promise.all([
          api('/users?limit=200'),
          api('/roles'),
        ]);
        if (rUsers.ok && mounted) {
          const data = await rUsers.json();
          const items = data?.items ?? data ?? [];
          const active = items.filter((u: any) => u.isActive !== false).map((u: any) => ({
            id: u.id,
            fullName: u.fullName ?? u.email ?? `#${u.id}`,
            email: u.email,
            avatarUrl: u.avatarUrl ?? u.avatar_url ?? null,
          }));
          setActiveUsers(active);
        }
        if (rRoles.ok && mounted) {
          const data = await rRoles.json();
          const items = data?.items ?? data ?? [];
          const roleList = items.map((r: any) => ({ id: r.id, code: r.code, name: r.name }));
          setRoles(roleList);
          if (roleList.length) setNewUserRoleId(roleList[0].id);
        }
        const topicsRes = await listTaskTopics();
        if (mounted) setTopicsFromApi(Array.isArray(topicsRes) ? topicsRes : []);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  const topicOptions = useMemo(
    () => topicsFromApi.map((t) => ({ id: String(t.id), label: t.name })),
    [topicsFromApi],
  );

  // дни до дедлайна
  const daysLeft = useMemo(() => {
    const due = parseDateInput(dueDateText);
    if (!due) return '—';
    const today = new Date(); today.setHours(0,0,0,0);
    const ms = due.getTime() - today.getTime();
    return ms >= 0 ? Math.ceil(ms/86400000) : `-${Math.ceil(Math.abs(ms)/86400000)}`;
  }, [dueDateText]);

  const handleSelectTopic = (id: string) => {
    setTopicId(id);
    setNewTopic('');
  };

  const handleAddTopic = useCallback(async () => {
    const name = newTopic.trim();
    if (!name) {
      (isWeb ? alert : (m: string) => Alert.alert('Ошибка', m))('Введите название темы.');
      return;
    }
    if (!canCreateCommon) {
      (isWeb ? alert : (m: string) => Alert.alert('Недостаточно прав', m))('Добавлять темы может только супер-админ.');
      return;
    }
    try {
      const tr = await api('/task-topics', { method: 'POST', body: JSON.stringify({ name }) });
      if (!tr.ok) {
        const err = await tr.json().catch(() => ({}));
        (isWeb ? alert : (m: string) => Alert.alert('Ошибка', m))(err?.detail ?? err?.message ?? 'Не удалось создать тему');
        return;
      }
      const created = await tr.json();
      const list = await listTaskTopics();
      setTopicsFromApi(Array.isArray(list) ? list : []);
      setTopicId(String(created?.id ?? ''));
      setNewTopic('');
    } catch (e: any) {
      (isWeb ? alert : (m: string) => Alert.alert('Ошибка', m))(e?.message ?? 'Не удалось создать тему');
    }
  }, [newTopic, canCreateCommon, isWeb]);

  const handleDeleteTopic = useCallback(async (topicIdNum: number, label: string) => {
    const msg = `Удалить тему «${label}»?`;
    const doDelete = async () => {
      try {
        await deleteTaskTopic(topicIdNum);
        const list = await listTaskTopics();
        setTopicsFromApi(Array.isArray(list) ? list : []);
        if (topicId === String(topicIdNum)) setTopicId(null);
      } catch (e: any) {
        (isWeb ? alert : (m: string) => Alert.alert('Ошибка', m))(e?.message ?? 'Не удалось удалить тему');
      }
    };
    if (isWeb && typeof window !== 'undefined') {
      if (window.confirm(msg)) doDelete();
    } else {
      Alert.alert('Удалить тему', msg, [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: doDelete },
      ]);
    }
  }, [topicId, isWeb]);

  const onCreateUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword.trim() || !newUserFullName.trim() || newUserRoleId == null) {
      return (isWeb ? alert : (m: string) => Alert.alert('Ошибка', m))('Заполните почту, пароль, ФИО и выберите роль.');
    }
    setCreatingUser(true);
    try {
      const r = await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          email: newUserEmail.trim(),
          password: newUserPassword,
          fullName: newUserFullName.trim(),
          title: newUserTitle.trim() || undefined,
          roleId: newUserRoleId,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        const msg = body?.detail ?? body?.message ?? 'Ошибка создания';
        return (isWeb ? alert : (m: string) => Alert.alert('Ошибка', m))(msg);
      }
      (isWeb ? alert : (m: string) => Alert.alert('Готово', m))('Пользователь создан.');
      setNewUserEmail(''); setNewUserPassword(''); setNewUserFullName(''); setNewUserTitle(''); setNewUserRoleId(roles[0]?.id ?? null);
      const rUsers = await api('/users?limit=200');
      if (rUsers.ok) {
        const data = await rUsers.json();
        const items = data?.items ?? data ?? [];
        setActiveUsers(items.filter((u: any) => u.isActive !== false).map((u: any) => ({
          id: u.id,
          fullName: u.fullName ?? u.email ?? `#${u.id}`,
          email: u.email,
          avatarUrl: u.avatarUrl ?? u.avatar_url ?? null,
        })));
      }
    } finally {
      setCreatingUser(false);
    }
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Введите заголовок.';
    if (!content.trim()) return 'Введите содержание.';
    if (!parseDateInput(dueDateText)) return 'Неверный срок выполнения (дд.мм.гггг).';
    if (type === 'common' && !canCreateCommon) return 'Общую задачу может создать только супер-админ.';
    return null;
  };

  const onSubmit = async () => {
    const err = validate();
    if (err) return isWeb ? alert(err) : Alert.alert('Ошибка', err);

    let topicIdFinal: number | null = null;
    if (topicId) {
      const asNum = Number(topicId);
      if (!Number.isNaN(asNum)) topicIdFinal = asNum;
    }

    const due = parseDateInput(dueDateText)!;
    const assigneeId = type === 'personal' ? (selectedAssigneeId ?? myUserId ?? null) : null;
    if (type === 'personal' && myUserId == null) {
      const msg = 'Не удалось определить userId.';
      return isWeb ? alert(msg) : Alert.alert('Ошибка', msg);
    }

    // ВАЖНО: statusCode НЕ отправляем — сервер сам поставит 'new'
    const payload: any = {
      title: title.trim(),
      content: content.trim(),
      dueDate: toIsoLocal(due),
      priorityCode,
      isPrivate: type === 'personal',
      type: type === 'personal' ? 'regular' : 'common',
      topicId: topicIdFinal ?? undefined,
      assigneeId: assigneeId ?? undefined,
    };

    try {
      const r = await api('/tasks', { method: 'POST', body: JSON.stringify(payload) });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        const msg = body?.detail || body?.message || `Не удалось создать задачу (${r.status})`;
        return isWeb ? alert(msg) : Alert.alert('Ошибка', msg);
      }
      const createdTask = await r.json().catch(() => null);

      // upload файла (только Web)
      let uploaded = null;
      if (isWeb && pickedFile && createdTask?.id != null) {
        try {
          const token = getAccessToken();
          const fd = new FormData();
          fd.append('f', pickedFile as any);
          const upload = await fetch(`${API_URL.replace(/\/+$/,'')}/tasks/${createdTask.id}/files`, {
            method: 'POST',
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } as any,
            body: fd,
          });
          if (upload.ok) uploaded = await upload.json().catch(() => null);
        } catch {}
      }

      const t: any = createdTask ?? {
        id: String(Date.now()),
        title: payload.title,
        content: payload.content,
        due: due.getTime(),
        dueDate: payload.dueDate,
        priorityCode: payload.priorityCode,
        statusCode: 'new',
        isPrivate: payload.isPrivate,
        type: payload.type,
        assigneeId: payload.assigneeId ?? null,
        attachments: uploaded ? [{ id: uploaded.id, name: uploaded.originalName, url: uploaded.storagePath, size: uploaded.size }] : [],
      };
      dispatch({ type: 'SET_TASKS', tasks: [{ ...(t as Task) } as Task, ...state.tasks] });

      isWeb ? alert('Задача создана') : Alert.alert('Готово', 'Задача создана');
      // reset
      setTitle(''); setContent(''); setDueDateText(''); setPriorityCode('medium');
      setTopicId(null); setNewTopic(''); setSelectedAssigneeId(myUserId ?? null); setPickedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      const msg = 'Не удалось выполнить запрос.';
      isWeb ? alert(msg) : Alert.alert('Ошибка', msg);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.centerWrap}>
        <View style={styles.form}>
          <Text style={styles.h1}>Создать задачу</Text>

          {/* Тип задачи */}
          <View style={styles.row}>
            <Text style={styles.label}>Тип</Text>
            <View style={styles.segment}>
              <Pressable
                style={[styles.segBtn, type === 'personal' && styles.segBtnActive]}
                onPress={() => setType('personal')}
              >
                <Text style={[styles.segBtnText, type === 'personal' && styles.segBtnTextActive]}>Личная</Text>
              </Pressable>
              <Pressable
                style={[styles.segBtn, type === 'common' && styles.segBtnActive, !canCreateCommon && styles.segBtnDisabled]}
                onPress={() => setType('common')}
              >
                <Text style={[styles.segBtnText, type === 'common' && styles.segBtnTextActive]}>Общая</Text>
              </Pressable>
            </View>
          </View>

          {/* Заголовок */}
          <View style={styles.row}>
            <Text style={styles.label}>Заголовок</Text>
            <TextInput
              placeholder="Короткий заголовок"
              placeholderTextColor={colors.mut}
              value={title}
              onChangeText={setTitle}
              style={styles.input}
            />
          </View>

          {/* Тема */}
          <View style={styles.row}>
            <Text style={styles.label}>Тема</Text>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection:'row', flexWrap:'wrap', gap: 8, alignItems: 'center' }}>
                {topicOptions.map((opt) => (
                  <View key={opt.id} style={[styles.pill, (topicId === opt.id) && styles.pillActive]}>
                    <Pressable
                      onPress={() => handleSelectTopic(opt.id)}
                      style={styles.pillContent}
                    >
                      <Text style={[styles.pillText, (topicId === opt.id) && styles.pillTextActive]} numberOfLines={1}>
                        {opt.label}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteTopic(Number(opt.id), opt.label)}
                      style={styles.pillClose}
                      hitSlop={6}
                    >
                      <Text style={styles.pillCloseText}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
              {canCreateCommon && (
                <View style={styles.newTopicRow}>
                  <TextInput
                    placeholder="Новая тема…"
                    placeholderTextColor={colors.mut}
                    value={newTopic}
                    onChangeText={setNewTopic}
                    style={[styles.input, { flex: 1 }]}
                  />
                  <Button title="Новая тема" onPress={handleAddTopic} />
                </View>
              )}
            </View>
          </View>

          {/* Содержание */}
          <View style={styles.row}>
            <Text style={styles.label}>Содержание</Text>
            <TextInput
              placeholder="Текст задачи…"
              placeholderTextColor={colors.mut}
              value={content}
              onChangeText={setContent}
              style={[styles.input, styles.textarea]}
              multiline
            />
          </View>

          {/* Срок */}
          <DueDateField valueText={dueDateText} onTextChange={setDueDateText} />

          {/* Приоритет */}
          <View style={styles.row}>
            <Text style={styles.label}>Приоритет</Text>
            <View style={{ flexDirection:'row', gap: 8, flexWrap: 'wrap' }}>
              {PRIORITY_OPTS.map(p => (
                <Pressable
                  key={p.value}
                  onPress={() => setPriorityCode(p.value)}
                  style={[styles.pill, priorityCode === p.value && styles.pillActive]}
                >
                  <Text style={[styles.pillText, priorityCode === p.value && styles.pillTextActive]}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Дни до дедлайна */}
          <View style={styles.row}>
            <Text style={styles.label}>Дни до дедлайна</Text>
            <TextInput style={styles.input} editable={false} value={String(daysLeft)} />
          </View>

          {/* Прикрепить файл */}
          <View style={styles.row}>
            <Text style={styles.label}>Прикрепить файл</Text>
            {isWeb ? (
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Pressable style={styles.fileBtn} onPress={() => fileInputRef.current?.click()}>
                  <Text style={styles.fileBtnText}>{pickedFile ? 'Заменить файл' : 'Выбрать файл'}</Text>
                </Pressable>
                <Text style={{ color: colors.mut, flexShrink: 1 }} numberOfLines={1}>
                  {pickedFile ? pickedFile.name : 'Файл не выбран'}
                </Text>
                {/* @ts-ignore */}
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e:any) => {
                    const f = e.target.files?.[0];
                    setPickedFile(f ?? null);
                  }}
                />
              </View>
            ) : (
              <Text style={{ color: colors.mut, fontSize: 12 }}>
                На мобильных загрузка файла пока недоступна — используйте веб-версию.
              </Text>
            )}
          </View>

          {/* Исполнитель (только для "Личная") */}
          {type === 'personal' && (
            <View style={styles.row}>
              <Text style={styles.label}>Исполнитель</Text>
              {isManagerOrSuperAdmin ? (
                <ScrollView style={styles.assigneeScroll} nestedScrollEnabled>
                  {activeUsers.map((u) => (
                    <Pressable
                      key={u.id}
                      onPress={() => setSelectedAssigneeId(u.id)}
                      style={[styles.assigneeItem, selectedAssigneeId === u.id && styles.assigneeItemActive]}
                    >
                      <Avatar avatarUrl={u.avatarUrl} fullName={u.fullName} size={32} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.assigneeName}>{u.fullName}</Text>
                        {u.email ? <Text style={styles.assigneeEmail}>{u.email}</Text> : null}
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.assigneeSelf}>
                  <Avatar
                    avatarUrl={activeUsers.find((u) => u.id === myUserId)?.avatarUrl}
                    fullName={activeUsers.find((u) => u.id === myUserId)?.fullName ?? 'Вы'}
                    size={32}
                  />
                  <Text style={[styles.assigneeName, { marginLeft: 10 }]}>
                    {activeUsers.find((u) => u.id === myUserId)?.fullName ?? 'Вы'}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing(2) }}>
            <Button title="Создать" onPress={onSubmit} />
          </View>

          {/* Создать пользователя (только Super Admin) */}
          {isSuperAdmin && (
            <View style={[styles.row, { marginTop: spacing(4), paddingTop: spacing(4), borderTopWidth: 1, borderTopColor: '#e5e7eb' }]}>
              <Text style={[styles.h1, { marginBottom: spacing(2) }]}>Создать пользователя</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Почта</Text>
                <TextInput
                  placeholder="example@mail.ru"
                  placeholderTextColor={colors.mut}
                  value={newUserEmail}
                  onChangeText={setNewUserEmail}
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Пароль</Text>
                <TextInput
                  placeholder="Пароль"
                  placeholderTextColor={colors.mut}
                  value={newUserPassword}
                  onChangeText={setNewUserPassword}
                  style={styles.input}
                  secureTextEntry
                />
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Имя</Text>
                <TextInput
                  placeholder="ФИО"
                  placeholderTextColor={colors.mut}
                  value={newUserFullName}
                  onChangeText={setNewUserFullName}
                  style={styles.input}
                />
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Должность</Text>
                <TextInput
                  placeholder="Должность"
                  placeholderTextColor={colors.mut}
                  value={newUserTitle}
                  onChangeText={setNewUserTitle}
                  style={styles.input}
                />
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Роль</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }}>
                  {roles.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => setNewUserRoleId(r.id)}
                      style={[styles.pill, newUserRoleId === r.id && styles.pillActive]}
                    >
                      <Text style={[styles.pillText, newUserRoleId === r.id && styles.pillTextActive]}>{getRoleLabel(r)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing(2) }}>
                <Button title={creatingUser ? 'Сохранение…' : 'Создать пользователя'} onPress={onCreateUser} disabled={creatingUser} />
              </View>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingVertical: spacing(6), paddingHorizontal: spacing(3) },
  centerWrap: { width: '100%', alignItems: 'center' },
  form: {
    width: '100%',
    maxWidth: MW,
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: spacing(4),
    gap: spacing(3),
    ...(isWeb ? { boxShadow: '0 10px 25px rgba(0,0,0,0.05)' as any } : {}),
  },
  h1: { fontSize: 22, fontWeight: '800', color: colors.text },

  row: { gap: 8 },
  label: { color: colors.text, fontWeight: '600' },

  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: spacing(3),
    color: colors.text,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  textarea: { minHeight: 120, textAlignVertical: 'top', lineHeight: LINE },

  segment: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: radii.lg,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  segBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  segBtnActive: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  segBtnDisabled: { opacity: 0.5 },
  segBtnText: { color: colors.text },
  segBtnTextActive: { fontWeight: '700' },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxWidth: '100%',
  },
  pillActive: { backgroundColor: '#fff7ed', borderColor: '#fdba74' },
  pillContent: { flex: 1, minWidth: 0, paddingRight: 4 },
  pillText: { color: colors.text, fontSize: 13 },
  pillTextActive: { fontWeight: '700' },
  pillClose: { padding: 2, alignItems: 'center', justifyContent: 'center' },
  pillCloseText: { color: colors.mut, fontSize: 18, lineHeight: 20, fontWeight: '400' },
  newTopicRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' },
  datePickerBtn: { paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#F9FAFB' },
  datePickerBtnText: { color: '#111827', fontWeight: '600', fontSize: 14 },
  dateModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  dateModalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  dateModalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  dateModalRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  dateModalField: { flex: 1 },
  dateModalLabel: { fontSize: 12, color: colors.mut, marginBottom: 4 },
  dateModalInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 16 },
  dateModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  dateModalCancel: { paddingVertical: 10, paddingHorizontal: 16 },
  dateModalCancelText: { color: colors.mut, fontWeight: '600' },
  dateModalOk: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#111827', borderRadius: 10 },
  dateModalOkText: { color: '#fff', fontWeight: '600' },
  fileBtn: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fileBtnText: { color: '#fff', fontWeight: '700' },

  assigneeScroll: { maxHeight: 180, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#F9FAFB' },
  assigneeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  assigneeItemActive: { backgroundColor: '#EFF6FF' },
  assigneeName: { color: colors.text, fontWeight: '600', fontSize: 14 },
  assigneeEmail: { color: colors.mut, fontSize: 12, marginTop: 2 },
  assigneeSelf: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#F3F4F6', borderRadius: 12 },
});
