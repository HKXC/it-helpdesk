'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Send, ShieldCheck, Loader2, ImagePlus, X } from 'lucide-react';
import type { Job } from '../lib/helpdesk';
import type { WebAccount } from './account-gate';
import { useUi, categoryLabel, priorityLabel } from './ui-provider';
import { Dialog } from './dialog';
export function TicketForm({
  open,
  onClose,
  user,
  seed,
  onCreate,
  onAttach,
  onRetry,
  onDone,
  status,
  error,
}: {
  open: boolean;
  onClose: () => void;
  user: WebAccount;
  seed?: { key: number; title?: string; category?: string };
  onCreate: (job: Job) => Promise<Job | null>;
  onAttach: (id: number, file: File) => Promise<string | null>;
  onRetry: () => Promise<Job | null>;
  onDone: (job: Job, failedUploads: number) => void;
  status: string;
  error: string;
}) {
  const { t, locale } = useUi();
  const form = useRef<HTMLFormElement>(null);
  const [title, T] = useState(''),
    [category, C] = useState('อุปกรณ์'),
    [files, FL] = useState<File[]>([]),
    [uploading, UP] = useState(''),
    [uploadError, UE] = useState('');
  const saving = status === 'saving',
    pending = ['error', 'conflict'].includes(status);
  useEffect(() => {
    if (seed) {
      T(seed.title || '');
      C(seed.category || 'อุปกรณ์');
    }
  }, [seed?.key]);
  async function success(job: Job) {
    let failed = 0;
    for (const [i, file] of files.entries()) {
      UP(
        t(`กำลังอัปโหลดรูป ${i + 1}/${files.length}…`, `Uploading image ${i + 1}/${files.length}…`),
      );
      if (await onAttach(job.id, file)) failed++;
    }
    UP('');
    form.current?.reset();
    T('');
    C('อุปกรณ์');
    FL([]);
    UE('');
    onDone(job, failed);
  }
  function pick(list: FileList | null) {
    const chosen = Array.from(list || []).filter((f) => f.type.startsWith('image/'));
    const next = [...files, ...chosen].slice(0, 5);
    UE(
      chosen.length < (list?.length || 0)
        ? t('เลือกได้เฉพาะไฟล์รูปภาพ', 'Only image files can be attached.')
        : files.length + chosen.length > 5
          ? t('แนบได้สูงสุด 5 รูปตอนสร้างคำร้อง', 'Up to 5 images when creating a request.')
          : '',
    );
    FL(next);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || uploading) return;
    if (pending) {
      const job = await onRetry();
      if (job) success(job);
      return;
    }
    const data = new FormData(e.currentTarget);
    const job: Job = {
      id: 1,
      title: title.trim(),
      category: category as Job['category'],
      status: 'เปิดใหม่',
      priority: String(data.get('priority')) as Job['priority'],
      person: user.name,
      agent: 'ยังไม่มอบหมาย',
      detail: String(data.get('detail')).trim(),
      comments: [],
      department: String(data.get('department')).trim(),
      location: String(data.get('location')).trim(),
      asset: String(data.get('asset') || '').trim(),
      contact: String(data.get('contact')).trim(),
    };
    const result = await onCreate(job);
    if (result) success(result);
  }
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      title={t('แจ้งปัญหาใหม่', 'New support request')}
      className="request-dialog"
    >
      <form
        ref={form}
        onSubmit={submit}
        className="request-form"
        onInvalidCapture={(e) => {
          const el = e.target as HTMLInputElement | HTMLTextAreaElement;
          el.setCustomValidity(
            el.validity.valueMissing
              ? t('กรุณากรอกข้อมูลช่องนี้', 'Please fill in this field.')
              : '',
          );
        }}
        onInputCapture={(e) => (e.target as HTMLInputElement).setCustomValidity?.('')}
      >
        <p className="dialog-intro">
          {t(
            'ระบุอาการและข้อมูลที่จำเป็น ทีม IT จะติดตามเรื่องผ่านคำร้องนี้',
            'Describe the issue and provide the key details. IT will follow up in this request.',
          )}
        </p>
        {pending && (
          <div className="notice error" role="alert">
            {error ||
              t(
                'ส่งคำร้องไม่สำเร็จ ลองส่งอีกครั้งโดยไม่ต้องกรอกใหม่',
                'The request was not confirmed. Retry without entering the details again.',
              )}
          </div>
        )}
        <fieldset disabled={saving || pending || Boolean(uploading)} className="form-fields">
          <label className="field">
            <span>
              {t('หัวข้อปัญหา', 'Subject')}{' '}
              <span className="required-mark" aria-hidden="true">
                *
              </span>
            </span>
            <input
              required
              name="title"
              value={title}
              onChange={(e) => T(e.target.value)}
              maxLength={150}
              placeholder={t(
                'เช่น เครื่องพิมพ์ห้องบัญชีขึ้น Offline',
                'For example, Finance printer shows Offline',
              )}
            />
          </label>
          <div className="form-grid">
            <label className="field">
              {t('หมวดหมู่', 'Category')}
              <select name="category" value={category} onChange={(e) => C(e.target.value)}>
                {['อุปกรณ์', 'เครือข่าย', 'ซอฟต์แวร์', 'บัญชีและสิทธิ์', 'อื่น ๆ'].map((value) => (
                  <option key={value} value={value}>
                    {categoryLabel(value, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              {t('ความสำคัญ', 'Priority')}
              <select name="priority" defaultValue="ปกติ">
                {['ต่ำ', 'ปกติ', 'สูง', 'เร่งด่วน'].map((value) => (
                  <option key={value} value={value}>
                    {priorityLabel(value, locale)}
                  </option>
                ))}
              </select>
              <small>{t('เลือกตามผลกระทบต่อการทำงาน', 'Choose based on business impact.')}</small>
            </label>
          </div>
          <div className="form-section-title">
            <h3>{t('ข้อมูลผู้แจ้งและอุปกรณ์', 'Requester and device')}</h3>
            <p>
              {t(
                'ช่วยให้เจ้าหน้าที่ติดต่อและตรวจสอบได้ตรงจุด',
                'Help the agent reach you and identify the right device.',
              )}
            </p>
          </div>
          <label className="field">
            {t('ผู้แจ้ง', 'Requester')}
            <input value={user.name} readOnly aria-readonly="true" />
            <small>{user.email}</small>
          </label>
          <div className="form-grid">
            <label className="field">
              <span>
                {t('แผนก', 'Department')}{' '}
                <span className="required-mark" aria-hidden="true">
                  *
                </span>
              </span>
              <input
                required
                name="department"
                maxLength={80}
                placeholder={t('เช่น บัญชี', 'For example, Finance')}
              />
            </label>
            <label className="field">
              <span>
                {t('สถานที่', 'Location')}{' '}
                <span className="required-mark" aria-hidden="true">
                  *
                </span>
              </span>
              <input
                required
                name="location"
                maxLength={150}
                placeholder={t('อาคาร ชั้น หรือห้อง', 'Building, floor or room')}
              />
            </label>
            <label className="field">
              {t('รหัสอุปกรณ์ (ถ้ามี)', 'Asset ID (optional)')}
              <input name="asset" maxLength={80} placeholder="NB-024" />
            </label>
            <label className="field">
              <span>
                {t('ช่องทางติดต่อ', 'Contact')}{' '}
                <span className="required-mark" aria-hidden="true">
                  *
                </span>
              </span>
              <input
                required
                name="contact"
                maxLength={150}
                defaultValue={user.email}
                placeholder={t('อีเมลหรือเบอร์ต่อ', 'Email or extension')}
              />
            </label>
          </div>
          <label className="field">
            <span>
              {t('รายละเอียดและผลกระทบ', 'Description and impact')}{' '}
              <span className="required-mark" aria-hidden="true">
                *
              </span>
            </span>
            <textarea
              required
              name="detail"
              rows={5}
              maxLength={5000}
              placeholder={t(
                'กำลังทำอะไร พบอาการแบบใด เริ่มเมื่อไร กระทบใครบ้าง และลองแก้ไขอะไรแล้ว',
                'What were you doing, what happened, when did it start, who is affected and what have you tried?',
              )}
            />
          </label>
          <div className="field attach-field">
            <span>{t('แนบรูป (ถ้ามี)', 'Images (optional)')}</span>
            <label className="attach-picker">
              <ImagePlus size={20} />
              <span>
                {t('เลือกรูป หรือถ่ายภาพหน้าจอ/อาการ', 'Choose images or take a photo')}
                <small>
                  {t('สูงสุด 5 รูป · PNG, JPG, WEBP, GIF', 'Up to 5 · PNG, JPG, WEBP, GIF')}
                </small>
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  pick(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            {uploadError && <small className="field-error">{uploadError}</small>}
            {files.length > 0 && (
              <ul className="attach-chips">
                {files.map((f, i) => (
                  <li key={f.name + i}>
                    <span>{f.name}</span>
                    <button
                      type="button"
                      aria-label={t('เอารูปนี้ออก', 'Remove image') + ' ' + f.name}
                      onClick={() => FL(files.filter((_, j) => j !== i))}
                    >
                      <X size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </fieldset>
        <div className="form-privacy">
          <ShieldCheck size={19} />
          <p>
            {t(
              'ไม่ระบุรหัสผ่าน OTP หรือข้อมูลลับที่ไม่จำเป็นในคำร้อง',
              'Do not include passwords, OTPs or unnecessary confidential information.',
            )}
          </p>
        </div>
        <div className="dialog-actions">
          <button
            className="secondary"
            type="button"
            disabled={saving || Boolean(uploading)}
            onClick={onClose}
          >
            {t('ปิดไว้ก่อน', 'Close for now')}
          </button>
          <button
            className="primary"
            type="submit"
            disabled={saving || Boolean(uploading) || status === 'loading'}
          >
            {saving || uploading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}{' '}
            {uploading
              ? uploading
              : saving
                ? t('กำลังส่ง', 'Sending')
                : pending
                  ? t('ลองส่งอีกครั้ง', 'Retry request')
                  : t('ส่งคำร้อง', 'Submit request')}
          </button>
        </div>
        <p className="form-retention-note">
          {t(
            'ข้อมูลที่กรอกจะยังอยู่เมื่อปิดหน้าต่างนี้ และจะล้างเมื่อส่งสำเร็จ',
            'Closing this window keeps your entries on this page. They clear after a successful submission.',
          )}
        </p>
      </form>
    </Dialog>
  );
}
