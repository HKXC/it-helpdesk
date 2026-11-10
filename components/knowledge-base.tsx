'use client';
import { useEffect, useState } from 'react';
import {
  Search,
  BookOpen,
  Bookmark,
  ArrowRight,
  Clock,
  ExternalLink,
  Plus,
  CheckCircle2,
  Network,
  Monitor,
  ShieldCheck,
  Users,
  Settings2,
  FileText,
  Link,
} from 'lucide-react';
import {
  knowledge,
  knowledgeCategories,
  type Article,
  type KnowledgeCategory,
} from '../lib/knowledge';
import { useUi } from './ui-provider';
import { Dialog } from './dialog';
const icons = {
  'getting-started': BookOpen,
  accounts: Users,
  network: Network,
  hardware: Monitor,
  software: Settings2,
  security: ShieldCheck,
  'it-operations': FileText,
};
export default function KnowledgeBase({
  userId,
  staff,
  onRequest,
}: {
  userId: string;
  staff: boolean;
  onRequest: (title?: string, category?: string) => void;
}) {
  const { t, pick } = useUi();
  const [query, Q] = useState(''),
    [category, C] = useState<KnowledgeCategory | 'all'>('all'),
    [savedOnly, F] = useState(false),
    [saved, S] = useState<string[]>([]),
    [ready, R] = useState(false),
    [selected, A] = useState<Article | null>(null),
    [copied, P] = useState(false);
  const available = knowledge.filter((a) => !a.staffOnly || staff);
  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem('flowdesk-kb:' + userId) || '[]');
      if (Array.isArray(data))
        S(data.filter((v: unknown) => typeof v === 'string' && knowledge.some((a) => a.id === v)));
    } catch {}
    R(true);
    const id = new URLSearchParams(location.search).get('article');
    const article = knowledge.find((a) => a.id === id && (!a.staffOnly || staff));
    if (article) A(article);
  }, [userId, staff]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem('flowdesk-kb:' + userId, JSON.stringify(saved));
      } catch {}
  }, [saved, ready, userId]);
  const visible = available.filter(
    (a) =>
      (category === 'all' || a.category === category) &&
      (!savedOnly || saved.includes(a.id)) &&
      [...a.title, ...a.summary, ...a.steps.flatMap((s) => [...s.title, ...s.body])]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  function toggle(id: string) {
    S((current) => (current.includes(id) ? current.filter((v) => v !== id) : [...current, id]));
  }
  function close() {
    A(null);
    P(false);
    const url = new URL(location.href);
    url.searchParams.delete('article');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  async function copy() {
    if (!selected) return;
    const url = new URL(location.href);
    url.searchParams.set('article', selected.id);
    try {
      await navigator.clipboard.writeText(url.href);
      P(true);
      setTimeout(() => P(false), 2200);
    } catch {
      P(false);
    }
  }
  function request() {
    if (!selected) return;
    const map: Record<string, string> = {
      network: 'เครือข่าย',
      hardware: 'อุปกรณ์',
      software: 'ซอฟต์แวร์',
      accounts: 'บัญชีและสิทธิ์',
      security: 'บัญชีและสิทธิ์',
    };
    const title = pick(selected.title),
      cat = map[selected.category] || 'อื่น ๆ';
    close();
    onRequest(title, cat);
  }
  function card(article: Article) {
    const Icon = icons[article.category];
    return (
      <article className="knowledge-card" key={article.id}>
        <div className="knowledge-card-top">
          <span className="topic-icon">
            <Icon size={23} />
          </span>
          <button
            className={'icon-button ' + (saved.includes(article.id) ? 'bookmarked' : '')}
            aria-label={
              saved.includes(article.id)
                ? t('ยกเลิกบันทึกบทความ', 'Remove saved article')
                : t('บันทึกบทความ', 'Save article')
            }
            aria-pressed={saved.includes(article.id)}
            onClick={() => toggle(article.id)}
          >
            <Bookmark size={20} fill={saved.includes(article.id) ? 'currentColor' : 'none'} />
          </button>
        </div>
        <span className="topic-label">
          {pick(knowledgeCategories.find((c) => c.id === article.category)!.label)}
        </span>
        <h3>
          <button
            onClick={() => {
              A(article);
              P(false);
            }}
          >
            {pick(article.title)}
          </button>
        </h3>
        <p>{pick(article.summary)}</p>
        <div className="knowledge-card-footer">
          <span>
            <Clock size={15} />
            {article.minutes} {t('นาที', 'min')}
          </span>
          <button
            className="text-button"
            onClick={() => {
              A(article);
              P(false);
            }}
          >
            {t('อ่านคำแนะนำ', 'Read guide')}
            <ArrowRight size={17} />
          </button>
        </div>
      </article>
    );
  }
  return (
    <div className="knowledge-page">
      <section className="knowledge-hero">
        <div>
          <span className="eyebrow">{t('คำตอบและคู่มือใช้งาน', 'ANSWERS & PRACTICAL GUIDES')}</span>
          <h2>{t('ค้นวิธีแก้ปัญหา เริ่มจากตรงนี้', 'Find your next step here')}</h2>
          <p>
            {t(
              'คู่มือเป็นขั้นตอนสำหรับการใช้งาน Flowdesk และปัญหา IT ที่พบบ่อย',
              'Step-by-step Flowdesk help and practical guides for common IT issues.',
            )}
          </p>
        </div>
        <label className="search knowledge-search">
          <Search size={21} />
          <input
            value={query}
            onChange={(e) => Q(e.target.value)}
            aria-label={t('ค้นหาคลังความรู้', 'Search knowledge base')}
            placeholder={t(
              'ค้นหา เช่น Wi-Fi, รหัสผ่าน, เครื่องพิมพ์',
              'Search Wi-Fi, password, printer…',
            )}
          />
          {query && (
            <button type="button" onClick={() => Q('')}>
              {t('ล้าง', 'Clear')}
            </button>
          )}
        </label>
      </section>
      <div className="knowledge-layout">
        <aside
          className="knowledge-categories"
          aria-label={t('หมวดคลังความรู้', 'Knowledge categories')}
        >
          <h3>{t('หมวดหมู่', 'Categories')}</h3>
          <button
            className={category === 'all' && !savedOnly ? 'selected' : ''}
            onClick={() => {
              C('all');
              F(false);
            }}
          >
            <BookOpen size={18} />
            <span>{t('ทั้งหมด', 'All guides')}</span>
            <b>{available.length}</b>
          </button>
          {knowledgeCategories
            .filter((c) => c.id !== 'it-operations' || staff)
            .map((cat) => {
              const Icon = icons[cat.id];
              return (
                <button
                  key={cat.id}
                  className={category === cat.id && !savedOnly ? 'selected' : ''}
                  onClick={() => {
                    C(cat.id);
                    F(false);
                  }}
                >
                  <Icon size={18} />
                  <span>{pick(cat.label)}</span>
                  <b>{available.filter((a) => a.category === cat.id).length}</b>
                </button>
              );
            })}
          <div className="category-divider" />
          <button
            className={savedOnly ? 'selected' : ''}
            onClick={() => {
              C('all');
              F(true);
            }}
          >
            <Bookmark size={18} />
            <span>{t('ที่บันทึกไว้', 'Saved guides')}</span>
            <b>{available.filter((a) => saved.includes(a.id)).length}</b>
          </button>
          <small>
            {t(
              'บทความที่บันทึกไว้จะจดจำบนอุปกรณ์นี้',
              'Saved guides are remembered on this device.',
            )}
          </small>
        </aside>
        <div className="knowledge-results">
          {category === 'all' && !query && !savedOnly && (
            <section className="recommended-section">
              <div className="section-title">
                <div>
                  <h2>{t('แนะนำให้อ่านก่อนเริ่มใช้งาน', 'Recommended before you start')}</h2>
                  <p>
                    {t(
                      'เริ่มจากคู่มือเหล่านี้เพื่อแจ้งปัญหาและติดตามงานได้สะดวกขึ้น',
                      'Start here to make requesting and following support easier.',
                    )}
                  </p>
                </div>
              </div>
              <div className="recommended-list">
                {available
                  .filter((a) => a.recommended)
                  .slice(0, 3)
                  .map((a, i) => (
                    <button key={a.id} onClick={() => A(a)}>
                      <span className="guide-number">{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>{pick(a.title)}</strong>
                        <small>{pick(a.summary)}</small>
                      </div>
                      <ArrowRight size={20} />
                    </button>
                  ))}
              </div>
            </section>
          )}
          <div className="section-title knowledge-result-heading">
            <h2>
              {savedOnly
                ? t('บทความที่บันทึกไว้', 'Saved guides')
                : category === 'all'
                  ? t('คู่มือทั้งหมด', 'All guides')
                  : pick(knowledgeCategories.find((c) => c.id === category)!.label)}
            </h2>
            <span className="result-count">
              {visible.length} {t('บทความ', 'guides')}
            </span>
          </div>
          <div className="knowledge-grid">{visible.map(card)}</div>
          {!visible.length && (
            <div className="empty-state panel">
              <Search size={34} />
              <h3>{t('ไม่พบบทความที่ตรงกัน', 'No matching guides')}</h3>
              <p>
                {t(
                  'ลองใช้คำค้นสั้นลง เลือกหมวดอื่น หรือแจ้งปัญหากับทีม IT',
                  'Try a shorter search, choose another category or ask IT for help.',
                )}
              </p>
              <button
                className="secondary"
                onClick={() => {
                  Q('');
                  C('all');
                  F(false);
                }}
              >
                {t('ล้างตัวกรอง', 'Clear filters')}
              </button>
            </div>
          )}
        </div>
      </div>
      <Dialog
        open={Boolean(selected)}
        onClose={close}
        title={selected ? pick(selected.title) : t('บทความช่วยเหลือ', 'Help article')}
        className="article-dialog"
      >
        {selected && (
          <div className="article-reader">
            <div className="article-meta">
              <span className="badge neutral">
                {pick(knowledgeCategories.find((c) => c.id === selected.category)!.label)}
              </span>
              <span>
                <Clock size={16} />
                {selected.minutes} {t('นาที', 'min')}
              </span>
              <div className="article-meta-actions">
                <button className="secondary compact" onClick={() => toggle(selected.id)}>
                  <Bookmark
                    size={17}
                    fill={saved.includes(selected.id) ? 'currentColor' : 'none'}
                  />
                  {saved.includes(selected.id) ? t('บันทึกแล้ว', 'Saved') : t('บันทึก', 'Save')}
                </button>
                <button className="secondary compact" onClick={() => copy()}>
                  <Link size={17} />
                  {copied ? t('คัดลอกแล้ว', 'Copied') : t('คัดลอกลิงก์', 'Copy link')}
                </button>
              </div>
            </div>
            <p className="article-intro">{pick(selected.summary)}</p>
            <ol className="article-steps">
              {selected.steps.map((step, i) => (
                <li key={i}>
                  <span>{i + 1}</span>
                  <div>
                    <h3>{pick(step.title)}</h3>
                    <p>{pick(step.body)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <section className="article-note">
              <ShieldCheck size={22} />
              <div>
                <h3>{t('สิ่งที่ควรทราบ', 'Good to know')}</h3>
                <p>{pick(selected.note)}</p>
              </div>
            </section>
            <section className="article-escalation">
              <h3>
                {t('หากยังแก้ไขไม่ได้ ให้แจ้งข้อมูลนี้', 'Still need help? Include these details')}
              </h3>
              <p>{pick(selected.escalate)}</p>
              <button className="primary" onClick={request}>
                <Plus size={18} />
                {t('แจ้งปัญหาจากบทความนี้', 'Create a request from this guide')}
              </button>
            </section>
            {selected.source && (
              <a
                className="source-link"
                href={selected.source.url}
                target="_blank"
                rel="noreferrer"
              >
                {selected.source.title}
                <ExternalLink size={16} />
              </a>
            )}
            <div className="article-footer-note">
              <CheckCircle2 size={18} />
              {t(
                'ขั้นตอนอาจต่างกันตามอุปกรณ์และนโยบายขององค์กร ใช้แนวทางที่บริษัทอนุญาตเป็นหลัก',
                'Steps can vary by device and company policy. Follow your organization’s approved guidance.',
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
