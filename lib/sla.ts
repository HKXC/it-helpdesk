// Service level targets per priority, in hours (calendar time, 24/7).
// Response = first action by IT (assign, status change, reply or resolution).
// Resolution = ticket marked "แก้ไขแล้ว" (resolved).
import type { Job } from './helpdesk';

export const SLA_TARGETS: Record<string, { response: number; resolve: number }> = {
  เร่งด่วน: { response: 1, resolve: 4 },
  สูง: { response: 4, resolve: 24 },
  ปกติ: { response: 8, resolve: 72 },
  ต่ำ: { response: 24, resolve: 120 },
};

export type SlaState = 'met' | 'missed' | 'ok' | 'warning' | 'breached' | 'na';
export type SlaClock = {
  state: SlaState;
  due: number;
  doneAt: number | null;
  /** ms remaining (negative when overdue); for finished clocks, ms taken. */
  delta: number;
};
export type Sla = { response: SlaClock; resolve: SlaClock; overall: SlaState };

const HOUR = 3600_000;
const ACTIVE = ['เปิดใหม่', 'กำลังดำเนินการ', 'รอข้อมูล'];

function time(s?: string | null) {
  const n = s ? Date.parse(s) : NaN;
  return Number.isFinite(n) ? n : null;
}

// Older tickets have no stored timestamps, so derive them from the history log.
function firstResponse(job: Job) {
  const stored = time(job.firstResponseAt);
  if (stored) return stored;
  const ev = job.history?.find(
    (h) =>
      h.actor !== job.person &&
      h.text !== 'สร้างคำร้อง' &&
      !h.text.startsWith('ยกเลิกคำร้อง') &&
      !h.text.startsWith('แนบรูป'),
  );
  return ev ? time(ev.at) : null;
}

function resolvedAt(job: Job) {
  if (!['แก้ไขแล้ว', 'ปิดงาน'].includes(job.status)) return null;
  const stored = time(job.resolvedAt);
  if (stored) return stored;
  const ev = [...(job.history || [])].reverse().find((h) => h.text.startsWith('แก้ไขแล้ว'));
  return (ev && time(ev.at)) || time(job.updatedAt);
}

function clock(start: number, hours: number, doneAt: number | null, open: boolean, now: number) {
  const due = start + hours * HOUR;
  if (doneAt !== null)
    return {
      state: doneAt <= due ? 'met' : 'missed',
      due,
      doneAt,
      delta: doneAt - start,
    } as SlaClock;
  if (!open) return { state: 'na', due, doneAt: null, delta: 0 } as SlaClock;
  const left = due - now;
  const state: SlaState = left < 0 ? 'breached' : left < hours * HOUR * 0.25 ? 'warning' : 'ok';
  return { state, due, doneAt: null, delta: left };
}

const rank: Record<SlaState, number> = { breached: 5, missed: 4, warning: 3, ok: 2, met: 1, na: 0 };

export function slaOf(job: Job, now = Date.now()): Sla | null {
  const start = time(job.createdAt);
  const target = SLA_TARGETS[job.priority];
  if (!start || !target) return null;
  const open = ACTIVE.includes(job.status);
  const resolved = resolvedAt(job);
  const responded = firstResponse(job) ?? resolved;
  const response = clock(start, target.response, responded, open, now);
  const resolve = clock(start, target.resolve, resolved, open, now);
  const overall = rank[response.state] >= rank[resolve.state] ? response.state : resolve.state;
  return { response, resolve, overall };
}

export const slaBreached = (job: Job) => {
  const s = slaOf(job);
  return Boolean(s && (s.response.state === 'breached' || s.resolve.state === 'breached'));
};

export function formatDuration(ms: number, locale: string) {
  const th = locale === 'th';
  const m = Math.max(1, Math.round(Math.abs(ms) / 60000));
  if (m < 60) return th ? `${m} นาที` : `${m} min`;
  const h = Math.floor(m / 60),
    rm = m % 60;
  if (h < 24) return th ? `${h} ชม.${rm ? ` ${rm} นาที` : ''}` : `${h} h${rm ? ` ${rm} min` : ''}`;
  const d = Math.floor(h / 24),
    rh = h % 24;
  return th ? `${d} วัน${rh ? ` ${rh} ชม.` : ''}` : `${d} d${rh ? ` ${rh} h` : ''}`;
}
