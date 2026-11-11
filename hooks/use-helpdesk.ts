'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Job } from '../lib/helpdesk';
export type Agent = { id: string; name: string; role: string; email?: string };
type Status = 'loading' | 'saved' | 'saving' | 'error' | 'conflict';
type Reply = {
  jobs: Job[];
  job?: Job;
  account: string;
  role: 'admin' | 'it' | 'employee';
  agents: Agent[];
  error?: string;
};
type Operation = {
  url: string;
  method: string;
  body: unknown;
  id?: number;
  kind: 'create' | 'patch';
};
export function useHelpdesk(initialRole: 'admin' | 'it' | 'employee' = 'employee') {
  const [jobs, J] = useState<Job[]>([]),
    [status, S] = useState<Status>('loading'),
    [error, E] = useState(''),
    [errorCode, C] = useState(0),
    [role, R] = useState(initialRole),
    [agents, A] = useState<Agent[]>([]),
    [loadedAt, L] = useState<Date | null>(null);
  const current = useRef<Job[]>([]),
    busy = useRef(false),
    statusRef = useRef(status),
    pending = useRef<Operation | null>(null);
  statusRef.current = status;
  const reload = useCallback(async () => {
    if (busy.current) return;
    S('loading');
    E('');
    C(0);
    try {
      const r = await fetch('/api/helpdesk', {
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
      });
      const data = (await r.json()) as Reply;
      if (r.status === 401) window.dispatchEvent(new Event('flowdesk-session-expired'));
      if (!r.ok) {
        E(data.error || '');
        C(r.status);
        S('error');
        return;
      }
      current.current = data.jobs;
      J(data.jobs);
      R(data.role);
      A(data.agents);
      pending.current = null;
      L(new Date());
      S('saved');
    } catch {
      E('');
      C(503);
      S('error');
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    if (!pending.current || !['saving', 'error', 'conflict'].includes(status)) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status]);
  const perform = useCallback(async (op: Operation): Promise<Job | null> => {
    if (busy.current) return null;
    busy.current = true;
    S('saving');
    E('');
    C(0);
    try {
      const r = await fetch(op.url, {
        method: op.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op.body),
        signal: AbortSignal.timeout(25000),
      });
      const result = (await r.json()) as Reply;
      if (r.status === 401) window.dispatchEvent(new Event('flowdesk-session-expired'));
      if (!r.ok || !result.job) {
        E(result.error || '');
        C(r.status);
        S(r.status === 409 ? 'conflict' : 'error');
        return null;
      }
      const job = result.job;
      current.current =
        op.kind === 'create'
          ? [job, ...current.current.filter((j) => j.id !== job.id)]
          : current.current.map((j) => (j.id === job.id ? job : j));
      J(current.current);
      pending.current = null;
      L(new Date());
      S('saved');
      return job;
    } catch {
      E('');
      C(503);
      S('error');
      return null;
    } finally {
      busy.current = false;
    }
  }, []);
  async function create(job: Job) {
    if (statusRef.current !== 'saved' || busy.current) return null;
    const op: Operation = {
      url: '/api/tickets',
      method: 'POST',
      body: { job, requestId: crypto.randomUUID() },
      kind: 'create',
    };
    pending.current = op;
    return perform(op);
  }
  async function mutate(id: number, patch: Partial<Job>, reason = '') {
    if (statusRef.current !== 'saved' || busy.current) return false;
    const job = current.current.find((j) => j.id === id);
    if (!job?.revision) return false;
    const op: Operation = {
      url: '/api/tickets/' + id,
      method: 'PATCH',
      body: { revision: job.revision, patch, reason: reason.slice(0, 500) },
      id,
      kind: 'patch',
    };
    pending.current = op;
    return Boolean(await perform(op));
  }
  async function attach(id: number, file: File): Promise<string | null> {
    if (busy.current) return 'กรุณารอให้การบันทึกก่อนหน้าเสร็จ';
    busy.current = true;
    S('saving');
    try {
      const upload = await prepareImage(file);
      const form = new FormData();
      form.append('file', upload, upload.name);
      const r = await fetch('/api/tickets/' + id + '/attachments', {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(60000),
      });
      const result = (await r.json()) as Reply;
      if (r.status === 401) window.dispatchEvent(new Event('flowdesk-session-expired'));
      if (!r.ok || !result.job) {
        S('saved');
        return result.error || 'อัปโหลดรูปไม่สำเร็จ';
      }
      const job = result.job;
      current.current = current.current.map((j) => (j.id === job.id ? job : j));
      J(current.current);
      L(new Date());
      S('saved');
      return null;
    } catch {
      S('saved');
      return 'อัปโหลดรูปไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
    } finally {
      busy.current = false;
    }
  }
  const retry = async () => (pending.current ? perform(pending.current) : (await reload(), null));
  return {
    jobs,
    create,
    mutate,
    attach,
    status,
    error,
    errorCode,
    role,
    agents,
    loadedAt,
    reload,
    retry,
    canEdit: status === 'saved',
    backup: () => ({ jobs: current.current, pending: pending.current?.body || null }),
  };
}

// Shrink large photos (common from phone cameras) so uploads stay under the 4 MB limit.
async function prepareImage(file: File): Promise<File> {
  const small = file.size <= 1.5 * 1024 * 1024;
  const supported = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type);
  if (small && supported) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.85));
    if (!blob) return file;
    const name = (file.name.replace(/\.[^.]+$/, '') || 'photo') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
