import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { colors, spacing } from '../ui/theme';
import { formatTaskDate, getStatusCode, STATUS_CODE_TO_RU, PRIORITY_CODE_TO_RU } from '../lib/utils';
import { api, API_URL, getAccessToken } from '../lib/api';
import Badge from './Badge';
import Button from './Button';

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, '');
  const p = path.replace(/^\/+/, '');
  return `${b}/${p}`;
}

const DESC_LINE_HEIGHT = 20;
const DESC_LINES = 3;
const COLLAPSED_HEIGHT = DESC_LINE_HEIGHT * DESC_LINES;
const CARD_MAX_HEIGHT_COLLAPSED = 220;

type TaskLike = {
  id: string;
  title?: string;
  content?: string;
  due?: number;
  dueDate?: number;
  statusCode?: string;
  status?: string;
  priorityCode?: string;
  priority?: string;
  topicId?: number;
  topic?: { id?: number; name?: string };
  attachments?: Array<{ id?: string | number; url?: string; name?: string; fileName?: string; size?: number }>;
};

type StatusOption = { code: string; label: string };

type Props = {
  task: TaskLike;
  variant: 'my' | 'available' | 'archive';
  isExpanded: boolean;
  onToggleExpand: () => void;
  isBusy: boolean;
  onAction: () => void;
  onStatusChange?: (code: string) => void;
  statusOptions?: StatusOption[];
  onDelete?: () => void;
  showDelete?: boolean;
};

