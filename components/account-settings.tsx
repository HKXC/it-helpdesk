'use client';
import { useState, useRef, type FormEvent } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Languages,
  ShieldCheck,
  LockKeyhole,
  Eye,
  EyeOff,
  LogOut,
  PlayCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import type { WebAccount } from './account-gate';
import { useUi, roleLabel, type Theme } from './ui-provider';
import { Dialog } from './dialog';
import DemoSettings from './demo-settings';
export default function AccountSettings({
  user,
  role,
  onLogout,
  onReplay,
  safeToLeave,
}: {
  user: WebAccount;
  role: string;
  onLogout: () => Promise<void>;
  onReplay: () => void;
  safeToLeave: boolean;
}) {
  const { t, locale, theme, setLocale, setTheme, preferenceError, apiError } = useUi();
  const [show, S] = useState(false),
    [busy, B] = useState(false),
    [error, E] = useState<{ message?: string; status?: number } | null>(null),
    [success, SU] = useState(false),
    [confirm, C] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const data = new FormData(e.currentTarget);
    if (data.get('newPassword') !== data.get('confirmPassword')) {
      E({ message: t('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน', 'The new passwords do not match.') });
      return;
    }
    B(true);
    E(null);
    SU(false);
    try {
      const r = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: data.get('currentPassword'),
          newPassword: data.get('newPassword'),
          confirmPassword: data.get('confirmPassword'),
        }),
        signal: AbortSignal.timeout(20000),
      });
      const result = (await r.json()) as { error?: string };
      if (!r.ok) {
        E({ message: result.error, status: r.status });
        return;
      }
      form.current?.reset();
      S(false);
      SU(true);
    } catch {
      E({ status: 503 });
    } finally {
      B(false);
    }
  }
  async function logoutAll() {
    if (busy) return;
    B(true);
    E(null);
    try {
      const r = await fetch('/api/auth/logout-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(15000),
      });
      const result = (await r.json()) as { error?: string };
      if (!r.ok) {
        E({ message: result.error, status: r.status });
        return;
      }
      C(false);
      await onLogout();
    } catch {
      E({ status: 503 });
    } finally {
      B(false);
    }
  }
  return (
    <div className="settings-grid">
      <section className="panel settings-card">
        <div className="section-title">
          <h2>{t('บัญชีของคุณ', 'Your account')}</h2>
          <span className="role-label">{roleLabel(role, locale)}</span>
        </div>
        <dl className="account-info">
          <div>
            <dt>{t('ชื่อผู้ใช้', 'Name')}</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>{t('อีเมล', 'Email')}</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>{t('สิทธิ์ใช้งาน', 'Access')}</dt>
            <dd>
              {role === 'employee'
                ? t('แจ้งและติดตามคำร้องของตนเอง', 'Create and follow your own requests')
                : role === 'it'
                  ? t(
                      'ดูแลคิวงานร่วมและบันทึกการแก้ไข',
                      'Manage the shared queue and resolve requests',
                    )
                  : t('ดูแลคิวงาน ผู้ใช้ และบทบาท', 'Manage support work, users and roles')}
            </dd>
          </div>
        </dl>
        <div className="settings-help">
          <PlayCircle size={22} />
          <div>
            <h3>{t('ทบทวนการใช้งานเบื้องต้น', 'Review the basics')}</h3>
            <p>
              {t(
                'เปิดคำแนะนำสั้น ๆ เกี่ยวกับการแจ้งปัญหาและติดตามงาน',
                'Replay a short guide to requesting and following support.',
              )}
            </p>
            <button className="secondary" onClick={onReplay}>
              {t('เปิดคำแนะนำ', 'Replay introduction')}
            </button>
          </div>
        </div>
      </section>
      <section className="panel settings-card">
        <div className="section-title">
          <h2>{t('ภาษาและการแสดงผล', 'Language and appearance')}</h2>
        </div>
        <label className="field">
          {t('ภาษา', 'Language')}
          <div className="input-with-icon">
            <Languages size={20} />
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as 'th' | 'en')}
              aria-label={t('เลือกภาษา', 'Choose language')}
            >
              <option value="th">ไทย</option>
              <option value="en">English</option>
            </select>
          </div>
        </label>
        <h3 className="field-heading">{t('ธีมการแสดงผล', 'Display theme')}</h3>
        <div className="theme-options">
          {(
            [
              { id: 'light', icon: Sun, label: t('สว่าง', 'Light') },
              { id: 'dark', icon: Moon, label: t('มืด', 'Dark') },
              { id: 'system', icon: Monitor, label: t('ตามอุปกรณ์', 'System') },
            ] as { id: Theme; icon: typeof Sun; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              className={theme === item.id ? 'selected' : ''}
              aria-pressed={theme === item.id}
              onClick={() => setTheme(item.id)}
            >
              <item.icon size={24} />
              {item.label}
              {theme === item.id && <CheckCircle2 size={16} />}
            </button>
          ))}
        </div>
        <p className="field-help">
          {t(
            'บันทึกภาษาและธีมตามบัญชีของคุณ และรองรับการตั้งค่าลดการเคลื่อนไหวของอุปกรณ์',
            'Language and theme are saved to your account. Animations respect your device’s reduced-motion setting.',
          )}
        </p>
        {preferenceError && (
          <div className="notice warning" role="status">
            {preferenceError}
          </div>
        )}
      </section>
      <section className="panel settings-card security-card">
        <div className="section-title">
          <div>
            <h2>
              <LockKeyhole size={22} />
              {t('เปลี่ยนรหัสผ่าน', 'Change password')}
            </h2>
            <p>
              {t(
                'ต้องใช้รหัสผ่านเดิมของบัญชีนี้เพื่อยืนยันตัวตน',
                'Confirm your identity with this account’s current password.',
              )}
            </p>
          </div>
        </div>
        {success && (
          <div className="notice success" role="status">
            <CheckCircle2 size={20} />
            {t(
              'เปลี่ยนรหัสผ่านแล้ว อุปกรณ์อื่นต้องเข้าสู่ระบบใหม่',
              'Password changed. Other devices must sign in again.',
            )}
          </div>
        )}
        {error && !confirm && (
          <div className="notice error" role="alert">
            {apiError(error.message, error.status)}
          </div>
        )}
        <form ref={form} onSubmit={changePassword}>
          <div className="password-fields">
            <label className="field">
              {t('รหัสผ่านเดิม', 'Current password')}
              <input
                name="currentPassword"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                required
                maxLength={128}
                disabled={busy}
              />
            </label>
            <label className="field">
              {t('รหัสผ่านใหม่', 'New password')}
              <input
                name="newPassword"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                disabled={busy}
              />
              <small>{t('อย่างน้อย 12 ตัวอักษร', 'At least 12 characters')}</small>
            </label>
            <label className="field">
              {t('ยืนยันรหัสผ่านใหม่', 'Confirm new password')}
              <input
                name="confirmPassword"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                disabled={busy}
              />
            </label>
          </div>
          <div className="security-form-footer">
            <button className="text-button" type="button" onClick={() => S(!show)}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}{' '}
              {show ? t('ซ่อนรหัสผ่าน', 'Hide passwords') : t('แสดงรหัสผ่าน', 'Show passwords')}
            </button>
            <button className="primary" disabled={busy || !safeToLeave}>
              {busy ? <Loader2 className="spin" size={18} /> : <ShieldCheck size={18} />}{' '}
              {t('บันทึกรหัสผ่านใหม่', 'Save new password')}
            </button>
          </div>
        </form>
      </section>
      <section className="panel settings-card sessions-card">
        <div className="section-title">
          <h2>
            <LogOut size={22} />
            {t('การเข้าสู่ระบบ', 'Sign-in sessions')}
          </h2>
        </div>
        <p>
          {t(
            'หากใช้งานบนเครื่องที่ใช้ร่วมกัน หรือไม่แน่ใจว่ามีอุปกรณ์ใดเข้าสู่ระบบค้างอยู่ สามารถยกเลิกการเข้าใช้ทุกอุปกรณ์ได้',
            'If you use a shared computer or are unsure which devices remain signed in, revoke all account sessions.',
          )}
        </p>
        <button
          className="secondary danger-text"
          disabled={busy || !safeToLeave}
          onClick={() => {
            E(null);
            C(true);
          }}
        >
          <LogOut size={18} />
          {t('ออกจากระบบทุกอุปกรณ์', 'Sign out all devices')}
        </button>
        <small>{t('รวมถึงอุปกรณ์ที่กำลังใช้งานอยู่', 'This includes the current device.')}</small>
      </section>
      {role === 'admin' && <DemoSettings />}
      <Dialog
        open={confirm}
        onClose={() => {
          if (!busy) C(false);
        }}
        title={t('ออกจากระบบทุกอุปกรณ์?', 'Sign out all devices?')}
        className="confirm-dialog"
      >
        <div className="dialog-content">
          <p>
            {t(
              'ระบบจะยกเลิก session ทั้งหมดของบัญชีนี้ และกลับไปยังหน้าเข้าสู่ระบบ อุปกรณ์อื่นต้องเข้าสู่ระบบใหม่ด้วย',
              'All sessions for this account will be revoked, including this one. Every device will need to sign in again.',
            )}
          </p>
          {error && (
            <div className="notice error" role="alert">
              {apiError(error.message, error.status)}
            </div>
          )}
          <div className="dialog-actions">
            <button className="secondary" disabled={busy} onClick={() => C(false)}>
              {t('ยกเลิก', 'Cancel')}
            </button>
            <button className="primary" disabled={busy} onClick={() => logoutAll()}>
              {busy ? <Loader2 size={18} className="spin" /> : <LogOut size={18} />}{' '}
              {t('ยืนยันออกจากระบบ', 'Sign out everywhere')}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
