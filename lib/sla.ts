// Service level targets per priority, in hours (calendar time, 24/7).
// Response = first action by IT (assign, status change, reply or resolution).
// Resolution = ticket marked "แก้ไขแล้ว" (resolved). The resolution clock pauses while
// the ticket is "รอข้อมูล" (waiting for the requester) and the deadline moves out by that time.
import type { Job } from './helpdesk';

export const SLA_TARGETS: Record<string, { response: number; resolve: number }> = {
  เร่งด่วน: { response: 1, resolve: 4 },
  สูง: { response: 4, resolve: 24 },
  ปกติ: { response: 8, resolve: 72 },
  ต่ำ: { response: 24, resolve: 120 },
};

export type SlaState = 'met' | 'missed' | 'ok' | 'warning' | 'breached' | 'paused' | 'na';
export type SlaClock = {
  state: SlaState;
  due: number;
  doneAt: number | null;
  /** ms remaining (negative when overdue); for finished clocks, ms taken. */
  delta: number;
  /** total ms paused while waiting for the requester */
  paused: number;
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

// Status implied by a history entry, or null if the entry does not change status.
function statusFromEvent(text: string): string | null {
  if (text.startsWith('รับเรื่องและเปลี่ยนสถานะเป็น ')) return 'กำลังดำเนินการ';
  if (text.startsWith('เปลี่ยนสถานะเป็น ')) return text.slice('เปลี่ยนสถานะเป็น '.length).trim();
  if (text.startsWith('แก้ไขแล้ว')) return 'แก้ไขแล้ว';
  if (text.startsWith('ยกเลิกคำร้อง')) return 'ยกเลิก';
  if (text.startsWith('เปิดงานซ้ำ')) return 'เปิดใหม่';
  if (text.startsWith('ผู้แจ้งยืนยันปิดงาน')) return 'ปิดงาน';
  return null;
}

// Total time spent in "รอข้อมูล" up to `until`, and whether it is waiting right now.
function pausedTime(job: Job, until: number) {
  let total = 0,
    since: number | null = null;
  for (const h of job.history || []) {
    const next = statusFromEvent(h.text),
      at = time(h.at);
    if (!next || at === null) continue;
    if (next === 'รอข้อมูล' && since === null) since = at;
    else if (next !== 'รอข้อมูล' && since !== null) {
      total += Math.max(0, Math.min(at, until) - since);
      since = null;
    }
  }
  // Seeded/legacy tickets may be waiting without a recorded status change.
  if (job.status === 'รอข้อมูล' && since === null)
    since = time(job.history?.at(-1)?.at) ?? time(job.updatedAt);
  const waiting = job.status === 'รอข้อมูล' && since !== null;
  if (since !== null && job.status === 'รอข้อมูล') total += Math.max(0, until - since);
  return { total, waiting };
}

function clock(
  start: number,
  hours: number,
  doneAt: number | null,
  open: boolean,
  now: number,
  pause = { total: 0, waiting: false },
): SlaClock {
  const paused = pause.total;
  const due = start + hours * HOUR + paused;
  if (doneAt !== null)
    return {
      state: doneAt <= due ? 'met' : 'missed',
      due,
      doneAt,
      delta: doneAt - start - paused,
      paused,
    };
  if (!open) return { state: 'na', due, doneAt: null, delta: 0, paused };
  const left = due - now;
  const state: SlaState = pause.waiting
    ? 'paused'
    : left < 0
      ? 'breached'
      : left < hours * HOUR * 0.25
        ? 'warning'
        : 'ok';
  return { state, due, doneAt: null, delta: left, paused };
}

const rank: Record<SlaState, number> = {
  breached: 6,
  missed: 5,
  warning: 4,
  ok: 3,
  paused: 2,
  met: 1,
  na: 0,
};

export function slaOf(job: Job, now = Date.now()): Sla | null {
  const start = time(job.createdAt);
  const target = SLA_TARGETS[job.priority];
  if (!start || !target) return null;
  const open = ACTIVE.includes(job.status);
  const resolved = resolvedAt(job);
  const responded = firstResponse(job) ?? resolved;
  const response = clock(start, target.response, responded, open, now);
  const resolve = clock(
    start,
    target.resolve,
    resolved,
    open,
    now,
    pausedTime(job, resolved ?? now),
  );
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
