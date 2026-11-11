// Seed demo accounts and tickets into Supabase for presentations.
// Usage: node scripts/seed-demo.mjs
// Reads SUPABASE_URL / SUPABASE_SECRET_KEY from .env.local (or the environment).
// Replaces only accounts with @demo.test emails and their tickets.
// Password: DEMO_PASSWORD if set, otherwise a new random one; written to demo-accounts.txt (gitignored).
import fs from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from '../lib/passwords.ts';

const env = { ...process.env };
if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].trim();
  }
}
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local');
const headers = { apikey: key, authorization: 'Bearer ' + key, 'content-type': 'application/json' };
async function rest(method, path, body) {
  const r = await fetch(url + '/rest/v1/' + path, {
    method,
    headers: { ...headers, prefer: 'return=representation' },
    body: body && JSON.stringify(body),
  });
  if (!r.ok) throw Error(method + ' ' + path + ' → ' + r.status + ' ' + (await r.text()));
  return r.status === 204 ? [] : r.json();
}

const password = env.DEMO_PASSWORD || 'Demo-' + randomBytes(6).toString('base64url');
const people = [
  { key: 'admin', name: 'สมชาย ผู้ดูแลระบบ', role: 'admin', dept: 'IT' },
  { key: 'it1', name: 'วิภา ฝ่ายไอที', role: 'it', dept: 'IT' },
  { key: 'it2', name: 'ธนา ฝ่ายไอที', role: 'it', dept: 'IT' },
  { key: 'staff1', name: 'มานี บัญชี', role: 'employee', dept: 'บัญชี' },
  { key: 'staff2', name: 'ปิติ การตลาด', role: 'employee', dept: 'การตลาด' },
  { key: 'staff3', name: 'ชูใจ บุคคล', role: 'employee', dept: 'ทรัพยากรบุคคล' },
];

// Remove previous demo data.
const old = await rest('GET', 'flowdesk_accounts?select=id&email=like.*%40demo.test');
const oldIds = old.map((a) => a.id);
if (oldIds.length) {
  const list = '(' + oldIds.map((id) => '"' + id + '"').join(',') + ')';
  await rest('DELETE', 'flowdesk_it_tickets?requester_id=in.' + list);
  await rest('DELETE', 'flowdesk_account_sessions?account_id=in.' + list);
  await rest('DELETE', 'flowdesk_role_audit?target_id=in.' + list);
  await rest('DELETE', 'flowdesk_accounts?id=in.' + list);
}

const hash = await hashPassword(password);
const now = Date.now();
const acct = {};
for (const p of people) {
  const id = 'account:' + randomUUID();
  acct[p.key] = { ...p, id, email: p.key + '@demo.test' };
  await rest('POST', 'flowdesk_accounts', {
    id,
    email: p.key + '@demo.test',
    name: p.name,
    password_hash: hash,
    created_at: now,
    role: p.role,
    active: 1,
    version: 0,
    legacy_migrated: 1,
    locale: 'th',
    theme: 'system',
    onboarding_completed: 1,
  });
}

