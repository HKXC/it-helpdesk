import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { hashPassword } from '../lib/passwords.ts';
// LOCAL TEST FIXTURE ONLY. This never creates or modifies accounts on the hosted site.
const origin = 'http://127.0.0.1:5174',
  qaPassword = 'Local-QA-Only-2026-Flowdesk!',
  qaEmail = 'qa-root@example.test';
fs.mkdirSync('.sites-runtime', { recursive: true });
const fixture = '.sites-runtime/qa-root.sql';
const hash = await hashPassword(qaPassword);
fs.writeFileSync(
  fixture,
  `INSERT INTO accounts(id,email,name,password_hash,created_at,role,active,version,legacy_migrated) VALUES('qa-root','${qaEmail}','QA Admin','${hash}',${Date.now()},'admin',1,0,1) ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash,role='admin',active=1;`,
);
execFileSync(
  process.execPath,
  [
    '--import',
    './scripts/sites-env.mjs',
    './node_modules/wrangler/bin/wrangler.js',
    'd1',
    'execute',
    'DB',
    '--local',
    '--config',
    'dist/server/wrangler.json',
    '--persist-to',
    '.wrangler/state',
    '--file',
    fixture,
  ],
  { encoding: 'utf8', timeout: 25000 },
);
fs.unlinkSync(fixture);
function req(path, method = 'GET', body, cookie = '', extra = {}) {
  const headers = { 'Content-Type': 'application/json', Origin: origin, ...extra };
  if (cookie) headers.Cookie = cookie;
  const args = ['--max-time', '20', '-sS', '-i', '-X', method, '-w', '\n%{http_code}'];
  for (const [k, v] of Object.entries(headers)) args.push('-H', k + ': ' + v);
  if (body !== undefined) args.push('--data-binary', '@-');
  args.push(origin + path);
  const text = execFileSync(process.platform === 'win32' ? 'curl.exe' : 'curl', args, {
    encoding: 'utf8',
    input: body === undefined ? undefined : JSON.stringify(body),
  });
  const end = text.lastIndexOf('\n'),
    raw = text.slice(0, end),
    cut = raw.indexOf('\r\n\r\n');
  const setCookie = raw.slice(0, cut).match(/set-cookie:\s*([^\r\n]+)/i)?.[1] || '';
  return {
    status: Number(text.slice(end + 1)),
    data: JSON.parse(raw.slice(cut + 4)),
    cookie: setCookie.split(';')[0],
    setCookie,
  };
}
function login(email, password) {
  const r = req('/api/auth/login', 'POST', { email, password, remember: true });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r;
}
function signup(prefix) {
  const email = prefix + '-' + randomUUID() + '@example.test',
    password = randomBytes(24).toString('base64url');
  const r = req('/api/auth/register', 'POST', {
    name: prefix + ' Test',
    email,
    password,
    confirmPassword: password,
    role: 'admin',
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.user.role, 'employee', 'signup cannot grant admin');
  return { ...r, email, password, id: r.data.user.id };
}
const admin = login(qaEmail, qaPassword);
assert.equal(admin.data.user.role, 'admin');
assert.match(admin.setCookie, /HttpOnly/);
assert.match(admin.setCookie, /SameSite=Lax/);
const employee = signup('Employee'),
  other = signup('Other'),
  it = signup('IT');
assert.equal(req('/api/helpdesk').status, 401);
assert.equal(req('/api/admin/users', 'GET', undefined, employee.cookie).status, 403);
assert.equal(
  req('/api/auth/session', 'GET', undefined, '', {
    'oai-authenticated-user-id': 'qa-root',
    'oai-authenticated-user-email': qaEmail,
  }).status,
  401,
);
let users = req('/api/admin/users', 'GET', undefined, admin.cookie);
assert.equal(users.status, 200);
assert.equal(
  users.data.users.some((u) => 'password_hash' in u),
  false,
);
let target = users.data.users.find((u) => u.id === it.id);
let result = req(
  '/api/admin/users',
  'PATCH',
  { id: it.id, version: target.version, role: 'it', active: 1 },
  admin.cookie,
);
assert.equal(result.status, 200, JSON.stringify(result.data));
assert.equal(
  req('/api/auth/session', 'GET', undefined, it.cookie).status,
  401,
  'role change revokes stale sessions',
);
const staff = login(it.email, it.password);
assert.equal(staff.data.user.role, 'it');
assert.equal(req('/api/admin/users', 'GET', undefined, staff.cookie).status, 403);
assert.equal(
  req(
    '/api/admin/users',
    'PATCH',
    { id: 'qa-root', version: 0, role: 'employee', active: 0 },
    admin.cookie,
  ).status,
  403,
  'root/self account protected',
);
const job = {
  id: 1029,
  title: 'ทดสอบการแบ่งสิทธิ์',
  category: 'อุปกรณ์',
  status: 'ปิดงาน',
  priority: 'ปกติ',
  person: 'ปลอมชื่อ',
  agent: 'QA Admin',
  detail: 'คำร้องสำหรับทดสอบสิทธิ์',
  comments: [],
};
const requestId = randomUUID();
result = req('/api/tickets', 'POST', { job, requestId }, employee.cookie);
assert.equal(result.status, 201, JSON.stringify(result.data));
let ticket = result.data.job;
assert.equal(
  req('/api/tickets', 'POST', { job, requestId }, employee.cookie).data.job.id,
  ticket.id,
  'retried creation is idempotent',
);
assert.equal(ticket.requesterId, employee.id);
assert.equal(ticket.status, 'เปิดใหม่');
assert.equal(ticket.agent, 'ยังไม่มอบหมาย');
assert.equal(ticket.person, 'Employee Test');
assert.equal(
  req('/api/helpdesk', 'GET', undefined, other.cookie).data.jobs.some((j) => j.id === ticket.id),
  false,
);
function patch(p, cookie, reason = 'ทดสอบ') {
  return req(
    '/api/tickets/' + ticket.id,
    'PATCH',
    { revision: ticket.revision, patch: p, reason },
    cookie,
  );
}
assert.equal(patch({ status: 'กำลังดำเนินการ' }, employee.cookie).status, 403);
assert.equal(patch({ assigneeId: it.id }, employee.cookie).status, 403);
assert.equal(patch({ status: 'ยกเลิก' }, other.cookie).status, 404);
assert.equal(
  req('/api/helpdesk', 'GET', undefined, staff.cookie).data.jobs.some((j) => j.id === ticket.id),
  true,
  'IT sees shared queue',
);
result = patch({ assigneeId: it.id }, staff.cookie);
assert.equal(result.status, 200);
ticket = result.data.job;
assert.equal(ticket.assigneeId, it.id);
const stale = ticket.revision;
result = patch({ status: 'กำลังดำเนินการ' }, staff.cookie);
assert.equal(result.status, 200);
ticket = result.data.job;
assert.equal(
  req(
    '/api/tickets/' + ticket.id,
    'PATCH',
    { revision: stale, patch: { comments: ['stale'] }, reason: '' },
    employee.cookie,
  ).status,
  409,
);
result = patch({ comments: [...ticket.comments, 'ข้อมูลเพิ่มเติมจากผู้แจ้ง'] }, employee.cookie);
assert.equal(result.status, 200);
ticket = result.data.job;
assert.match(ticket.comments.at(-1), /Employee Test/);
assert.equal(patch({ comments: ['แก้ไขข้อความเดิม'] }, employee.cookie).status, 400);
assert.equal(patch({ status: 'แก้ไขแล้ว', resolution: 'แก้เอง' }, employee.cookie).status, 403);
result = patch({ status: 'แก้ไขแล้ว', resolution: 'ทดสอบและแก้ไขเรียบร้อย' }, staff.cookie);
assert.equal(result.status, 200);
ticket = result.data.job;
assert.equal(patch({ status: 'ปิดงาน', rating: 5 }, staff.cookie).status, 403);
result = patch({ status: 'ปิดงาน', rating: 5 }, employee.cookie);
assert.equal(result.status, 200);
ticket = result.data.job;
assert.equal(patch({ status: 'เปิดใหม่' }, employee.cookie, '').status, 400);
result = patch({ status: 'เปิดใหม่' }, employee.cookie, 'ยังพบปัญหาเดิม');
assert.equal(result.status, 200);
ticket = result.data.job;
assert.equal(ticket.rating, undefined);
assert.equal(ticket.history.at(-1).actor, 'Employee Test');
users = req('/api/admin/users', 'GET', undefined, admin.cookie);
target = users.data.users.find((u) => u.id === other.id);
result = req(
  '/api/admin/users',
  'PATCH',
  { id: other.id, version: target.version, role: 'employee', active: 0 },
  admin.cookie,
);
assert.equal(result.status, 200);
assert.equal(
  req('/api/auth/session', 'GET', undefined, other.cookie).status,
  401,
  'disabled account loses access',
);
assert.equal(
  req('/api/auth/login', 'POST', { email: other.email, password: other.password }).status,
  401,
);
assert.equal(
  req(
    '/api/admin/users',
    'PATCH',
    { id: other.id, version: target.version, role: 'it', active: 1 },
    admin.cookie,
  ).status,
  409,
  'stale role changes rejected',
);
assert.equal(req('/api/admin/users', 'GET', undefined, admin.cookie).data.audit.length > 0, true);

// Upgrade a legacy per-account snapshot exactly once, preserving its original reference in history.
const legacy = {
  ...job,
  id: 9999,
  title: 'Legacy migration check',
  status: 'เปิดใหม่',
  person: 'Employee Test',
};
const payload = JSON.stringify([legacy]).replaceAll("'", "''");
fs.writeFileSync(
  fixture,
  `UPDATE accounts SET legacy_migrated=0 WHERE id='${employee.id}'; INSERT INTO helpdesk_workspaces(owner_id,payload,revision,updated_at) VALUES('${employee.id}','${payload}',0,'${new Date().toISOString()}');`,
);
execFileSync(
  process.execPath,
  [
    '--import',
    './scripts/sites-env.mjs',
    './node_modules/wrangler/bin/wrangler.js',
    'd1',
    'execute',
    'DB',
    '--local',
    '--config',
    'dist/server/wrangler.json',
    '--persist-to',
    '.wrangler/state',
    '--file',
    fixture,
  ],
  { encoding: 'utf8', timeout: 25000 },
);
fs.unlinkSync(fixture);
let migrated = req('/api/helpdesk', 'GET', undefined, employee.cookie);
assert.equal(migrated.data.jobs.filter((j) => j.title === 'Legacy migration check').length, 1);
migrated = req('/api/helpdesk', 'GET', undefined, employee.cookie);
assert.equal(
  migrated.data.jobs.filter((j) => j.title === 'Legacy migration check').length,
  1,
  'legacy migration is idempotent',
);
assert.match(
  migrated.data.jobs.find((j) => j.title === 'Legacy migration check').history.at(-1).text,
  /9999/,
);

assert.equal(req('/api/auth/logout', 'POST', {}, employee.cookie).status, 200);
assert.equal(req('/api/helpdesk', 'GET', undefined, employee.cookie).status, 401);
assert.equal(
  req('/api/auth/login', 'POST', { email: it.email, password: it.password }, '', {
    Origin: 'https://other.example',
  }).status,
  403,
);
console.log(
  'PASS: signup cannot escalate roles; employee isolation; shared IT queue; server-enforced actions; assignment; requester closure/reopen; immutable history; root protection; role audit; disabled-user and changed-role session revocation; concurrency and CSRF',
);
