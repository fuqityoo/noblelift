import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { api, getJSON, postJSON, postVoid } from '../lib/api';
import Button from '../components/Button';

const isWeb = Platform.OS === 'web';

// ===== Типы =====
type Vehicle = {
  id: number;
  brand?: string;           // марка
  model?: string;           // модель
  color?: string;
  number?: string;          // госномер
  status?: 'in_use' | string;
  holderId?: number | null; // id текущего держателя
};

type VehiclesResponse = Vehicle[] | { items: Vehicle[] };
type MeResponse = { userId: number };
type User = { id: number; fullName?: string; title?: string; role?: { code?: string; name?: string } };

function formatRuPlate(raw?: string | null): string {
  if (!raw) return '—';
  const s = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  const m = s.match(/^(.+?)(\d{2,3})$/);
  return m ? `${m[1]} ${m[2]}` : s;
}
function cap(s?: string | null) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ===== Карточка =====
function VehicleCard({
  v,
  isMine,
  holderName,
  canManage,
  onTake,
  onReturn,
  onDelete,
}: {
  v: Vehicle;
  isMine: boolean;
  holderName?: string;
  canManage: boolean;
  onTake: (id: number) => void;
  onReturn: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const title = useMemo(() => `${cap(v.brand)} ${v.model ?? ''}`.trim() || '—', [v.brand, v.model]);
  const plate = useMemo(() => formatRuPlate(v.number), [v.number]);

  const isBusy = v.status === 'in_use';
  const statusText = isMine ? 'На руках у вас' : isBusy ? `Занята ${holderName ?? '—'}` : 'Свободна';

  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>Цвет: {v.color ?? '—'}</Text>
        <Text style={styles.meta}>Госномер: {plate}</Text>
        <Text style={[styles.meta, isMine ? styles.statusMine : isBusy ? styles.statusBusy : styles.statusFree]}>
          {statusText}
        </Text>
      </View>

      <View style={styles.actionsCol}>
        {!isBusy && <Button title="Взять" onPress={() => onTake(v.id)} />}
        {isMine && <Button title="Вернуть" kind="ghost" onPress={() => onReturn(v.id)} />}
        {canManage && (
          <Pressable
            onPress={() => {
              const msg = 'Вы уверены, что хотите удалить эту машину?';
              if (isWeb) {
                if (typeof window !== 'undefined' && window.confirm(msg)) onDelete(v.id);
              } else {
                Alert.alert('Удалить машину', msg, [
                  { text: 'Отмена', style: 'cancel' },
                  { text: 'Удалить', style: 'destructive', onPress: () => onDelete(v.id) },
                ]);
              }
            }}
            style={styles.deleteBtn}
          >
            <Text style={styles.deleteBtnText}>Удалить</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ===== Экран =====
export default function VehicleScreen() {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [meId, setMeId] = useState<number | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [holders, setHolders] = useState<Map<number, string>>(new Map());

  // форма добавления
  const [brandNew, setBrandNew] = useState('');
  const [modelNew, setModelNew] = useState('');
  const [colorNew, setColorNew] = useState('');
  const [numberNew, setNumberNew] = useState('');
  const [creating, setCreating] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const me = await getJSON<MeResponse>('/profiles/me');
      setMeId(me.userId);

      // узнаём роль
      const meUser = await getJSON<User>(`/users/${me.userId}`);
      const roleCode = meUser?.role?.code || '';
      setIsSuperAdmin(roleCode === 'super_admin');

      const raw = await getJSON<VehiclesResponse>('/vehicles');
      const list = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.items) ? (raw as any).items : [];
      setVehicles(list);

      // Подтягиваем имена держателей
      const ids = Array.from(new Set(list.map(v => v.holderId).filter(Boolean))) as number[];
      if (ids.length) {
        const users = await Promise.all(ids.map(id => getJSON<User>(`/users/${id}`)));
        const map = new Map<number, string>();
        users.forEach(u => map.set(u.id, u.fullName || u.title || `user#${u.id}`));
        setHolders(map);
      } else {
        setHolders(new Map());
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось загрузить автопарк');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleTake(id: number) {
    setBusyId(id);
    try {
      await postVoid(`/vehicles/${id}/take`);     // без body
      await loadAll();
    } catch (e: any) {
      Alert.alert('Не удалось взять машину', e?.message || '');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReturn(id: number) {
    setBusyId(id);
    try {
      await postVoid(`/vehicles/${id}/release`);  // если у бэка /return — замени здесь
      await loadAll();
    } catch (e: any) {
      Alert.alert('Не удалось отдать машину', e?.message || '');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: number) {
    setBusyId(id);
    try {
      const r = await api(`/vehicles/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        throw new Error(txt || `Ошибка ${r.status}`);
      }
      await loadAll();
    } catch (e: any) {
      Alert.alert('Не удалось удалить машину', e?.message || '');
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreate() {
    if (!brandNew.trim() || !modelNew.trim() || !numberNew.trim()) {
      Alert.alert('Заполните поля', 'Марка, модель и номер обязательны.');
      return;
    }
    setCreating(true);
    try {
      // нормализуем номер (без лишних пробелов), бэк всё равно может привести сам
      const body = {
        brand: brandNew.trim(),
        model: modelNew.trim(),
        color: colorNew.trim() || null,
        number: numberNew.trim(),
      };
      await postJSON<Vehicle>('/vehicles', body);
      setBrandNew(''); setModelNew(''); setColorNew(''); setNumberNew('');
      await loadAll();
    } catch (e: any) {
      Alert.alert('Не удалось создать машину', e?.message || '');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Загрузка автопарка…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isSuperAdmin && (
        <View style={styles.createCard}>
          <Text style={styles.createTitle}>Новая машина</Text>
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Марка</Text>
              <TextInput style={styles.input} value={brandNew} onChangeText={setBrandNew} placeholder="Toyota" placeholderTextColor="#6b7280" />
            </View>
            <View style={[styles.field, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Модель</Text>
              <TextInput style={styles.input} value={modelNew} onChangeText={setModelNew} placeholder="Camry" placeholderTextColor="#6b7280" />
            </View>
          </View>
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Цвет</Text>
              <TextInput style={styles.input} value={colorNew} onChangeText={setColorNew} placeholder="Белый" placeholderTextColor="#6b7280" />
            </View>
            <View style={[styles.field, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Госномер</Text>
              <TextInput style={styles.input} value={numberNew} onChangeText={setNumberNew} placeholder="А123ВС77" placeholderTextColor="#6b7280" autoCapitalize="characters" />
            </View>
          </View>
          <View style={styles.rowRight}>
            <Button title={creating ? '...' : 'Добавить'} onPress={handleCreate} disabled={creating} />
          </View>
        </View>
      )}

      <FlatList
        data={vehicles}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={vehicles.length ? styles.listContent : styles.emptyWrap}
        ListEmptyComponent={<Text style={styles.muted}>Пока нет машин</Text>}
        renderItem={({ item }) => {
          const isMine = !!meId && item.status === 'in_use' && item.holderId === meId;
          return (
            <View style={[busyId === item.id ? styles.cardDimmed : null]}>
              <VehicleCard
                v={item}
                isMine={isMine}
                holderName={item.holderId ? holders.get(item.holderId) : undefined}
                canManage={isSuperAdmin}
                onTake={handleTake}
                onReturn={handleReturn}
                onDelete={handleDelete}
              />
            </View>
          );
        }}
      />
    </View>
  );
}

// ===== Стили =====
const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 32 },
  emptyWrap: { padding: 16, alignItems: 'center', flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: '#6b7280', marginTop: 8 },

  // карточка
  card: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardDimmed: { opacity: 0.6 },
  title: { fontSize: 18, fontWeight: '700' },
  meta: { marginTop: 6, color: '#374151' },

  statusFree: { color: '#059669' },
  statusBusy: { color: '#b45309' },
  statusMine: { color: '#111827', fontWeight: '700' },

  actionsCol: { justifyContent: 'center', alignItems: 'flex-end', marginLeft: 12, gap: 8 },

  deleteBtn: {
    width: 72,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  deleteBtnText: { color: '#111827', fontWeight: '600', fontSize: 13 },

  // строковые layout'ы
  row: { flexDirection: 'row' },
  rowRight: { flexDirection: 'row', justifyContent: 'flex-end' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // форма создания
  createCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  createTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  field: { marginBottom: 8 },
  label: { color: '#374151', marginBottom: 6, fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, backgroundColor: 'white', minHeight: 44 },
});
