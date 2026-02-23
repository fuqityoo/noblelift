import { Task, TaskPriority, TaskStatus, Attachment } from '../models/Task';
import { api, API_URL } from '../lib/api';


const mapPriorityToRu = (code: string): TaskPriority => {
  switch (code) {
    case 'low': return 'низкий';
    case 'medium': return 'средний';
    case 'high':
    case 'urgent': return 'высокий';
    default: return 'средний';
  }
};
const mapPriorityFromRu = (p: TaskPriority): 'low'|'medium'|'high'|'urgent' => {
  if (p === 'низкий') return 'low';
  if (p === 'высокий') return 'high';
  return 'medium';
};

const mapStatusToRu = (code: string): TaskStatus => {
  switch (code) {
    case 'in_progress': return 'В работе';
    case 'pause': return 'Пауза';
    case 'done': return 'Завершена';
    default: return 'Новая';
  }
};
const mapStatusFromRu = (s: TaskStatus): 'new'|'in_progress'|'pause'|'done' => {
  switch (s) {
    case 'В работе': return 'in_progress';
    case 'Пауза': return 'pause';
    case 'Завершена': return 'done';
    default: return 'new';
  }
};

function toTask(t: any, forceCommon = false): Task {
  const dueRaw = t.dueDate ?? t.due;
  const dueMs = typeof dueRaw === 'number' ? dueRaw : (dueRaw ? new Date(dueRaw).getTime() : Date.now());
  return new Task({
    id: String(t.id),
    title: String(t.title ?? t.name ?? 'Без названия'),
    content: t.description ?? t.content ?? '',
    createdAt: t.createdAt != null ? (typeof t.createdAt === 'number' ? t.createdAt : new Date(t.createdAt).getTime()) : Date.now(),
    due: dueMs,
    priority: mapPriorityToRu(t.priorityCode ?? t.priority?.code ?? 'medium'),
    status: mapStatusToRu(t.statusCode ?? t.status?.code ?? 'new'),
    assigneeId: t.assigneeId != null ? String(t.assigneeId) : undefined,
    type: forceCommon ? 'common' : (t.type === 'common' ? 'common' : undefined),
  });
}

function extractItems(data: any): any[] {
  return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
}

export class TaskService {
  constructor(private getTasks: () => Task[], private setTasks: (tasks: Task[]) => void) {}
  private currentUserId?: string;
  private teamId: string | null = null;

  setTeam = (teamId?: string | null) => { this.teamId = teamId ?? null; };
  getTeam  = () => this.teamId;
  setCurrentUser = (id: string) => { this.currentUserId = id; };

  sync = async (userId: string) => {
    const uid = Number(userId);
    const canLoadMine = Number.isFinite(uid) && uid > 0;
    const mine = canLoadMine ? await api(`/tasks?assignee_id=${uid}&limit=200`) : null;
    const seen = new Set<string>();
    const list: Task[] = [];
    if (mine?.ok) {
      const data = await mine.json().catch(() => null);
      const items = extractItems(data);
      items.forEach(t => {
        const id = String(t.id);
        if (!seen.has(id)) { seen.add(id); list.push(toTask(t)); }
      });
    }
    if (list.length > 0 || mine?.ok) {
      this.setTasks(list);
    }
  };

  syncAvailable = async () => {
    const r = await api(`/tasks?limit=200`);
    if (!r.ok) return;
    const data = await r.json().catch(() => null);
    const items = extractItems(data);
    const seen = new Set<string>();
    const current = this.getTasks();
    const list: Task[] = [];
    current.forEach(t => {
      const id = String(t.id);
      if (!seen.has(id)) { seen.add(id); list.push(t); }
    });
    items.forEach(t => {
      const id = String(t.id);
      if (!seen.has(id)) { seen.add(id); list.push(toTask(t)); }
    });
    this.setTasks(list);
  };

  setStatus = async (id: string, status: TaskStatus) => {
    const r = await api(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ statusCode: mapStatusFromRu(status) }) });
    if (!r.ok) throw new Error('set status failed');
    await this.sync(this.currentUserId || '');
  };

  setAssignee = async (id: string, assigneeId: string | null) => {
    const r = await api(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ assigneeId: assigneeId != null ? Number(assigneeId) : null }) });
    if (!r.ok) throw new Error('set assignee failed');
    await this.sync(this.currentUserId || '');
  };

  create = async (payload: Partial<Task>) => {
    const dto: any = {
      title: payload.title,
      content: payload.content,
      topicId: null,
      type: payload.type ?? 'regular',
      isPrivate: payload.type !== 'common',
      assigneeId: payload.type !== 'common' ? Number(this.currentUserId) : undefined,
    };
    const r = await api(`/tasks`, { method: 'POST', body: JSON.stringify(dto) });
    if (!r.ok) throw new Error('create failed');
    await this.sync(this.currentUserId || '');
  };

  createCommon = async (payload: Partial<Task>) => {
    await this.create({ ...payload, type: 'common' });
  };

  takeCommon = async (id: string) => {
    const r = await api(`/tasks/${id}/take`, { method: 'POST' });
    if (!r.ok) throw new Error('take task failed');
    await this.sync(this.currentUserId || '');
  };

  returnCommon = async (id: string) => {
    const r = await api(`/tasks/${id}/release`, { method: 'POST' });
    if (!r.ok) throw new Error('release task failed');
    await this.sync(this.currentUserId || '');
  };

  addAttachment = async (taskId: string, file: File | { uri: string; fileName: string }) => {
    let r: Response;
    if (typeof File !== 'undefined' && file instanceof File) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('fileName', (file as any).name);
      r = await fetch(`${API_URL}/tasks/${taskId}/files`, { method: 'POST', body: fd });
    } else {
      const body = { uri: (file as any).uri, fileName: (file as any).fileName };
      r = await api(`/tasks/${taskId}/files`, { method: 'POST', body: JSON.stringify(body) });
    }
    if (!r.ok) throw new Error('attachment failed');
  };

  deleteAttachment = async (taskId: string, attachmentId: string) => {
    const r = await api(`/tasks/${taskId}/files/${attachmentId}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('delete attachment failed');
  };

  filterByStatus = (status?: TaskStatus) => this.getTasks().filter(t => (status ? t.status === status : true));
  filterByPriority = (priority?: TaskPriority) => this.getTasks().filter(t => (priority ? t.priority === priority : true));
}
