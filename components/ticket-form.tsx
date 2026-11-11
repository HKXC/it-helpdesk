'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Send, ShieldCheck, Loader2 } from 'lucide-react';
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
  onRetry: () => Promise<Job | null>;
  onDone: (job: Job) => void;
  status: string;
  error: string;
}) {
  const { t, locale } = useUi();
  const form = useRef<HTMLFormElement>(null);
  const [title, T] = useState(''),
    [category, C] = useState('อุปกรณ์');
  const saving = status === 'saving',
    pending = ['error', 'conflict'].includes(status);
  useEffect(() => {
    if (seed) {
      T(seed.title || '');
      C(seed.category || 'อุปกรณ์');
    }
  }, [seed?.key]);
  function success(job: Job) {
    form.current?.reset();
    T('');
    C('อุปกรณ์');
    onDone(job);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
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
        <fieldset disabled={saving || pending} className="form-fields">
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
          <button className="secondary" type="button" disabled={saving} onClick={onClose}>
            {t('ปิดไว้ก่อน', 'Close for now')}
          </button>
          <button className="primary" type="submit" disabled={saving || status === 'loading'}>
            {saving ? <Loader2 size={18} className="spin" /> : <Send size={18} />}{' '}
            {saving
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
