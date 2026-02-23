export type PeriodKind = 'Командировка' | 'Отпуск';

export class User {
  id: string;
  fullName: string;
  position: string;

  status: string; // «В офисе», «Удалённо», ...
  arrivedAt?: number;
  statusPeriod?: { kind: PeriodKind; from: number; to: number } | null;

  avatar?: string;
  links?: { telegram?: string; whatsapp?: string; email?: string; phone?: string };

  constructor(id: string, fullName: string, position: string, status: string, extra?: Partial<User>) {
    this.id = id;
    this.fullName = fullName;
    this.position = position;
    this.status = status;
    Object.assign(this, extra);
  }
}
