import { api } from '../lib/api';

export async function listTaskTopics(): Promise<Array<{ id:number; name:string }>> {
  const res = await api('/task-topics');
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
}

export async function deleteTaskTopic(id: number): Promise<void> {
  const res = await api(`/task-topics/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(String(res.status));
}
