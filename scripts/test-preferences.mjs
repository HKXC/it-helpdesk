import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const origin = 'http://127.0.0.1:5174';
function req(path, method = 'GET', body, cookie = '', extra = {}) {
  const args = ['--max-time', '20', '-sS', '-i', '-X', method, '-w', '\n%{http_code}'];
  for (const [k, v] of Object.entries({
    'Content-Type': 'application/json',
    Origin: origin,
    ...extra,
    ...(cookie ? { Cookie: cookie } : {}),
  }))
    args.push('-H', k + ': ' + v);
  if (body !== undefined) args.push('--data-binary', '@-');
  args.push(origin + path);
  const text = execFileSync('curl.exe', args, {
    encoding: 'utf8',
    input: body === undefined ? undefined : JSON.stringify(body),
  });
  const end = text.lastIndexOf('\n'),
    raw = text.slice(0, end),
    cut = raw.indexOf('\r\n\r\n');
  return {
    status: Number(text.slice(end + 1)),
    data: JSON.parse(raw.slice(cut + 4)),
    cookie: (raw.slice(0, cut).match(/set-cookie:\s*([^;\r\n]+)/i) || [])[1] || '',
  };
}
const email = 'prefs-' + randomUUID() + '@example.test',
  password = 'Local-Test-Password-2026!',
  next = 'Local-Changed-Password-2026!';
let r = req('/api/auth/register', 'POST', {
  name: 'Preference Test',
  email,
  password,
  confirmPassword: password,
  locale: 'en',
  theme: 'dark',
});
assert.equal(r.status, 201, JSON.stringify(r));
let cookie = r.cookie;
assert.equal(r.data.user.locale, 'en');
assert.equal(r.data.user.onboardingCompleted, false);
assert.equal(req('/api/account/preferences').status, 401);
assert.equal(req('/api/account/preferences', 'PATCH', { role: 'admin' }, cookie).status, 400);
assert.equal(
  req('/api/account/preferences', 'PATCH', { id: 'qa-root', locale: 'th' }, cookie).status,
  400,
);
assert.equal(req('/api/account/preferences', 'PATCH', { locale: 'jp' }, cookie).status, 400);
assert.equal(
  req('/api/account/preferences', 'PATCH', { locale: 'th' }, cookie, {
    Origin: 'https://evil.test',
  }).status,
  403,
);
assert.equal(
  req(
    '/api/account/preferences',
    'PATCH',
    { locale: 'th', theme: 'light', onboardingCompleted: true },
    cookie,
  ).status,
  200,
);
r = req('/api/auth/session', 'GET', undefined, cookie);
assert.equal(r.data.user.locale, 'th');
assert.equal(r.data.user.theme, 'light');
assert.equal(r.data.user.onboardingCompleted, true);
assert.equal(r.data.user.role, 'employee');
const second = req('/api/auth/login', 'POST', { email, password }).cookie;
assert.equal(
  req(
    '/api/auth/password',
    'POST',
    { currentPassword: 'wrong', newPassword: next, confirmPassword: next },
    cookie,
  ).status,
  400,
);
assert.equal(
  req(
    '/api/auth/password',
    'POST',
    { currentPassword: password, newPassword: next, confirmPassword: 'mismatch' },
    cookie,
  ).status,
  400,
);
r = req(
  '/api/auth/password',
  'POST',
  { currentPassword: password, newPassword: next, confirmPassword: next },
  cookie,
);
assert.equal(r.status, 200, JSON.stringify(r));
const renewed = r.cookie;
assert.equal(req('/api/auth/session', 'GET', undefined, cookie).status, 401);
assert.equal(req('/api/auth/session', 'GET', undefined, second).status, 401);
assert.equal(req('/api/auth/session', 'GET', undefined, renewed).status, 200);
assert.equal(req('/api/auth/login', 'POST', { email, password }).status, 401);
cookie = req('/api/auth/login', 'POST', { email, password: next }).cookie;
assert.ok(cookie);
assert.equal(req('/api/auth/logout-all', 'POST', {}, cookie).status, 200);
assert.equal(req('/api/auth/session', 'GET', undefined, cookie).status, 401);
assert.equal(req('/api/auth/session', 'GET', undefined, renewed).status, 401);
console.log(
  'PASS: own-account preferences, strict schema, CSRF, persisted onboarding and language/theme, password verification and rotation, old-session revocation, logout all devices',
);