export default React.memo(function TaskCard({
  task,
  variant,
  isExpanded,
  onToggleExpand,
  isBusy,
  onAction,
  onStatusChange,
  statusOptions = [],
  onDelete,
  showDelete,
}: Props) {
  const [statusModal, setStatusModal] = useState(false);
  const [contentModalVisible, setContentModalVisible] = useState(false);
  const [modalFiles, setModalFiles] = useState<Array<{ id: number; originalName: string; size: number }>>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [cachedFileCount, setCachedFileCount] = useState<number | null>(null);
  const taskId = task.id != null ? String(task.id) : '';
  useEffect(() => {
    if (!contentModalVisible || !taskId) return;
    setLoadingFiles(true);
    api(`/tasks/${taskId}/files`)
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((data: any) => {
        const items = data?.items ?? [];
        const list = items.map((f: any) => ({
          id: f.id,
          originalName: f.originalName ?? f.original_name ?? 'Файл',
          size: f.size ?? 0,
        }));
        setModalFiles(list);
        setCachedFileCount(list.length);
      })
      .catch(() => { setModalFiles([]); setCachedFileCount(0); })
      .finally(() => setLoadingFiles(false));
  }, [contentModalVisible, taskId]);
  const desc = String(task.content ?? '').trim();
  const hasDesc = !!desc;
  const code = getStatusCode(task);
  const statusText = STATUS_CODE_TO_RU[code] ?? (task.status ?? code) ?? '—';
  const dueText = formatTaskDate(task.due ?? task.dueDate ?? null);
  const priorityText = PRIORITY_CODE_TO_RU[String(task.priorityCode ?? task.priority ?? '').toLowerCase()] ?? (task.priority ?? '—');
  const topicName = task.topic?.name ?? (task as any).topicName ?? null;
  const fileCount = cachedFileCount ?? task.attachments?.length ?? 0;
  const handleDownloadFile = async (fileId: number) => {
    const token = getAccessToken();
    const url = joinUrl(API_URL, `/tasks/${taskId}/files/${fileId}`);
    try {
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) return;
      const blob = await res.blob();
      const file = modalFiles.find((f) => f.id === fileId);
      const name = file?.originalName ?? 'download';
      if (typeof URL !== 'undefined') {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = name;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
    } catch {}
  };
  const showDone = variant === 'my' && code !== 'done';
  const actionLabel = variant === 'my' ? (showDone ? (isBusy ? '...' : 'Готово') : '') : (isBusy ? '...' : 'Взять');

  return (
    <View style={[styles.card, styles.cardCollapsed]}>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={2}>{task.title}</Text>
        {showDelete && onDelete && (
          <Pressable onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
            <Text style={styles.deleteBtnText}>Удалить</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.badgesRow}>
        {(variant === 'my' || variant === 'archive') && (
          statusOptions && statusOptions.length > 0 ? (
            <Pressable onPress={() => setStatusModal(true)}>
              <Badge label={`Статус: ${statusText}`} />
            </Pressable>
          ) : (
            <Badge label={`Статус: ${statusText}`} />
          )
        )}
        {variant === 'available' && <Badge label={`Статус: ${statusText}`} />}
        {topicName ? <Badge label={topicName} tone="slate" /> : null}
        <Badge label={`Срок: ${dueText}`} tone="blue" />
        <Badge label={`Приоритет: ${priorityText}`} tone="amber" />
      </View>

      <View style={styles.descWrap}>
        {hasDesc ? (
          <Text
            style={[styles.desc, styles.descCollapsed]}
            numberOfLines={DESC_LINES}
          >
            {desc}
          </Text>
        ) : (
          <Text style={styles.descMuted}>Нет описания</Text>
        )}
        {(cachedFileCount !== null || (task.attachments?.length ?? 0) > 0) && (
          <Text style={styles.fileCountLabel}>Содержит файлов: {fileCount}</Text>
        )}
        <Pressable onPress={() => setContentModalVisible(true)} hitSlop={8} style={styles.expandBtn}>
          <Text style={styles.expandText}>Развернуть</Text>
        </Pressable>
      </View>

      <View style={styles.actionsRow}>
        {(variant === 'available' || showDone) && (
          <Button title={actionLabel} onPress={onAction} disabled={isBusy} />
        )}
      </View>

      {statusModal && statusOptions.length > 0 && (
        <Modal visible transparent animationType="fade">
          <Pressable style={styles.modalBackdrop} onPress={() => setStatusModal(false)}>
            <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>Изменить статус</Text>
              {statusOptions.map((opt) => (
                <Pressable
                  key={opt.code}
                  style={[styles.statusOption, opt.code === code && styles.statusOptionActive]}
                  onPress={() => {
                    onStatusChange?.(opt.code);
                    setStatusModal(false);
                  }}
                >
                  <Text style={styles.statusOptionText}>{opt.label}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.modalCancel} onPress={() => setStatusModal(false)}>
                <Text style={styles.modalCancelText}>Отмена</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}

      <Modal visible={contentModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setContentModalVisible(false)}>
          <View style={styles.contentModalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{task.title}</Text>
            {hasDesc && (
              <ScrollView style={styles.contentModalBody} nestedScrollEnabled>
                <Text style={styles.contentModalDesc}>{desc}</Text>
              </ScrollView>
            )}
            {(loadingFiles || modalFiles.length > 0) && (
              <View style={styles.attachWrap}>
                <Text style={styles.attachLabel}>{loadingFiles ? 'Загрузка файлов…' : `Файлы (${modalFiles.length}):`}</Text>
                {modalFiles.map((a) => (
                  <Pressable key={a.id} onPress={() => handleDownloadFile(a.id)} style={styles.attachItem}>
                    <Text style={styles.attachName} numberOfLines={1}>{a.originalName}</Text>
                    {a.size > 0 && <Text style={styles.attachSize}>{(a.size / 1024).toFixed(0)} КБ</Text>}
                  </Pressable>
                ))}
              </View>
            )}
            <Pressable style={styles.modalCancel} onPress={() => setContentModalVisible(false)}>
              <Text style={styles.modalCancelText}>Закрыть</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing(3),
    minHeight: 100,
  },
  cardCollapsed: { maxHeight: CARD_MAX_HEIGHT_COLLAPSED, overflow: 'hidden' as const },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, color: colors.text, fontWeight: '700', minWidth: 0 },
  deleteBtn: {
    width: 72,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  deleteBtnText: { color: '#111827', fontWeight: '600', fontSize: 13 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing(1) },
  descWrap: { marginTop: spacing(1) },
  desc: { color: colors.mut, lineHeight: DESC_LINE_HEIGHT, marginTop: 2 },
  descCollapsed: { maxHeight: COLLAPSED_HEIGHT, overflow: 'hidden' as const },
  descMuted: { color: colors.mut, fontSize: 13, fontStyle: 'italic', marginTop: 2 },
  fileCountLabel: { color: colors.mut, fontSize: 12, marginTop: 4 },
  expandBtn: { marginTop: spacing(1) },
  expandText: { color: '#2563EB', fontSize: 13, fontWeight: '600' },
  attachWrap: { marginTop: spacing(1) },
  attachLabel: { color: colors.mut, fontSize: 12, marginBottom: spacing(1) },
  attachItem: {
    borderWidth: 1,
    borderColor: '#eef2f7',
    backgroundColor: '#f9fafb',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: spacing(1),
  },
  attachName: { color: colors.text },
  attachSize: { color: colors.mut, fontSize: 12 },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing(2) },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  statusOption: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, marginBottom: 4 },
  statusOptionActive: { backgroundColor: '#EFF6FF' },
  statusOptionText: { fontSize: 15, color: colors.text },
  modalCancel: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
  modalCancelText: { color: colors.mut, fontSize: 14 },
  contentModalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, maxHeight: '80%', width: '100%', maxWidth: 400 },
  contentModalBody: { maxHeight: 200, marginVertical: 8 },
  contentModalDesc: { color: colors.text, lineHeight: 22, fontSize: 14 },
});