const hours = (h) => new Date(now - h * 3600_000).toISOString();
const tickets = [
  {
    by: 'staff1',
    title: 'เครื่องพิมพ์ห้องบัญชีขึ้น Offline',
    cat: 'อุปกรณ์',
    pri: 'สูง',
    status: 'เปิดใหม่',
    age: 1,
    loc: 'อาคาร A ชั้น 2',
    asset: 'PR-201',
    detail: 'สั่งพิมพ์ไม่ออกตั้งแต่เช้า ลองปิดเปิดเครื่องแล้ว ทั้งแผนกพิมพ์ใบแจ้งหนี้ไม่ได้',
  },
  {
    by: 'staff2',
    title: 'Wi-Fi ห้องประชุมใหญ่หลุดบ่อย',
    cat: 'เครือข่าย',
    pri: 'ปกติ',
    status: 'เปิดใหม่',
    age: 3,
    loc: 'ห้องประชุม 1',
    detail: 'เชื่อมต่อได้ประมาณ 5 นาทีแล้วหลุด เป็นทุกเครื่องในห้อง',
  },
  {
    by: 'staff3',
    title: 'ขอสิทธิ์เข้าโฟลเดอร์ HR บน Drive',
    cat: 'บัญชีและสิทธิ์',
    pri: 'ต่ำ',
    status: 'เปิดใหม่',
    age: 6,
    loc: 'อาคาร B ชั้น 3',
    detail: 'พนักงานใหม่ต้องการสิทธิ์อ่านโฟลเดอร์ HR-2026',
  },
  {
    by: 'staff1',
    title: 'โปรแกรมบัญชีเปิดไม่ได้หลังอัปเดต',
    cat: 'ซอฟต์แวร์',
    pri: 'เร่งด่วน',
    status: 'กำลังดำเนินการ',
    age: 5,
    to: 'it1',
    loc: 'อาคาร A ชั้น 2',
    asset: 'NB-024',
    detail: 'ขึ้น error 0x80070005 ตอนเปิดโปรแกรม ต้องปิดงบสิ้นเดือนวันนี้',
    comments: ['IT: กำลังตรวจสอบสิทธิ์ไฟล์ติดตั้ง จะติดต่อกลับภายใน 30 นาที'],
  },
  {
    by: 'staff2',
    title: 'จอคอมกระพริบ',
    cat: 'อุปกรณ์',
    pri: 'ปกติ',
    status: 'กำลังดำเนินการ',
    age: 20,
    to: 'it2',
    loc: 'อาคาร B ชั้น 1',
    asset: 'MN-118',
    detail: 'จอกระพริบเป็นช่วง ๆ โดยเฉพาะตอนเปิดไฟล์วิดีโอ',
  },
  {
    by: 'staff3',
    title: 'อีเมลส่งออกไม่ได้',
    cat: 'ซอฟต์แวร์',
    pri: 'สูง',
    status: 'รอข้อมูล',
    age: 26,
    to: 'it1',
    loc: 'อาคาร B ชั้น 3',
    detail: 'ส่งอีเมลหาลูกค้าภายนอกแล้วเด้งกลับ',
    comments: ['IT: รบกวนส่งภาพหน้าจอข้อความที่เด้งกลับมาด้วยครับ'],
  },
  {
    by: 'staff1',
    title: 'ลืมรหัสผ่านเข้าเครื่อง',
    cat: 'บัญชีและสิทธิ์',
    pri: 'สูง',
    status: 'แก้ไขแล้ว',
    age: 48,
    to: 'it2',
    loc: 'อาคาร A ชั้น 2',
    detail: 'ล็อกอินผิดหลายครั้งจนบัญชีถูกล็อก',
    resolution: 'ปลดล็อกบัญชีและให้ตั้งรหัสผ่านใหม่ที่หน้าเครื่องแล้ว',
  },
  {
    by: 'staff2',
    title: 'ติดตั้งโปรแกรมออกแบบ',
    cat: 'ซอฟต์แวร์',
    pri: 'ต่ำ',
    status: 'ปิดงาน',
    age: 96,
    to: 'it1',
    loc: 'อาคาร B ชั้น 1',
    detail: 'ขอติดตั้งโปรแกรมออกแบบสำหรับทำสื่อโฆษณา',
    resolution: 'ติดตั้งและเปิดใช้งาน license ของบริษัทแล้ว',
    rating: 5,
  },
  {
    by: 'staff3',
    title: 'เมาส์เสีย',
    cat: 'อุปกรณ์',
    pri: 'ต่ำ',
    status: 'ปิดงาน',
    age: 120,
    to: 'it2',
    loc: 'อาคาร B ชั้น 3',
    detail: 'เมาส์คลิกขวาไม่ทำงาน',
    resolution: 'เปลี่ยนเมาส์ใหม่ให้แล้ว',
    rating: 4,
  },
  {
    by: 'staff1',
    title: 'ขอเปลี่ยนแป้นพิมพ์',
    cat: 'อุปกรณ์',
    pri: 'ต่ำ',
    status: 'ยกเลิก',
    age: 72,
    loc: 'อาคาร A ชั้น 2',
    detail: 'แป้นพิมพ์บางปุ่มติด',
    comments: ['ผู้แจ้ง: ทำความสะอาดแล้วใช้ได้ปกติ ขอยกเลิกครับ'],
  },
];

for (const [i, t] of tickets.entries()) {
  const requester = acct[t.by];
  const agent = t.to ? acct[t.to] : null;
  const created = hours(t.age);
  const updated = hours(Math.max(0, t.age - 1));
  const history = [{ at: created, actor: requester.name, text: 'สร้างคำร้อง' }];
  if (agent)
    history.push({
      at: updated,
      actor: agent.name,
      text: 'รับเรื่องและเปลี่ยนสถานะเป็น ' + t.status,
    });
  const body = {
    id: 1,
    title: t.title,
    category: t.cat,
    status: t.status,
    priority: t.pri,
    person: requester.name,
    agent: agent ? agent.name : 'ยังไม่มอบหมาย',
    detail: t.detail,
    comments: t.comments || [],
    department: requester.dept,
    location: t.loc,
    asset: t.asset || '',
    contact: requester.email,
    createdAt: created,
    updatedAt: updated,
    history,
    ...(t.resolution ? { resolution: t.resolution } : {}),
    ...(t.rating ? { rating: t.rating } : {}),
  };
  await rest('POST', 'flowdesk_it_tickets', {
    requester_id: requester.id,
    assignee_id: agent ? agent.id : null,
    body: JSON.stringify(body),
    revision: 1,
    created_at: now - t.age * 3600_000,
    updated_at: now - Math.max(0, t.age - 1) * 3600_000,
    legacy_key: 'demo:' + (i + 1) + ':' + randomUUID(),
  });
}

const lines = [
  'Flowdesk demo accounts (local/demo use only — do not commit)',
  'Password for every account: ' + password,
  '',
  ...people.map((p) => `${p.role.padEnd(9)} ${p.key}@demo.test  (${p.name})`),
  '',
  'ROOT_ADMIN_ID=' + acct.admin.id,
];
fs.writeFileSync('demo-accounts.txt', lines.join('\n') + '\n');
console.log(`Seeded ${people.length} accounts and ${tickets.length} tickets.`);
console.log('Login details written to demo-accounts.txt');
console.log('Admin account id (for ROOT_ADMIN_ID): ' + acct.admin.id);
