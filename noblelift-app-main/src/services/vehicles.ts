import { api } from '../lib/api';

export async function listVehicles(): Promise<any[]> {
  const res = await api('/vehicles');
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
}

export async function createVehicle(dto: any) {
  const res = await api('/vehicles', { method: 'POST', body: JSON.stringify(dto) });
  if (!res.ok) throw new Error(String(res.status));
  return res.json().catch(() => undefined);
}
