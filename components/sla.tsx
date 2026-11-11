'use client';
import { Timer } from 'lucide-react';
import type { Job } from '../lib/helpdesk';
import { formatDuration, SLA_TARGETS, slaOf, type SlaClock, type SlaState } from '../lib/sla';
import { useUi } from './ui-provider';

export function useSlaLabels() {
  const { t } = useUi();
  return (state: SlaState) =>
    ({
      met: t('ทันเวลา', 'Met'),
      missed: t('ช้ากว่ากำหนด', 'Missed'),
      ok: t('อยู่ในเวลา', 'On track'),
      warning: t('ใกล้ครบกำหนด', 'Due soon'),
      breached: t('เกินกำหนด', 'Overdue'),
      paused: t('หยุดนับชั่วคราว', 'Paused'),
      na: t('ไม่นับ', 'N/A'),
    })[state];
}

// Small chip for lists: only shown when attention is needed.
export function SlaChip({ job }: { job: Job }) {
  const label = useSlaLabels();
  const s = slaOf(job);
  if (!s || !['breached', 'warning'].includes(s.overall)) return null;
  return (
    <span className={'sla-chip ' + s.overall}>
      <Timer size={13} />
      {label(s.overall)}
    </span>
  );
}

export function SlaPanel({ job }: { job: Job }) {
  const { t, locale } = useUi();
  const label = useSlaLabels();
  const s = slaOf(job);
  const target = SLA_TARGETS[job.priority];
  if (!s || !target) return null;
  const when = (ms: number) =>
    new Date(ms).toLocaleString(locale === 'th' ? 'th-TH' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Bangkok',
    });
  const row = (title: string, hours: number, c: SlaClock, doneText: string) => (
    <div className="sla-row">
      <div>
        <strong>{title}</strong>
        <small>
          {t('เป้าหมาย', 'Target')} {formatDuration(hours * 3600_000, locale)}
          {' · '}
          {c.doneAt !== null
            ? `${doneText} ${formatDuration(c.delta, locale)}`
            : c.state === 'na'
              ? t('คำร้องถูกยกเลิก', 'Request cancelled')
              : c.state === 'paused'
                ? `${t('รอข้อมูลจากผู้แจ้ง · หยุดไปแล้ว', 'Waiting for requester · paused')} ${formatDuration(c.paused, locale)}`
                : c.delta >= 0
                  ? `${t('เหลือ', 'left')} ${formatDuration(c.delta, locale)} (${when(c.due)})`
                  : `${t('เกินมา', 'overdue by')} ${formatDuration(c.delta, locale)}`}
        </small>
      </div>
      <span className={'sla-chip ' + c.state}>{label(c.state)}</span>
    </div>
  );
  return (
    <div className="sla-panel">
      <h3>
        <Timer size={17} /> SLA
      </h3>
      {row(
        t('ตอบกลับครั้งแรก', 'First response'),
        target.response,
        s.response,
        t('ใช้เวลา', 'took'),
      )}
      {row(t('แก้ไขให้เสร็จ', 'Resolution'), target.resolve, s.resolve, t('ใช้เวลา', 'took'))}
    </div>
  );
}
