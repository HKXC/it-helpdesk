'use client';
import { useEffect, useState } from 'react';
import { FlaskConical, Loader2, AlertTriangle } from 'lucide-react';
import { useUi } from './ui-provider';
import { Dialog } from './dialog';

type Info = {
  demoEnabled: boolean;
  demoAccounts: number;
  demoTickets: number;
  actorIsDemo: boolean;
};

// Admin-only card to switch demo data (accounts @demo.test and their tickets) on or off.
export default function DemoSettings() {
  const { t } = useUi();
  const [info, I] = useState<Info | null>(null),
    [error, E] = useState(''),
    [busy, B] = useState(false),
    [confirm, C] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings', { cache: 'no-store' })
      .then(async (r) => {
        const data = await r.json();
        if (r.ok) I(data);
        else E(data.error || t('โหลดการตั้งค่าไม่สำเร็จ', 'Could not load settings.'));
      })
      .catch(() => E(t('โหลดการตั้งค่าไม่สำเร็จ', 'Could not load settings.')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(demoEnabled: boolean) {
    B(true);
    E('');
    try {
      const r = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoEnabled }),
      });
      const data = await r.json();
      if (!r.ok) {
        E(data.error || t('บันทึกไม่สำเร็จ', 'Could not save.'));
        return;
      }
      I(data);
      C(false);
      // Reload so the queue, reports and user list reflect the new mode.
      window.location.reload();
    } catch {
      E(t('บันทึกไม่สำเร็จ กรุณาลองใหม่', 'Could not save. Please try again.'));
    } finally {
      B(false);
    }
  }

  return (
    <section className="panel settings-card demo-card">
      <div className="demo-card-head">
        <span className="topic-icon">
          <FlaskConical size={22} />
        </span>
        <div>
          <h2>{t('ข้อมูลจำลอง (เดโม)', 'Demo data')}</h2>
          <p>
            {t(
              'บัญชีที่ลงท้าย @demo.test และคำร้องของบัญชีเหล่านั้น ใช้สำหรับนำเสนอหรือทดลองระบบ',
              'Accounts ending in @demo.test and their requests, used for presentations and trials.',
            )}
          </p>
        </div>
      </div>
      {!info && !error && (
        <p className="muted-text">
          <Loader2 className="spin" size={16} /> {t('กำลังโหลด…', 'Loading…')}
        </p>
      )}
      {info && (
        <>
          <div className="demo-switch-row">
            <div>
              <strong>
                {info.demoEnabled
                  ? t('กำลังแสดงข้อมูลจำลอง', 'Demo data is ON')
                  : t('ปิดข้อมูลจำลองแล้ว — ใช้งานจริง', 'Demo data is OFF — live use')}
              </strong>
              <small>
                {t(
                  `บัญชีจำลอง ${info.demoAccounts} บัญชี · คำร้องจำลอง ${info.demoTickets} รายการ`,
                  `${info.demoAccounts} demo accounts · ${info.demoTickets} demo requests`,
                )}
              </small>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={info.demoEnabled}
              aria-label={t('เปิดหรือปิดข้อมูลจำลอง', 'Toggle demo data')}
              className={'switch' + (info.demoEnabled ? ' on' : '')}
              disabled={busy}
              onClick={() => (info.demoEnabled ? C(true) : save(true))}
            >
              <span />
            </button>
          </div>
          {info.demoEnabled && info.actorIsDemo && (
            <div className="notice warning">
              <AlertTriangle size={18} />
              <p>
                {t(
                  'คุณกำลังใช้บัญชีจำลอง ก่อนปิด ให้สมัครบัญชีจริง เปลี่ยนเป็น Admin ในหน้า "จัดการผู้ใช้" แล้วเข้าสู่ระบบด้วยบัญชีนั้น',
                  'You are signed in with a demo account. Before turning demo off, register a real account, make it Admin in User management, then sign in with it.',
                )}
              </p>
            </div>
          )}
        </>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <Dialog
        open={confirm}
        onClose={() => !busy && C(false)}
        title={t('ปิดข้อมูลจำลอง?', 'Turn off demo data?')}
      >
        <div className="dialog-content">
          <ul className="demo-confirm-list">
            <li>
              {t(
                'บัญชี @demo.test จะเข้าสู่ระบบไม่ได้ และถูกออกจากระบบทันที',
                '@demo.test accounts can no longer sign in and are signed out.',
              )}
            </li>
            <li>
              {t(
                'คำร้องของบัญชีจำลองจะถูกซ่อนจากคิว รายงาน และรายชื่อผู้ใช้',
                'Their requests are hidden from queues, reports and the user list.',
              )}
            </li>
            <li>
              {t(
                'ข้อมูลไม่ถูกลบ เปิดกลับมาได้ทุกเมื่อจากหน้านี้',
                'Nothing is deleted — you can switch it back on here at any time.',
              )}
            </li>
          </ul>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button className="secondary" type="button" disabled={busy} onClick={() => C(false)}>
              {t('ยกเลิก', 'Cancel')}
            </button>
            <button className="primary" type="button" disabled={busy} onClick={() => save(false)}>
              {busy && <Loader2 className="spin" size={18} />}
              {t('ปิดข้อมูลจำลอง', 'Turn off demo data')}
            </button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
