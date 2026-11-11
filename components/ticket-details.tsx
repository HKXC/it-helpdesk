'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  RefreshCw,
  MessageSquare,
  Send,
  ShieldCheck,
  Clock,
  Star,
  UserRound,
  History,
  Loader2,
  ImagePlus,
} from 'lucide-react';
import type { Job } from '../lib/helpdesk';
import type { Agent } from '../hooks/use-helpdesk';
import type { WebAccount } from './account-gate';
import { Dialog } from './dialog';
import { useUi, statusLabel, categoryLabel, priorityLabel, historyLabel } from './ui-provider';
export function StatusBadge({ value }: { value: string }) {
  const { locale } = useUi();
  const tone =
    value === 'กำลังดำเนินการ'
      ? 'info'
      : value === 'รอข้อมูล'
        ? 'warning'
        : ['แก้ไขแล้ว', 'ปิดงาน'].includes(value)
          ? 'success'
          : value === 'ยกเลิก'
            ? 'muted'
            : 'neutral';
  return (
    <span className={'badge ' + tone}>
      <i />
      {statusLabel(value, locale)}
    </span>
  );
}
export function TicketDetails({
  job,
  open,
  onClose,
  user,
  role,
  agents,
  canEdit,
  saving,
  error,
  conflict,
  onUpdate,
  onAttach,
  onRefresh,
  onRetry,
}: {
  job?: Job;
  open: boolean;
  onClose: () => void;
  user: WebAccount;
  role: string;
  agents: Agent[];
  canEdit: boolean;
  saving: boolean;
  error: string;
  conflict: boolean;
  onUpdate: (id: number, patch: Partial<Job>, reason?: string) => Promise<boolean>;
  onAttach: (id: number, file: File) => Promise<string | null>;
  onRefresh: () => Promise<void>;
  onRetry: () => Promise<Job | null>;
}) {
  const { t, locale } = useUi();
  const [action, A] = useState<'resolve' | 'reopen' | 'cancel' | ''>(''),
    [reason, R] = useState(''),
    [reply, S] = useState(''),
    [rating, RT] = useState(5),
    [justSaved, JS] = useState(false),
    [uploadMsg, UM] = useState(''),
    [preview, PV] = useState<string | null>(null),
    wasSaving = useRef(false);
  useEffect(() => {
    A('');
    R('');
    S('');
    RT(5);
    JS(false);
  }, [job?.id]);
  useEffect(() => {
    if (saving) {
      wasSaving.current = true;
      JS(false);
      return;
    }
    if (!wasSaving.current) return;
    wasSaving.current = false;
    if (error) return;
    JS(true);
    const timer = setTimeout(() => JS(false), 2500);
    return () => clearTimeout(timer);
  }, [saving, error]);
  const staff = role === 'admin' || role === 'it',
    own = job?.requesterId === user.id,
    terminal = job ? ['แก้ไขแล้ว', 'ปิดงาน', 'ยกเลิก'].includes(job.status) : false;
  const date = (s?: string) =>
    s
      ? new Date(s).toLocaleString(locale === 'th' ? 'th-TH' : 'en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Bangkok',
        })
      : t('นำเข้าจากรุ่นก่อน', 'Imported from an earlier version');
  async function submitAction(e: FormEvent) {
    e.preventDefault();
    if (!job || !reason.trim()) return;
    const value = reason.trim();
    const patch: Partial<Job> =
      action === 'resolve'
        ? { status: 'แก้ไขแล้ว', resolution: value }
        : action === 'reopen'
          ? { status: 'เปิดใหม่' }
          : { status: 'ยกเลิก' };
    if (await onUpdate(job.id, patch, value)) {
      A('');
      R('');
    }
  }
  async function replyTo(e: FormEvent) {
    e.preventDefault();
    if (
      job &&
      reply.trim() &&
      (await onUpdate(job.id, { comments: [...job.comments, reply.trim()] }))
    )
      S('');
  }
  return (
    <Dialog
      open={open && Boolean(job)}
      onClose={() => {
        if (!saving) onClose();
      }}
      title={
        job ? 'IT-' + String(job.id).padStart(4, '0') : t('รายละเอียดคำร้อง', 'Request details')
      }
      drawer
      className="ticket-details-dialog"
    >
      {job && (
        <div className="ticket-details">
          <div className="ticket-details-heading">
            <StatusBadge value={job.status} />
            <h1>{job.title}</h1>
            <p>
              <UserRound size={17} />
              {job.person}
              <span aria-hidden="true"> · </span>
              {job.department || t('ไม่ระบุแผนก', 'Department not specified')}
            </p>
            <small>
              {t('สร้างเมื่อ', 'Created')} {date(job.createdAt)}
            </small>
          </div>
          {error && (
            <div className="notice error" role="alert">
              <div>
                <p>{error}</p>
                <div className="notice-actions">
                  {conflict ? (
                    <button className="secondary compact" onClick={() => onRefresh()}>
                      {t('โหลดข้อมูลล่าสุด', 'Refresh latest data')}
                    </button>
                  ) : (
                    <button
                      className="secondary compact"
                      disabled={saving}
                      onClick={async () => {
                        if (await onRetry()) {
                          A('');
                          R('');
                          S('');
                        }
                      }}
                    >
                      {t('ลองบันทึกอีกครั้ง', 'Retry save')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          <section className="detail-management">
            <div className="detail-management-heading">
              <h2>{t('การดำเนินงาน', 'Work management')}</h2>
              <span className="save-indicator" role="status" aria-live="polite">
                {saving ? (
                  <>
                    <Loader2 className="spin" size={15} /> {t('กำลังบันทึก…', 'Saving…')}
                  </>
                ) : justSaved ? (
                  <>
                    <CheckCircle2 size={15} /> {t('บันทึกแล้ว', 'Saved')}
                  </>
                ) : null}
              </span>
            </div>
            <div className="form-grid">
              {staff && !terminal ? (
                <label className="field">
                  {t('สถานะ', 'Status')}
                  <select
                    aria-label={t('สถานะคำร้อง', 'Request status')}
                    value={job.status}
                    disabled={!canEdit}
                    onChange={(e) => onUpdate(job.id, { status: e.target.value as Job['status'] })}
                  >
                    {['เปิดใหม่', 'กำลังดำเนินการ', 'รอข้อมูล'].map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s, locale)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="read-field">
                  <span>{t('สถานะปัจจุบัน', 'Current status')}</span>
                  <strong>{statusLabel(job.status, locale)}</strong>
                </div>
              )}
              {staff ? (
                <label className="field">
                  {t('ผู้รับผิดชอบ', 'Assignee')}
                  <select
                    aria-label={t('ผู้รับผิดชอบคำร้อง', 'Request assignee')}
                    value={job.assigneeId || ''}
                    disabled={!canEdit}
                    onChange={(e) => onUpdate(job.id, { assigneeId: e.target.value || null })}
                  >
                    <option value="">{t('ยังไม่มอบหมาย', 'Unassigned')}</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.id === user.id
                          ? agent.name + ' ' + t('(ฉัน)', '(me)')
                          : agent.email
                            ? agent.name + ' · ' + agent.email
                            : agent.name}
                      </option>
                    ))}
                    {job.assigneeId && !agents.some((a) => a.id === job.assigneeId) && (
                      <option value={job.assigneeId}>{job.agent}</option>
                    )}
                  </select>
                  {!terminal && job.assigneeId !== user.id && (
                    <button
                      type="button"
                      className="secondary compact claim-button"
                      disabled={!canEdit}
                      onClick={() => onUpdate(job.id, { assigneeId: user.id })}
                    >
                      <UserRound size={16} /> {t('รับงานนี้', 'Assign to me')}
                    </button>
                  )}
                </label>
              ) : (
                <div className="read-field">
                  <span>{t('ผู้รับผิดชอบ', 'Assignee')}</span>
                  <strong>{job.assigneeId ? job.agent : t('ยังไม่มอบหมาย', 'Unassigned')}</strong>
                </div>
              )}
            </div>
            <dl className="detail-facts">
              <div>
                <dt>{t('หมวดหมู่', 'Category')}</dt>
                <dd>{categoryLabel(job.category, locale)}</dd>
              </div>
              <div>
                <dt>{t('ความสำคัญ', 'Priority')}</dt>
                <dd>{priorityLabel(job.priority, locale)}</dd>
              </div>
              <div>
                <dt>{t('สถานที่', 'Location')}</dt>
                <dd>{job.location || '—'}</dd>
              </div>
              <div>
                <dt>{t('รหัสอุปกรณ์', 'Asset ID')}</dt>
                <dd>{job.asset || '—'}</dd>
              </div>
              <div className="wide">
                <dt>{t('ช่องทางติดต่อ', 'Contact')}</dt>
                <dd>{job.contact || '—'}</dd>
              </div>
            </dl>
          </section>
          {job.resolution && (
            <section className="resolution-box">
              <CheckCircle2 size={23} />
              <div>
                <h2>{t('วิธีแก้ไขล่าสุด', 'Latest resolution')}</h2>
                <p>{job.resolution}</p>
              </div>
            </section>
          )}
          {own && job.status === 'แก้ไขแล้ว' && (
            <form
              className="closure-box"
              onSubmit={async (e) => {
                e.preventDefault();
                await onUpdate(job.id, { status: 'ปิดงาน', rating });
              }}
            >
              <h2>{t('ทดสอบแล้ว ใช้งานได้ตามปกติหรือไม่?', 'Have you tested the result?')}</h2>
              <p>
                {t(
                  'หากปัญหาได้รับการแก้ไขแล้ว ให้คะแนนและยืนยันปิดงาน',
                  'If the issue is resolved, rate the service and confirm closure.',
                )}
              </p>
              <fieldset className="rating-options">
                <legend>{t('ความพึงพอใจ', 'Service rating')}</legend>
                {[1, 2, 3, 4, 5].map((value) => (
                  <label key={value} className={value <= rating ? 'selected' : ''}>
                    <input
                      type="radio"
                      name="rating"
                      value={value}
                      checked={rating === value}
                      onChange={() => RT(value)}
                      aria-label={value + ' / 5'}
                      disabled={!canEdit}
                    />
                    <Star size={25} fill={value <= rating ? 'currentColor' : 'none'} />
                  </label>
                ))}
                <span>{rating} / 5</span>
              </fieldset>
              <button className="primary" disabled={!canEdit}>
                <CheckCircle2 size={18} />
                {t('ยืนยันปิดงาน', 'Confirm closure')}
              </button>
            </form>
          )}
          <div className="workflow-actions" hidden={Boolean(action)}>
            {staff && !terminal && (
              <button
                className="primary"
                disabled={!canEdit}
                onClick={() => {
                  A('resolve');
                  R('');
                }}
              >
                <CheckCircle2 size={18} />
                {t('บันทึกวิธีแก้ไข', 'Record resolution')}
              </button>
            )}
            {own && !terminal && (
              <button
                className="secondary danger-text"
                disabled={!canEdit}
                onClick={() => {
                  A('cancel');
                  R('');
                }}
              >
                {t('ยกเลิกคำร้อง', 'Cancel request')}
              </button>
            )}
            {own && ['แก้ไขแล้ว', 'ปิดงาน'].includes(job.status) && (
              <button
                className="secondary"
                disabled={!canEdit}
                onClick={() => {
                  A('reopen');
                  R('');
                }}
              >
                <RefreshCw size={18} />
                {t('ยังมีปัญหา เปิดงานซ้ำ', 'Issue remains — reopen')}
              </button>
            )}
          </div>
          {action && (
            <form className="action-form" onSubmit={submitAction}>
              <h2>
                {action === 'resolve'
                  ? t('บันทึกผลการแก้ไข', 'Record the fix')
                  : action === 'reopen'
                    ? t('เหตุผลที่เปิดงานซ้ำ', 'Reason for reopening')
                    : t('เหตุผลที่ยกเลิก', 'Reason for cancellation')}
              </h2>
              <label className="field">
                {action === 'resolve'
                  ? t('วิธีแก้ไขและผลการทดสอบ', 'Resolution and verification')
                  : t('รายละเอียด', 'Details')}
                <textarea
                  autoFocus
                  required
                  rows={4}
                  maxLength={action === 'resolve' ? 3000 : 420}
                  value={reason}
                  onChange={(e) => R(e.target.value)}
                  disabled={!canEdit}
                  placeholder={
                    action === 'resolve'
                      ? t(
                          'แก้ไขอะไร ทดสอบอย่างไร และผู้ใช้ควรทำอะไรต่อ',
                          'Describe the fix, testing and next steps for the requester.',
                        )
                      : t(
                          'ระบุอาการหรือเหตุผลให้ชัดเจน',
                          'Describe the remaining symptoms or reason clearly.',
                        )
                  }
                />
              </label>
              <div className="dialog-actions">
                <button className="secondary" type="button" disabled={saving} onClick={() => A('')}>
                  {t('ย้อนกลับ', 'Back')}
                </button>
                <button className="primary" disabled={!canEdit || !reason.trim()}>
                  {saving ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}{' '}
                  {t('ยืนยัน', 'Confirm')}
                </button>
              </div>
            </form>
          )}
          <section className="detail-description">
            <h2>{t('รายละเอียดปัญหา', 'Issue description')}</h2>
            <p>{job.detail}</p>
          </section>
          <section className="detail-attachments">
            <div className="detail-attachments-head">
              <h2>
                {t('รูปที่แนบ', 'Images')}{' '}
                <span className="count-pill">{job.attachments?.length || 0}</span>
              </h2>
              {!['ปิดงาน', 'ยกเลิก'].includes(job.status) &&
                (job.attachments?.length || 0) < 10 && (
                  <label
                    className={'secondary compact attach-button' + (canEdit ? '' : ' disabled')}
                  >
                    <ImagePlus size={16} /> {t('แนบรูป', 'Add image')}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={!canEdit}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        UM(t('กำลังอัปโหลด…', 'Uploading…'));
                        const err = await onAttach(job.id, file);
                        UM(err || t('แนบรูปแล้ว', 'Image attached.'));
                        setTimeout(() => UM(''), 3000);
                      }}
                    />
                  </label>
                )}
            </div>
            {uploadMsg && (
              <p className="upload-status" role="status">
                {uploadMsg}
              </p>
            )}
            {job.attachments?.length ? (
              <ul className="attachment-grid">
                {job.attachments.map((a) => {
                  const src = `/api/tickets/${job.id}/attachments/${a.id}`;
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => PV(src)}
                        aria-label={t('ดูรูป', 'View image') + ' ' + a.name}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={a.name} loading="lazy" />
                      </button>
                      <small>
                        {a.by} · {date(a.at)}
                      </small>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted-text">{t('ยังไม่มีรูปที่แนบ', 'No images attached.')}</p>
            )}
          </section>
          {preview && (
            <div
              className="image-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label={t('รูปขนาดเต็ม', 'Full-size image')}
              onClick={() => PV(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" />
              <button type="button" className="icon-button" aria-label={t('ปิด', 'Close')}>
                ✕
              </button>
            </div>
          )}
          {job.rating && (
            <p className="rating-result">
              <Star size={18} />
              {t('คะแนนความพึงพอใจ', 'Service rating')}: {job.rating} / 5
            </p>
          )}
          <section className="conversation-section">
            <div className="section-title">
              <h2>
                <MessageSquare size={21} />
                {t('การสนทนา', 'Conversation')}
              </h2>
              <span className="count-badge">{job.comments.length}</span>
            </div>
            {job.comments.length ? (
              <div className="messages">
                {job.comments.map((comment, i) => (
                  <article className="message" key={i}>
                    <span className="message-icon">
                      <MessageSquare size={18} />
                    </span>
                    <div>
                      <p>{comment}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted empty-conversation">
                {t(
                  'ยังไม่มีข้อความ เพิ่มรายละเอียดหรือสอบถามทีม IT ได้ที่นี่',
                  'No messages yet. Add details or ask IT a question here.',
                )}
              </p>
            )}
            <form className="reply-form" onSubmit={replyTo}>
              <label className="field">
                {t('เพิ่มข้อความ', 'Add a message')}
                <textarea
                  value={reply}
                  onChange={(e) => S(e.target.value)}
                  required
                  rows={3}
                  maxLength={2000}
                  disabled={!canEdit || job.comments.length >= 300}
                  placeholder={t(
                    'อัปเดตอาการ ตอบคำถาม หรือสอบถามความคืบหน้า',
                    'Add symptoms, answer a question or ask for an update.',
                  )}
                />
              </label>
              <div className="reply-footer">
                <small>
                  {t('ไม่ส่งรหัสผ่านหรือ OTP ในการสนทนา', 'Do not share passwords or OTPs.')}
                </small>
                <button
                  className="primary"
                  disabled={!canEdit || !reply.trim() || job.comments.length >= 300}
                >
                  <Send size={18} />
                  {t('ส่งข้อความ', 'Send message')}
                </button>
              </div>
            </form>
          </section>
          <details className="ticket-activity">
            <summary>
              <History size={20} />
              {t('ประวัติการดำเนินการ', 'Activity history')}
              <span className="count-badge">{job.history?.length || 0}</span>
            </summary>
            {job.history?.length ? (
              <ol className="activity-list">
                {job.history
                  .slice()
                  .reverse()
                  .map((event, i) => (
                    <li key={i}>
                      <span className="activity-dot" />
                      <div>
                        <p>{historyLabel(event.text, locale)}</p>
                        <time>
                          {event.actor} · {date(event.at)}
                        </time>
                      </div>
                    </li>
                  ))}
              </ol>
            ) : (
              <p className="muted">
                {t('ไม่มีประวัติจากรุ่นก่อน', 'No earlier activity history is available.')}
              </p>
            )}
          </details>
          <div className="detail-updated">
            <Clock size={16} />
            {t('อัปเดตล่าสุด', 'Last updated')} {date(job.updatedAt)}
          </div>
        </div>
      )}
    </Dialog>
  );
}
