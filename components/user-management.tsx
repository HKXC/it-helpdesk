'use client';
import { useState, useEffect } from 'react';
import {
  Users,
  Search,
  ShieldCheck,
  RefreshCw,
  Database,
  Activity,
  LockKeyhole,
  CheckCircle2,
} from 'lucide-react';
import { useUi, roleLabel } from './ui-provider';
import { Dialog } from './dialog';
export { roleLabel } from './ui-provider';
type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'it' | 'employee';
  active: number;
  version: number;
  protected: boolean;
  created_at: number;
};
type Log = { id: string; detail: string; created_at: number };
type Change = { user: User; role: User['role']; active: number };
export default function UserManagement({ onChanged }: { onChanged?: () => void }) {
  const { t, locale, apiError } = useUi();
  const [users, U] = useState<User[]>([]),
    [audit, A] = useState<Log[]>([]),
    [query, Q] = useState(''),
    [roleFilter, F] = useState('all'),
    [activeFilter, AF] = useState('all'),
    [loading, L] = useState(true),
    [busy, B] = useState(false),
    [error, E] = useState<{ message?: string; status?: number } | null>(null),
    [notice, N] = useState(false),
    [change, C] = useState<Change | null>(null),
    [page, PG] = useState(1);
  async function load() {
    L(true);
    E(null);
    try {
      const r = await fetch('/api/admin/users', {
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
      });
      const data = (await r.json()) as {
        users: User[];
        audit: Log[];
        error?: string;
      };
      if (!r.ok) {
        E({ message: data.error, status: r.status });
        return;
      }
      U(data.users);
      A(data.audit);
    } catch {
      E({ status: 503 });
    } finally {
      L(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => PG(1), [query, roleFilter, activeFilter]);
  async function save() {
    if (!change || busy) return;
    B(true);
    E(null);
    N(false);
    try {
      const r = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: change.user.id,
          version: change.user.version,
          role: change.role,
          active: change.active,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) {
        E({ message: data.error, status: r.status });
        return;
      }
      C(null);
      N(true);
      await load();
      onChanged?.();
    } catch {
      E({ status: 503 });
    } finally {
      B(false);
    }
  }
  const filtered = users.filter(
    (user) =>
      (user.name + ' ' + user.email).toLowerCase().includes(query.toLowerCase()) &&
      (roleFilter === 'all' || user.role === roleFilter) &&
      (activeFilter === 'all' || String(user.active) === activeFilter),
  );
  const maxPage = Math.max(1, Math.ceil(filtered.length / 20));
  const visible = filtered.slice((Math.min(page, maxPage) - 1) * 20, Math.min(page, maxPage) * 20);
  function auditText(log: Log) {
    if (locale === 'th') return log.detail;
    const actor = users.find((u) => u.id === String((log as Log & { actor_id?: string }).actor_id));
    return actor
      ? actor.name + ' — ' + t('เปลี่ยนบทบาทหรือสถานะบัญชี', 'Account role or status updated')
      : t('อัปเดตสิทธิ์ผู้ใช้', 'User access updated');
  }
  return (
    <div className="admin-page">
      <div className="role-summary">
        {[
          {
            role: 'admin',
            text: t('จัดการผู้ใช้ สิทธิ์ และคิวงาน', 'Manage users, access and support work'),
          },
          {
            role: 'it',
            text: t('รับงาน มอบหมาย และบันทึกการแก้ไข', 'Triage, assign and resolve requests'),
          },
          {
            role: 'employee',
            text: t('แจ้งปัญหาและติดตามงานของตนเอง', 'Create and follow your own requests'),
          },
        ].map((item) => (
          <section className="panel role-summary-card" key={item.role}>
            <span className={'role-icon ' + item.role}>
              <ShieldCheck size={23} />
            </span>
            <div>
              <h2>{roleLabel(item.role, locale)}</h2>
              <p>{item.text}</p>
            </div>
            <strong>{users.filter((u) => u.role === item.role && u.active).length}</strong>
          </section>
        ))}
      </div>
      {notice && (
        <div className="notice success" role="status">
          <CheckCircle2 size={20} />
          {t(
            'บันทึกสิทธิ์แล้ว บัญชีที่เปลี่ยนต้องเข้าสู่ระบบใหม่',
            'Access updated. The affected user must sign in again.',
          )}
        </div>
      )}
      {error && !change && (
        <div className="notice error" role="alert">
          {apiError(error.message, error.status)}
        </div>
      )}
      <section className="panel users-panel">
        <div className="panel-heading">
          <div>
            <h2>
              {t('ผู้ใช้งานในระบบ', 'User accounts')}
              <span className="count-badge">{users.length}</span>
            </h2>
            <p>
              {t(
                'บัญชีใหม่เริ่มด้วยสิทธิ์พนักงาน การเปลี่ยนสิทธิ์จะยกเลิก session ของบัญชีนั้น',
                'New accounts start as employees. Access changes revoke the affected account’s sessions.',
              )}
            </p>
          </div>
          <button className="secondary" disabled={loading || busy} onClick={() => load()}>
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
            {t('โหลดใหม่', 'Refresh')}
          </button>
        </div>
        <div className="list-toolbar">
          <label className="search">
            <Search size={20} />
            <input
              aria-label={t('ค้นหาผู้ใช้', 'Search users')}
              value={query}
              onChange={(e) => Q(e.target.value)}
              placeholder={t('ค้นหาชื่อหรืออีเมล', 'Search name or email')}
            />
          </label>
          <label className="compact-field">
            {t('บทบาท', 'Role')}
            <select value={roleFilter} onChange={(e) => F(e.target.value)}>
              <option value="all">{t('ทั้งหมด', 'All roles')}</option>
              {['employee', 'it', 'admin'].map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="compact-field">
            {t('สถานะ', 'Status')}
            <select value={activeFilter} onChange={(e) => AF(e.target.value)}>
              <option value="all">{t('ทั้งหมด', 'All statuses')}</option>
              <option value="1">{t('ใช้งานอยู่', 'Active')}</option>
              <option value="0">{t('ถูกระงับ', 'Suspended')}</option>
            </select>
          </label>
        </div>
        <div className="table-scroll">
          <table className="users-table">
            <caption className="sr-only">
              {t('รายการผู้ใช้และการจัดการสิทธิ์', 'Users and access management')}
            </caption>
            <thead>
              <tr>
                <th>{t('ผู้ใช้งาน', 'User')}</th>
                <th>{t('บทบาท', 'Role')}</th>
                <th>{t('สถานะบัญชี', 'Account status')}</th>
                <th>{t('การจัดการ', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <span className="user-email">{user.email}</span>
                    {user.protected && (
                      <span className="protected-label">
                        <LockKeyhole size={14} />
                        {t('บัญชีที่ได้รับการป้องกัน', 'Protected account')}
                      </span>
                    )}
                  </td>
                  <td>
                    <select
                      aria-label={t('บทบาทของ ', 'Role for ') + user.email}
                      value={user.role}
                      disabled={user.protected || busy || loading}
                      onChange={(e) => {
                        E(null);
                        C({ user, role: e.target.value as User['role'], active: user.active });
                      }}
                    >
                      {['employee', 'it', 'admin'].map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role, locale)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={'badge ' + (user.active ? 'success' : 'neutral')}>
                      <i />
                      {user.active ? t('ใช้งานอยู่', 'Active') : t('ถูกระงับ', 'Suspended')}
                    </span>
                  </td>
                  <td>
                    <button
                      className={user.active ? 'secondary danger-text' : 'secondary'}
                      disabled={user.protected || busy || loading}
                      onClick={() => {
                        E(null);
                        C({ user, role: user.role, active: user.active ? 0 : 1 });
                      }}
                    >
                      {user.active ? t('ระงับบัญชี', 'Suspend') : t('เปิดใช้งาน', 'Activate')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && (
            <div className="empty-state">
              <RefreshCw className="spin" size={28} />
              <p>{t('กำลังโหลดผู้ใช้', 'Loading users')}</p>
            </div>
          )}
          {!loading && !visible.length && (
            <div className="empty-state">
              <Users size={32} />
              <h3>{t('ไม่พบผู้ใช้', 'No matching users')}</h3>
              <p>{t('ลองเปลี่ยนคำค้นหรือตัวกรอง', 'Try another search or filter.')}</p>
            </div>
          )}
        </div>
        <div className="pagination">
          <span>
            {filtered.length} {t('บัญชี', 'accounts')}
          </span>
          <div>
            <button className="secondary compact" disabled={page <= 1} onClick={() => PG(page - 1)}>
              {t('ก่อนหน้า', 'Previous')}
            </button>
            <span>
              {Math.min(page, maxPage)} / {maxPage}
            </span>
            <button
              className="secondary compact"
              disabled={page >= maxPage}
              onClick={() => PG(page + 1)}
            >
              {t('ถัดไป', 'Next')}
            </button>
          </div>
        </div>
      </section>
      <div className="admin-bottom-grid">
        <section className="panel audit-panel">
          <div className="section-title">
            <h2>
              <Activity size={21} />
              {t('ประวัติการเปลี่ยนสิทธิ์', 'Access change history')}
            </h2>
          </div>
          {audit.length ? (
            <ol className="activity-list">
              {audit.map((log) => (
                <li key={log.id}>
                  <span className="activity-dot" />
                  <div>
                    <p>{auditText(log)}</p>
                    <time>
                      {new Date(log.created_at).toLocaleString(
                        locale === 'th' ? 'th-TH' : 'en-GB',
                        { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' },
                      )}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">{t('ยังไม่มีการเปลี่ยนสิทธิ์', 'No access changes recorded.')}</p>
          )}
        </section>
        <section className="panel database-panel">
          <span className="topic-icon">
            <Database size={25} />
          </span>
          <h2>{t('ฐานข้อมูลปัจจุบัน', 'Current database')}</h2>
          <span className="badge success">
            <i />
            Supabase PostgreSQL
          </span>
          <p>
            {t(
              'ข้อมูลบัญชี คำร้อง และรูปที่แนบ จัดเก็บใน Supabase เข้าถึงผ่านเซิร์ฟเวอร์ของเว็บเท่านั้น',
              'Accounts, requests and attached images are stored in Supabase and accessed only through the web server.',
            )}
          </p>
          <small>
            {t(
              'คีย์เชื่อมต่อไม่แสดงบนหน้าเว็บไซต์',
              'Connection secrets are never shown on the website.',
            )}
          </small>
        </section>
      </div>
      <Dialog
        open={Boolean(change)}
        onClose={() => {
          if (!busy) {
            C(null);
            E(null);
          }
        }}
        title={t('ยืนยันการเปลี่ยนสิทธิ์', 'Confirm access change')}
        className="confirm-dialog"
      >
        {change && (
          <div className="dialog-content">
            <p>{t('บัญชีที่ได้รับผลกระทบ', 'Affected account')}</p>
            <div className="confirmation-account">
              <strong>{change.user.name}</strong>
              <span>{change.user.email}</span>
            </div>
            <dl className="confirmation-details">
              <div>
                <dt>{t('บทบาท', 'Role')}</dt>
                <dd>
                  {roleLabel(change.user.role, locale)} → {roleLabel(change.role, locale)}
                </dd>
              </div>
              <div>
                <dt>{t('สถานะ', 'Status')}</dt>
                <dd>{change.active ? t('ใช้งานอยู่', 'Active') : t('ระงับบัญชี', 'Suspended')}</dd>
              </div>
            </dl>
            <div className="notice warning">
              <ShieldCheck size={21} />
              {t(
                'ระบบจะยกเลิก session ของบัญชีนี้ ผู้ใช้ต้องเข้าสู่ระบบใหม่เพื่อรับสิทธิ์ที่เปลี่ยน',
                'This account’s sessions will be revoked. The user must sign in again to use the new access.',
              )}
            </div>
            {error && (
              <div className="notice error" role="alert">
                {apiError(error.message, error.status)}
              </div>
            )}
            <div className="dialog-actions">
              <button className="secondary" disabled={busy} onClick={() => C(null)}>
                {t('ยกเลิก', 'Cancel')}
              </button>
              <button className="primary" disabled={busy} onClick={() => save()}>
                {busy ? t('กำลังบันทึก', 'Saving') : t('ยืนยันเปลี่ยนสิทธิ์', 'Confirm change')}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
