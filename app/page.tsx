'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Ticket,
  UserCheck,
  BookOpen,
  BarChart3,
  Users,
  Settings,
  HelpCircle,
  Menu,
  X,
  LogOut,
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowUpRight,
  AlertCircle,
  MessageSquare,
  Download,
  MonitorCog,
  Filter,
  ShieldCheck,
  Flag,
  Timer,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react';
import { AccountGate, type WebAccount } from '../components/account-gate';
import { UiControls } from '../components/ui-controls';
import {
  useUi,
  statusLabel,
  categoryLabel,
  priorityLabel,
  roleLabel,
} from '../components/ui-provider';
import { useHelpdesk } from '../hooks/use-helpdesk';
import { statuses, safeCsvCell, type Job } from '../lib/helpdesk';
import { TicketForm } from '../components/ticket-form';
import { TicketDetails, StatusBadge } from '../components/ticket-details';
import { Onboarding } from '../components/onboarding';
import { SlaChip } from '../components/sla';
import { CountUp } from '../components/count-up';
import { playAuthTransition } from '../components/auth-transition';
import { formatDuration, SLA_TARGETS, slaBreached, slaOf } from '../lib/sla';
import KnowledgeBase from '../components/knowledge-base';
import UserManagement from '../components/user-management';
import AccountSettings from '../components/account-settings';
import { knowledge } from '../lib/knowledge';
type Page = 'overview' | 'tickets' | 'mine' | 'knowledge' | 'reports' | 'users' | 'settings';
const isActive = (job: Job) => ['เปิดใหม่', 'กำลังดำเนินการ', 'รอข้อมูล'].includes(job.status);
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
export default function Home() {
  return (
    <AccountGate>
      {(user, logout) => <Dashboard key={user.id} user={user} logout={logout} />}
    </AccountGate>
  );
}
function Dashboard({ user, logout }: { user: WebAccount; logout: () => Promise<void> }) {
  const { t, locale, pick, apiError } = useUi();
  const desk = useHelpdesk(user.role);
  const { jobs, status, role, agents, canEdit } = desk;
  const staff = role === 'admin' || role === 'it';
  const [page, P] = useState<Page>('overview'),
    [mobile, M] = useState(false),
    [profile, PR] = useState(false),
    [creating, C] = useState(false),
    [selected, S] = useState<number | null>(null),
    [seed, SE] = useState<{ key: number; title?: string; category?: string }>(),
    [tour, TO] = useState(!user.onboardingCompleted),
    [query, Q] = useState(''),
    [state, F] = useState('all'),
    [category, CF] = useState('all'),
    [priority, PF] = useState('all'),
    [assignment, AF] = useState('all'),
    [sort, SO] = useState('newest'),
    [listPage, LP] = useState(1),
    [toast, T] = useState(''),
    [loggingOut, LO] = useState(false);
  const sidebar = useRef<HTMLElement>(null),
    accountMenu = useRef<HTMLDivElement>(null);
  const pending = status === 'saving' || status === 'error' || status === 'conflict';
  const active = jobs.find((j) => j.id === selected);
  const error = ['error', 'conflict'].includes(status) ? apiError(desk.error, desk.errorCode) : '';
  useEffect(() => {
    if (new URLSearchParams(location.search).get('article')) P('knowledge');
  }, []);
  useEffect(() => {
    LP(1);
  }, [query, state, category, priority, assignment, sort, page]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => T(''), 4000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (accountMenu.current && !accountMenu.current.contains(e.target as Node)) PR(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        PR(false);
        M(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const nav = sidebar.current;
    const controls = () => Array.from(nav?.querySelectorAll<HTMLElement>('button,a[href]') || []);
    controls()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const all = controls(),
        first = all[0],
        last = all.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', trap);
    const q = matchMedia('(min-width: 1100px)');
    const wide = () => {
      if (q.matches) M(false);
    };
    q.addEventListener('change', wide);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener('keydown', trap);
      q.removeEventListener('change', wide);
    };
  }, [mobile]);
  function resetFilters() {
    Q('');
    F('all');
    CF('all');
    PF('all');
    AF('all');
    SO('newest');
    LP(1);
  }
  function go(next: Page) {
    P(next);
    resetFilters();
    M(false);
    PR(false);
  }
  function openRequests(filter = 'all', assign = 'all') {
    go('tickets');
    F(filter);
    AF(assign);
  }
  function newRequest(title?: string, cat?: string) {
    if (status !== 'saved') {
      T(
        t(
          'กรุณารอหรือจัดการรายการค้างก่อนสร้างคำร้องใหม่',
          'Wait or resolve the pending operation before creating a request.',
        ),
      );
      return;
    }
    if (title || cat) SE({ key: Date.now(), title, category: cat });
    C(true);
    M(false);
  }
  function openGuide(id: string) {
    const url = new URL(location.href);
    url.searchParams.set('article', id);
    history.replaceState(null, '', url.pathname + url.search);
    go('knowledge');
  }
  function intro() {
    TO(true);
    M(false);
    PR(false);
  }
  async function leave() {
    if (loggingOut) return;
    LO(true);
    try {
      await playAuthTransition({
        mode: 'out',
        title: t('แล้วพบกันใหม่, ', 'See you soon, ') + user.name,
        subtitle: t('ออกจากระบบเรียบร้อยแล้ว', 'You have been signed out.'),
        origin: document.activeElement as HTMLElement | null,
        apply: logout,
      });
    } catch {
      T(t('ออกจากระบบไม่สำเร็จ กรุณาลองใหม่', 'Could not sign out. Please try again.'));
    } finally {
      LO(false);
    }
  }
  const navigation = [
    { id: 'overview' as Page, label: t('ภาพรวม', 'Overview'), icon: LayoutDashboard },
    {
      id: 'tickets' as Page,
      label: staff ? t('คิวงานทั้งหมด', 'All requests') : t('คำร้องของฉัน', 'My requests'),
      icon: Ticket,
    },
    {
      id: 'mine' as Page,
      label: t('งานที่มอบหมายให้ฉัน', 'Assigned to me'),
      icon: UserCheck,
      hidden: !staff,
    },
    { id: 'knowledge' as Page, label: t('คลังความรู้', 'Knowledge base'), icon: BookOpen },
    { id: 'reports' as Page, label: t('รายงาน', 'Reports'), icon: BarChart3 },
  ];
  const pageTitle =
    page === 'users'
      ? t('จัดการผู้ใช้', 'User management')
      : page === 'settings'
        ? t('ตั้งค่าบัญชี', 'Account settings')
        : navigation.find((n) => n.id === page)?.label || t('ภาพรวม', 'Overview');
  const descriptions: Record<Page, string> = {
    overview: t(
      'ติดตามงานที่ต้องดูแล และเข้าถึงสิ่งที่ใช้บ่อยได้จากหน้านี้',
      'Follow the work that needs attention and reach your everyday tools.',
    ),
    tickets: staff
      ? t(
          'ดูคิวงานร่วม ค้นหาคำร้อง และติดตามความคืบหน้า',
          'Review the shared queue, find requests and follow progress.',
        )
      : t(
          'ดูสถานะ ตอบกลับทีม IT และตรวจสอบผลการแก้ไขของคุณ',
          'Follow statuses, reply to IT and verify the result.',
        ),
    mine: t(
      'จัดลำดับและติดตามคำร้องที่มอบหมายให้บัญชีของคุณ',
      'Prioritize and follow requests assigned to your account.',
    ),
    knowledge: t(
      'ค้นคำแนะนำที่อ่านง่าย พร้อมขั้นตอนและข้อมูลที่ควรแจ้ง IT',
      'Find practical guides with clear steps and details to provide to IT.',
    ),
    reports: t(
      'สรุปตามข้อมูลที่บัญชีของคุณมีสิทธิ์เข้าถึง',
      'A summary of the records your account is allowed to access.',
    ),
    users: t(
      'ดูแลบัญชี บทบาท และการเข้าใช้งานของผู้ใช้ในองค์กร',
      'Manage user accounts, roles and access within the organization.',
    ),
    settings: t(
      'ปรับภาษา ธีม ความปลอดภัย และทบทวนวิธีใช้งาน',
      'Set language, appearance and security, or review the basics.',
    ),
  };
  const filtered = useMemo(
    () =>
      jobs
        .filter(
          (job) =>
            (page !== 'mine' || job.assigneeId === user.id) &&
            (state === 'all' ||
              (state === 'active' && isActive(job)) ||
              (state === 'sla' && slaBreached(job)) ||
              (state === 'waiting' && ['เปิดใหม่', 'รอข้อมูล'].includes(job.status)) ||
              job.status === state) &&
            (category === 'all' || job.category === category) &&
            (priority === 'all' || job.priority === priority) &&
            (assignment === 'all' ||
              (assignment === 'unassigned' && !job.assigneeId) ||
              (assignment === 'mine' && job.assigneeId === user.id)) &&
            `${job.id} ${job.title} ${job.person} ${job.category} ${categoryLabel(job.category, locale)} ${job.asset || ''} ${job.location || ''}`
              .toLowerCase()
              .includes(query.toLowerCase().trim()),
        )
        .sort((a, b) =>
          sort === 'oldest'
            ? a.id - b.id
            : sort === 'priority'
              ? ['เร่งด่วน', 'สูง', 'ปกติ', 'ต่ำ'].indexOf(a.priority) -
                  ['เร่งด่วน', 'สูง', 'ปกติ', 'ต่ำ'].indexOf(b.priority) || b.id - a.id
              : b.id - a.id,
        ),
    [jobs, page, state, category, priority, assignment, query, sort, user.id, locale],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 20));
  const visible =
    page === 'overview'
      ? jobs
          .slice()
          .sort((a, b) => b.id - a.id)
          .slice(0, 5)
      : filtered.slice(
          (Math.min(listPage, totalPages) - 1) * 20,
          Math.min(listPage, totalPages) * 20,
        );
  const date = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-GB', {
          day: 'numeric',
          month: 'short',
          timeZone: 'Asia/Bangkok',
        })
      : t('ข้อมูลเดิม', 'Imported');
  function csv() {
    const rows = [
      [
        t('เลขที่คำร้อง', 'Request ID'),
        t('หัวข้อ', 'Subject'),
        t('สถานะ', 'Status'),
        t('ความสำคัญ', 'Priority'),
        t('หมวดหมู่', 'Category'),
        t('ผู้แจ้ง', 'Requester'),
        t('ผู้รับผิดชอบ', 'Assignee'),
      ],
      ...filtered.map((job) => [
        'IT-' + String(job.id).padStart(4, '0'),
        job.title,
        statusLabel(job.status, locale),
        priorityLabel(job.priority, locale),
        categoryLabel(job.category, locale),
        job.person,
        job.assigneeId ? job.agent : t('ยังไม่มอบหมาย', 'Unassigned'),
      ]),
    ];
    download(
      'flowdesk-requests.csv',
      '\uFEFF' + rows.map((row) => row.map(safeCsvCell).join(',')).join('\r\n'),
      'text/csv;charset=utf-8',
    );
    T(t('ส่งออกข้อมูลที่กรองไว้แล้ว', 'Filtered requests exported.'));
  }
  const staffCards = [
    {
      label: t('ยังไม่มอบหมาย', 'Unassigned'),
      count: jobs.filter((j) => isActive(j) && !j.assigneeId).length,
      icon: AlertCircle,
      filter: 'active',
      assign: 'unassigned',
      hint: t('รอคนรับเรื่อง', 'Waiting for someone to pick up'),
    },
    {
      label: t('งานของฉัน', 'My active work'),
      count: jobs.filter((j) => isActive(j) && j.assigneeId === user.id).length,
      icon: UserCheck,
      filter: 'active',
      assign: 'mine',
      hint: t('งานที่มอบหมายให้คุณและยังไม่เสร็จ', 'Assigned to you and still open'),
    },
  ];
  const cardData: {
    label: string;
    count: number;
    icon: typeof Ticket;
    filter: string;
    assign?: string;
    hint: string;
  }[] = [
    ...(staff ? staffCards : []),
    {
      label: t('คำร้องทั้งหมด', 'All requests'),
      count: jobs.length,
      icon: Ticket,
      filter: 'all',
      hint: t('รวมทุกสถานะ', 'Across all statuses'),
    },
    {
      label: t('อยู่ระหว่างดำเนินงาน', 'Active work'),
      count: jobs.filter(isActive).length,
      icon: Clock,
      filter: 'active',
      hint: t('รับเรื่อง ตรวจสอบ หรือรอข้อมูล', 'New, in progress or waiting'),
    },
    {
      label: t('รอยืนยันผล', 'Awaiting confirmation'),
      count: jobs.filter((j) => j.status === 'แก้ไขแล้ว').length,
      icon: MessageSquare,
      filter: 'แก้ไขแล้ว',
      hint: t('แก้ไขแล้ว รอผู้แจ้งตรวจสอบ', 'Resolved, pending requester review'),
    },
    {
      label: t('ปิดงานแล้ว', 'Closed requests'),
      count: jobs.filter((j) => j.status === 'ปิดงาน').length,
      icon: CheckCircle2,
      filter: 'ปิดงาน',
      hint: t('ผู้แจ้งยืนยันผลแล้ว', 'Confirmed by the requester'),
    },
    {
      label: t('เกิน SLA', 'SLA overdue'),
      count: jobs.filter(slaBreached).length,
      icon: Timer,
      filter: 'sla',
      hint: t('งานที่เลยเวลาเป้าหมาย', 'Past their target time'),
    },
  ].filter((card) =>
    staff ? !['all', 'ปิดงาน', 'แก้ไขแล้ว'].includes(card.filter) : card.filter !== 'sla',
  );
  function ticketList() {
    return (
      <>
        <div className="table-scroll request-table-wrap">
          <table className="request-table">
            <caption className="sr-only">
              {page === 'overview' ? t('คำร้องล่าสุด', 'Recent requests') : pageTitle}
            </caption>
            <thead>
              <tr>
                <th>{t('คำร้อง', 'Request')}</th>
                <th>{t('สถานะ', 'Status')}</th>
                <th>{t('ความสำคัญ', 'Priority')}</th>
                <th>{t('ผู้รับผิดชอบ', 'Assignee')}</th>
                <th>
                  <span className="sr-only">{t('เปิดรายละเอียด', 'Open details')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((job) => (
                <tr key={job.id} onClick={() => S(job.id)}>
                  <td>
                    <div className="request-subject">
                      <span className="request-category-icon">
                        <Ticket size={21} />
                      </span>
                      <div>
                        <span className="request-id">IT-{String(job.id).padStart(4, '0')}</span>
                        <button className="request-title-button" onClick={() => S(job.id)}>
                          {job.title}
                        </button>
                        <p>
                          {categoryLabel(job.category, locale)}
                          <span>·</span>
                          {date(job.createdAt)}
                          {staff && (
                            <>
                              <span>·</span>
                              {job.person}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <StatusBadge value={job.status} />
                  </td>
                  <td>
                    <span
                      className={
                        'priority-label ' +
                        (job.priority === 'เร่งด่วน'
                          ? 'urgent'
                          : job.priority === 'สูง'
                            ? 'high'
                            : '')
                      }
                    >
                      <Flag size={16} />
                      {priorityLabel(job.priority, locale)}
                    </span>
                    <SlaChip job={job} />
                  </td>
                  <td>
                    <span className={job.assigneeId ? 'assignee-name' : 'muted'}>
                      {job.assigneeId ? job.agent : t('ยังไม่มอบหมาย', 'Unassigned')}
                    </span>
                  </td>
                  <td>
                    <ChevronRight size={19} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mobile-request-list">
          {visible.map((job) => (
            <button key={job.id} className="mobile-request" onClick={() => S(job.id)}>
              <div>
                <span className="request-id">IT-{String(job.id).padStart(4, '0')}</span>
                <span className="mobile-request-badges">
                  <SlaChip job={job} />
                  <StatusBadge value={job.status} />
                </span>
              </div>
              <h3>{job.title}</h3>
              <p>
                {categoryLabel(job.category, locale)}
                <span>·</span>
                {priorityLabel(job.priority, locale)}
              </p>
              <footer>
                <span>{job.assigneeId ? job.agent : t('ยังไม่มอบหมาย', 'Unassigned')}</span>
                <span>
                  {date(job.createdAt)}
                  <ChevronRight size={17} />
                </span>
              </footer>
            </button>
          ))}
        </div>
        {!visible.length && status !== 'loading' && (
          <div className="empty-state">
            <Ticket size={36} />
            <h3>
              {jobs.length
                ? t('ไม่พบคำร้องที่ตรงกัน', 'No matching requests')
                : t('ยังไม่มีคำร้อง', 'No requests yet')}
            </h3>
            <p>
              {jobs.length
                ? t('ลองเปลี่ยนคำค้นหรือตัวกรอง', 'Try another search or filter.')
                : t(
                    'เริ่มแจ้งปัญหา หรือค้นคำแนะนำในคลังความรู้ได้ทันที',
                    'Create your first request or explore the knowledge base.',
                  )}
            </p>
            <button className="secondary" onClick={jobs.length ? resetFilters : () => newRequest()}>
              {jobs.length
                ? t('ล้างตัวกรอง', 'Clear filters')
                : t('แจ้งปัญหาใหม่', 'Create a request')}
            </button>
          </div>
        )}
        {status === 'loading' && !jobs.length && (
          <div className="empty-state" role="status">
            <Loader2 className="spin" size={30} />
            <p>{t('กำลังโหลดคำร้อง', 'Loading requests')}</p>
          </div>
        )}
      </>
    );
  }
  return (
    <div className="app-shell">
      <aside
        ref={sidebar}
        className={'sidebar ' + (mobile ? 'is-open' : '')}
        aria-label={t('เมนูหลัก', 'Main navigation')}
      >
        <div className="sidebar-brand">
          <a
            href="/"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              go('overview');
            }}
          >
            <span className="brand-mark">
              <MonitorCog size={25} />
            </span>
            Flowdesk
          </a>
          <button
            className="icon-button sidebar-close"
            aria-label={t('ปิดเมนู', 'Close navigation')}
            onClick={() => M(false)}
          >
            <X size={23} />
          </button>
        </div>
        <div className="workspace-label">
          <ShieldCheck size={21} />
          <div>
            <strong>{t('ศูนย์ช่วยเหลือ IT', 'IT Service Desk')}</strong>
            <span>{roleLabel(role, locale)}</span>
          </div>
        </div>
        <span className="nav-group-label">{t('พื้นที่ทำงาน', 'WORKSPACE')}</span>
        <nav>
          {navigation
            .filter((item) => !item.hidden)
            .map((item) => (
              <button
                key={item.id}
                className={'nav-link ' + (page === item.id ? 'selected' : '')}
                aria-current={page === item.id ? 'page' : undefined}
                onClick={() => go(item.id)}
              >
                <item.icon size={21} />
                <span>{item.label}</span>
                {item.id === 'tickets' && jobs.some(isActive) && (
                  <b className="nav-count">{jobs.filter(isActive).length}</b>
                )}
              </button>
            ))}
        </nav>
        {role === 'admin' && (
          <div className="admin-nav">
            <span className="nav-group-label">{t('ผู้ดูแลระบบ', 'ADMINISTRATION')}</span>
            <button
              className={'nav-link ' + (page === 'users' ? 'selected' : '')}
              aria-current={page === 'users' ? 'page' : undefined}
              onClick={() => go('users')}
            >
              <Users size={21} />
              <span>{t('จัดการผู้ใช้', 'User management')}</span>
            </button>
          </div>
        )}
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <BookOpen size={24} />
            <strong>{t('เริ่มต้นใช้งานอย่างมั่นใจ', 'Get familiar with Flowdesk')}</strong>
            <p>
              {t(
                'คำแนะนำสั้น ๆ สำหรับเมนูและการแจ้งปัญหา',
                'A short introduction to requests and navigation.',
              )}
            </p>
            <button className="secondary" onClick={intro}>
              {t('ดูคำแนะนำ', 'Show introduction')}
              <ArrowRight size={17} />
            </button>
          </div>
          <button
            className={'nav-link ' + (page === 'settings' ? 'selected' : '')}
            onClick={() => go('settings')}
          >
            <Settings size={21} />
            <span>{t('ตั้งค่าบัญชี', 'Account settings')}</span>
          </button>
          <button className="nav-link" onClick={intro}>
            <HelpCircle size={21} />
            <span>{t('ช่วยเหลือและวิธีใช้', 'Help & introduction')}</span>
          </button>
          <div className="sidebar-footer">
            <span>Flowdesk</span>
            <span>v5.0</span>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-backdrop"
          aria-label={t('ปิดเมนู', 'Close navigation')}
          onClick={() => M(false)}
        />
      )}
      <div className="main-shell" inert={mobile ? true : undefined}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu-button"
              aria-label={t('เปิดเมนู', 'Open navigation')}
              onClick={() => M(true)}
            >
              <Menu size={24} />
            </button>
            <span className="topbar-workspace">{t('ศูนย์ช่วยเหลือ IT', 'IT Service Desk')}</span>
            <ChevronRight size={17} />
            <strong>{pageTitle}</strong>
          </div>
          <div className="topbar-right">
            <UiControls />
            <span className="topbar-divider" />
            <div className="account-menu" ref={accountMenu}>
              <button
                className="account-trigger"
                aria-expanded={profile}
                aria-haspopup="menu"
                onClick={() => PR(!profile)}
              >
                <span className="account-avatar">{Array.from(user.name)[0]}</span>
                <span>
                  <strong>{user.name}</strong>
                  <small>{roleLabel(role, locale)}</small>
                </span>
                <ChevronDown size={18} />
              </button>
              {profile && (
                <div className="account-popover" role="menu">
                  <div>
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                    <small>{roleLabel(role, locale)}</small>
                  </div>
                  <button role="menuitem" onClick={() => go('settings')}>
                    <Settings size={19} />
                    {t('ตั้งค่าบัญชี', 'Account settings')}
                  </button>
                  <button role="menuitem" disabled={loggingOut || pending} onClick={() => leave()}>
                    <LogOut size={19} />
                    {loggingOut ? t('กำลังออกจากระบบ', 'Signing out') : t('ออกจากระบบ', 'Sign out')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="main-content" id="main-content">
          {page !== 'knowledge' && (
            <div className={'page-heading' + (page === 'overview' ? ' is-hero' : '')}>
              <div>
                <h1>
                  {page === 'overview' ? t('ยินดีต้อนรับ, ', 'Welcome, ') + user.name : pageTitle}
                </h1>
                <p>
                  {page === 'overview'
                    ? staff
                      ? t(
                          'งานที่ต้องรับผิดชอบและสิ่งที่ต้องติดตามต่อ',
                          'Work and follow-ups that need your attention.',
                        )
                      : t(
                          'ดูความคืบหน้าคำร้องของคุณ หรือเริ่มแจ้งปัญหาใหม่ได้ทันที',
                          'Check your request progress or start a new support request.',
                        )
                    : descriptions[page]}
                  {status === 'saved' &&
                    !error &&
                    desk.loadedAt &&
                    !['knowledge', 'settings', 'users'].includes(page) && (
                      <span className="heading-sync">
                        <CheckCircle2 size={14} />
                        {t('อัปเดต', 'Updated')}{' '}
                        {desk.loadedAt.toLocaleTimeString(locale === 'th' ? 'th-TH' : 'en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Asia/Bangkok',
                        })}
                      </span>
                    )}
                </p>
              </div>
              <div className="page-actions">
                {['reports', 'tickets', 'mine'].includes(page) && (
                  <button className="secondary" disabled={!jobs.length} onClick={csv}>
                    <Download size={19} />
                    {t('ส่งออก CSV', 'Export CSV')}
                  </button>
                )}
                {page === 'overview' && (
                  <button className="text-button" onClick={() => go('knowledge')}>
                    <BookOpen size={19} />
                    {t('ค้นวิธีแก้ปัญหา', 'Find a guide')}
                  </button>
                )}
                {!['settings', 'knowledge', 'users'].includes(page) && (
                  <button
                    className="secondary refresh-button"
                    disabled={status !== 'saved'}
                    onClick={() => desk.reload()}
                  >
                    <RefreshCw size={19} />
                    {t('อัปเดตข้อมูล', 'Refresh')}
                  </button>
                )}
                <button className="primary" onClick={() => newRequest()}>
                  <Plus size={20} />
                  {t('แจ้งปัญหา', 'New request')}
                </button>
              </div>
            </div>
          )}
          {(status !== 'saved' || error) && (
            <div
              className={
                'sync-status ' + (['error', 'conflict'].includes(status) ? 'has-error' : '')
              }
              role={error ? 'alert' : 'status'}
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="spin" size={18} />
                  <span>{t('กำลังโหลดข้อมูลล่าสุด', 'Loading the latest data')}</span>
                </>
              ) : status === 'saving' ? (
                <>
                  <Loader2 className="spin" size={18} />
                  <span>{t('กำลังบันทึกข้อมูล', 'Saving changes')}</span>
                </>
              ) : error ? (
                <>
                  <AlertCircle size={20} />
                  <div>
                    <p>{error}</p>
                    <div className="notice-actions">
                      {status !== 'conflict' && (
                        <button className="secondary compact" onClick={() => desk.retry()}>
                          {t('ลองอีกครั้ง', 'Try again')}
                        </button>
                      )}
                      <button className="secondary compact" onClick={() => desk.reload()}>
                        {t('โหลดล่าสุดและยกเลิกรายการค้าง', 'Refresh and discard pending changes')}
                      </button>
                      <button
                        className="text-button"
                        onClick={() =>
                          download(
                            'flowdesk-pending-backup.json',
                            JSON.stringify(desk.backup(), null, 2),
                            'application/json',
                          )
                        }
                      >
                        {t('สำรองรายการค้าง', 'Back up pending changes')}
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
          <div className="page-content" key={page}>
            {page === 'overview' && (
              <>
                <section className="summary-grid" aria-label={t('สรุปคำร้อง', 'Request summary')}>
                  {cardData.map((card, i) => (
                    <button
                      key={card.label}
                      className={'summary-card' + (card.filter === 'sla' ? ' sla-card' : '')}
                      onClick={() => openRequests(card.filter, card.assign)}
                      style={{ animationDelay: i * 35 + 'ms' }}
                    >
                      <div>
                        <span>{card.label}</span>
                        <card.icon size={22} />
                      </div>
                      <strong>
                        {status === 'loading' && !jobs.length ? (
                          '—'
                        ) : (
                          <CountUp value={card.count} />
                        )}
                      </strong>
                      <footer>
                        <span>{card.hint}</span>
                        <ArrowUpRight size={18} />
                      </footer>
                    </button>
                  ))}
                </section>
                <div className="overview-grid">
                  <section className="panel recent-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>{t('คำร้องล่าสุด', 'Recent requests')}</h2>
                        <p>
                          {t(
                            'เลือกคำร้องเพื่อดูรายละเอียดและการสนทนา',
                            'Select a request to read details and messages.',
                          )}
                        </p>
                      </div>
                      <button className="text-button" onClick={() => go('tickets')}>
                        {t('ดูทั้งหมด', 'View all')}
                        <ArrowRight size={18} />
                      </button>
                    </div>
                    {ticketList()}
                  </section>
                  <aside className="panel followup-panel">
                    <div className="section-title">
                      <h2>{t('สิ่งที่ต้องติดตาม', 'Follow up next')}</h2>
                    </div>
                    {[
                      {
                        label: t('รอยืนยันผลการแก้ไข', 'Review resolved requests'),
                        description: t(
                          'ทดสอบผลและยืนยันปิดงาน',
                          'Test the result and confirm closure.',
                        ),
                        count: jobs.filter(
                          (j) => j.status === 'แก้ไขแล้ว' && (staff || j.requesterId === user.id),
                        ).length,
                        icon: CheckCircle2,
                        run: () => openRequests('แก้ไขแล้ว'),
                      },
                      {
                        label: staff
                          ? t('งานที่ยังไม่มอบหมาย', 'Unassigned work')
                          : t('คำร้องที่รอข้อมูล', 'Requests waiting for details'),
                        description: staff
                          ? t(
                              'เลือกผู้รับผิดชอบเพื่อเริ่มดำเนินการ',
                              'Assign an agent to start work.',
                            )
                          : t('อ่านคำถามล่าสุดจากเจ้าหน้าที่', 'Read the agent’s latest question.'),
                        count: jobs.filter((j) =>
                          staff ? !j.assigneeId && isActive(j) : j.status === 'รอข้อมูล',
                        ).length,
                        icon: staff ? UserCheck : MessageSquare,
                        run: () =>
                          openRequests(staff ? 'active' : 'รอข้อมูล', staff ? 'unassigned' : 'all'),
                      },
                    ].map((item) => (
                      <button className="followup-item" key={item.label} onClick={item.run}>
                        <span className="followup-icon">
                          <item.icon size={22} />
                        </span>
                        <div>
                          <strong>{item.label}</strong>
                          <p>{item.description}</p>
                        </div>
                        <b>{item.count}</b>
                        <ChevronRight size={17} />
                      </button>
                    ))}
                    <div className="followup-guide">
                      <BookOpen size={25} />
                      <h3>
                        {t('ใช้งานได้สะดวกขึ้นด้วยคู่มือ', 'Make support easier with a guide')}
                      </h3>
                      <p>
                        {t(
                          'คำแนะนำเป็นขั้นตอน ช่วยให้แจ้งปัญหาและติดตามงานได้ครบถ้วน',
                          'Step-by-step guidance helps you create and follow complete requests.',
                        )}
                      </p>
                      <button className="secondary" onClick={() => openGuide('start')}>
                        {t('อ่านคู่มือเริ่มต้น', 'Read the getting-started guide')}
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  </aside>
                </div>
                <section className="recommended-overview">
                  <div className="section-title">
                    <div>
                      <h2>{t('คำแนะนำที่น่าอ่าน', 'Useful guides')}</h2>
                      <p>
                        {t(
                          'คู่มือที่ช่วยแก้ปัญหาและเตรียมข้อมูลก่อนติดต่อ IT',
                          'Prepare useful details and troubleshoot before contacting IT.',
                        )}
                      </p>
                    </div>
                    <button className="text-button" onClick={() => go('knowledge')}>
                      {t('ดูคลังความรู้', 'Explore knowledge base')}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                  <div className="overview-guides">
                    {['good-request', 'wifi', 'password'].map((id) => {
                      const article = knowledge.find((a) => a.id === id)!;
                      return (
                        <button key={id} onClick={() => openGuide(id)}>
                          <span className="topic-icon">
                            <BookOpen size={22} />
                          </span>
                          <div>
                            <h3>{pick(article.title)}</h3>
                            <p>{pick(article.summary)}</p>
                          </div>
                          <ChevronRight size={20} />
                        </button>
                      );
                    })}
                  </div>
                </section>
              </>
            )}
            {['tickets', 'mine'].includes(page) && (
              <section className="panel queue-panel">
                <div className="list-toolbar">
                  <label className="search queue-search">
                    <Search size={21} />
                    <input
                      aria-label={t('ค้นหาคำร้อง', 'Search requests')}
                      value={query}
                      onChange={(e) => Q(e.target.value)}
                      placeholder={t(
                        'ค้นหาเลขที่คำร้อง หัวข้อ หรืออุปกรณ์',
                        'Search ID, subject or asset',
                      )}
                    />
                    {query && <button onClick={() => Q('')}>{t('ล้าง', 'Clear')}</button>}
                  </label>
                  <label className="compact-field">
                    {t('สถานะ', 'Status')}
                    <select
                      aria-label={t('กรองสถานะ', 'Filter status')}
                      value={state}
                      onChange={(e) => F(e.target.value)}
                    >
                      <option value="all">{t('ทุกสถานะ', 'All statuses')}</option>
                      <option value="active">{t('อยู่ระหว่างดำเนินงาน', 'Active work')}</option>
                      {staff && <option value="sla">{t('เกิน SLA', 'SLA overdue')}</option>}
                      <option value="waiting">
                        {t('รอรับเรื่องหรือข้อมูล', 'New or waiting')}
                      </option>
                      {statuses.map((value) => (
                        <option key={value} value={value}>
                          {statusLabel(value, locale)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="compact-field">
                    {t('ความสำคัญ', 'Priority')}
                    <select
                      aria-label={t('กรองความสำคัญ', 'Filter priority')}
                      value={priority}
                      onChange={(e) => PF(e.target.value)}
                    >
                      <option value="all">{t('ทั้งหมด', 'All priorities')}</option>
                      {['เร่งด่วน', 'สูง', 'ปกติ', 'ต่ำ'].map((value) => (
                        <option value={value} key={value}>
                          {priorityLabel(value, locale)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="compact-field">
                    {t('หมวดหมู่', 'Category')}
                    <select
                      aria-label={t('กรองหมวดหมู่', 'Filter category')}
                      value={category}
                      onChange={(e) => CF(e.target.value)}
                    >
                      <option value="all">{t('ทุกหมวด', 'All categories')}</option>
                      {['อุปกรณ์', 'เครือข่าย', 'ซอฟต์แวร์', 'บัญชีและสิทธิ์', 'อื่น ๆ'].map(
                        (value) => (
                          <option key={value} value={value}>
                            {categoryLabel(value, locale)}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  {staff && page !== 'mine' && (
                    <label className="compact-field">
                      {t('การมอบหมาย', 'Assignment')}
                      <select value={assignment} onChange={(e) => AF(e.target.value)}>
                        <option value="all">{t('ทั้งหมด', 'All assignments')}</option>
                        <option value="unassigned">{t('ยังไม่มอบหมาย', 'Unassigned')}</option>
                        <option value="mine">{t('งานของฉัน', 'Assigned to me')}</option>
                      </select>
                    </label>
                  )}
                  <label className="compact-field">
                    {t('เรียงตาม', 'Sort by')}
                    <select
                      aria-label={t('เรียงคำร้อง', 'Sort requests')}
                      value={sort}
                      onChange={(e) => SO(e.target.value)}
                    >
                      <option value="newest">{t('ใหม่ที่สุด', 'Newest first')}</option>
                      <option value="oldest">{t('เก่าที่สุด', 'Oldest first')}</option>
                      <option value="priority">{t('ความสำคัญ', 'Priority')}</option>
                    </select>
                  </label>
                </div>
                <div className="filter-summary">
                  <span>
                    <Filter size={16} />
                    {filtered.length} {t('รายการที่ตรงกัน', 'matching requests')}
                  </span>
                  <button className="text-button" onClick={resetFilters}>
                    {t('ล้างตัวกรอง', 'Reset filters')}
                  </button>
                </div>
                {ticketList()}
                <div className="pagination">
                  <span>{t('แสดงครั้งละ 20 รายการ', '20 requests per page')}</span>
                  <div>
                    <button
                      className="secondary compact"
                      disabled={listPage <= 1}
                      onClick={() => LP(listPage - 1)}
                    >
                      {t('ก่อนหน้า', 'Previous')}
                    </button>
                    <span>
                      {Math.min(listPage, totalPages)} / {totalPages}
                    </span>
                    <button
                      className="secondary compact"
                      disabled={listPage >= totalPages}
                      onClick={() => LP(listPage + 1)}
                    >
                      {t('ถัดไป', 'Next')}
                    </button>
                  </div>
                </div>
              </section>
            )}
            {page === 'knowledge' && (
              <KnowledgeBase userId={user.id} staff={staff} onRequest={newRequest} />
            )}
            {page === 'users' && role === 'admin' && (
              <UserManagement onChanged={() => desk.reload()} />
            )}
            {page === 'settings' && (
              <AccountSettings
                user={user}
                role={role}
                onLogout={leave}
                onReplay={intro}
                safeToLeave={!pending}
              />
            )}
            {page === 'reports' && (
              <>
                <div className="report-grid">
                  <section className="panel report-panel">
                    <h2>{t('จำนวนคำร้องแยกตามสถานะ', 'Requests by status')}</h2>
                    <p>
                      {jobs.length} {t('คำร้องทั้งหมด', 'total requests')}
                    </p>
                    <div className="report-bars">
                      {statuses.map((value) => {
                        const count = jobs.filter((j) => j.status === value).length;
                        return (
                          <div className="report-bar-row" key={value}>
                            <span>{statusLabel(value, locale)}</span>
                            <div>
                              <i
                                style={{ width: (count / Math.max(1, jobs.length)) * 100 + '%' }}
                              />
                            </div>
                            <strong>{count}</strong>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  <section className="panel report-panel">
                    <h2>{t('สัดส่วนการแก้ไข', 'Resolution summary')}</h2>
                    <div
                      className="resolution-donut"
                      style={{
                        background: `conic-gradient(var(--primary) ${(jobs.filter((j) => ['แก้ไขแล้ว', 'ปิดงาน'].includes(j.status)).length / Math.max(1, jobs.length)) * 100}%, var(--surface-inset) 0)`,
                      }}
                    >
                      <div>
                        <strong>
                          {Math.round(
                            (jobs.filter((j) => ['แก้ไขแล้ว', 'ปิดงาน'].includes(j.status)).length /
                              Math.max(1, jobs.length)) *
                              100,
                          )}
                          %
                        </strong>
                        <span>{t('แก้ไขแล้วหรือปิดงาน', 'Resolved or closed')}</span>
                      </div>
                    </div>
                    <p className="center">
                      {t(
                        'ไม่รวมคำร้องที่ยกเลิกเป็นงานที่แก้ไขสำเร็จ',
                        'Cancelled requests do not count as resolved work.',
                      )}
                    </p>
                  </section>
                </div>
                {(() => {
                  const all = jobs.map((j) => slaOf(j)).filter((x) => x !== null);
                  const rate = (k: 'response' | 'resolve') => {
                    const done = all.filter((x) => ['met', 'missed'].includes(x[k].state));
                    const met = done.filter((x) => x[k].state === 'met').length;
                    return {
                      pct: done.length ? Math.round((met / done.length) * 100) : null,
                      met,
                      total: done.length,
                    };
                  };
                  const r1 = rate('response'),
                    r2 = rate('resolve'),
                    overdue = jobs.filter(slaBreached).length;
                  return (
                    <section className="panel report-panel sla-report">
                      <h2>{t('ผลการให้บริการตาม SLA', 'SLA performance')}</h2>
                      <div className="sla-report-grid">
                        {[
                          [t('ตอบกลับทันเวลา', 'Responded on time'), r1],
                          [t('แก้ไขเสร็จทันเวลา', 'Resolved on time'), r2],
                        ].map(([title, r]) => {
                          const v = r as { pct: number | null; met: number; total: number };
                          return (
                            <div key={String(title)}>
                              <span>{String(title)}</span>
                              <strong>{v.pct === null ? '—' : v.pct + '%'}</strong>
                              <small>
                                {v.met}/{v.total} {t('คำร้องที่ครบรอบแล้ว', 'completed requests')}
                              </small>
                            </div>
                          );
                        })}
                        <div className={overdue ? 'is-overdue' : ''}>
                          <span>{t('กำลังเกิน SLA', 'Currently overdue')}</span>
                          <strong>{overdue}</strong>
                          <small>{t('คำร้องที่ยังเปิดอยู่', 'open requests')}</small>
                        </div>
                      </div>
                      <table className="sla-targets">
                        <caption>
                          {t(
                            'เป้าหมายเวลา (นับต่อเนื่อง 24 ชม.)',
                            'Targets (calendar hours, 24/7)',
                          )}
                        </caption>
                        <thead>
                          <tr>
                            <th>{t('ความสำคัญ', 'Priority')}</th>
                            <th>{t('ตอบกลับภายใน', 'Respond within')}</th>
                            <th>{t('แก้ไขภายใน', 'Resolve within')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(SLA_TARGETS).map(([p, v]) => (
                            <tr key={p}>
                              <td>{priorityLabel(p, locale)}</td>
                              <td>{formatDuration(v.response * 3600_000, locale)}</td>
                              <td>{formatDuration(v.resolve * 3600_000, locale)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  );
                })()}
                <section className="panel report-panel category-report">
                  <h2>{t('คำร้องแยกตามหมวดหมู่', 'Requests by category')}</h2>
                  <div className="category-counts">
                    {['อุปกรณ์', 'เครือข่าย', 'ซอฟต์แวร์', 'บัญชีและสิทธิ์', 'อื่น ๆ'].map(
                      (cat) => (
                        <div key={cat}>
                          <span>{categoryLabel(cat, locale)}</span>
                          <strong>{jobs.filter((j) => j.category === cat).length}</strong>
                        </div>
                      ),
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
          <footer className="app-footer">
            <span>
              Flowdesk <span>·</span> {t('ศูนย์ช่วยเหลือ IT', 'IT Service Desk')}
            </span>
            <button className="text-button" onClick={intro}>
              <HelpCircle size={17} />
              {t('วิธีใช้งานเบื้องต้น', 'Getting started')}
            </button>
          </footer>
        </main>
      </div>
      <TicketForm
        open={creating}
        onClose={() => C(false)}
        user={user}
        seed={seed}
        onCreate={desk.create}
        onAttach={desk.attach}
        onRetry={desk.retry}
        status={status}
        error={error}
        onDone={(job, failed) => {
          C(false);
          go('tickets');
          S(job.id);
          T(
            failed
              ? t(
                  `สร้างคำร้องแล้ว แต่อัปโหลดรูปไม่สำเร็จ ${failed} รูป แนบใหม่ได้ในหน้ารายละเอียด`,
                  `Request created, but ${failed} image(s) failed to upload. Attach them again from the details.`,
                )
              : t('สร้างคำร้องสำเร็จ', 'Request created.'),
          );
        }}
      />
      <TicketDetails
        job={active}
        open={selected !== null}
        onClose={() => S(null)}
        user={user}
        role={role}
        agents={agents}
        canEdit={canEdit}
        saving={status === 'saving'}
        error={error}
        conflict={status === 'conflict'}
        onUpdate={desk.mutate}
        onAttach={desk.attach}
        onRefresh={desk.reload}
        onRetry={desk.retry}
      />
      <Onboarding open={tour} onClose={() => TO(false)} />
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={21} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label={t('ปิดข้อความ', 'Dismiss message')}
            onClick={() => T('')}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
