export type TaskPriority = 'низкий' | 'средний' | 'высокий';
export type TaskStatus = 'Новая' | 'В работе' | 'Пауза' | 'Завершена';
export type Attachment = { id: string; name: string; uri: string };
export type TaskType = 'common' | undefined;

export class Task {
  id: string;
  title: string;
  content?: string;
  createdAt: number;
  due: number;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId?: string;
  topic?: string;
  attachments?: Attachment[];
  type?: TaskType;
  teamId?: string | null;

  constructor(init: Partial<Task> & { title: string; due: number }) {
    this.id = init.id ?? Math.random().toString(36).slice(2);
    this.title = init.title;
    this.content = init.content;
    this.createdAt = init.createdAt ?? Date.now();
    this.due = init.due;
    this.priority = (init.priority ?? 'средний') as TaskPriority;
    this.status = (init.status ?? 'Новая') as TaskStatus;
    this.assigneeId = init.assigneeId;
    this.topic = init.topic;
    this.attachments = init.attachments ?? [];
    this.type = init.type;
    this.teamId = init.teamId ?? null;
  }
}
