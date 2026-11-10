import { database } from '../../../../lib/database';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import {
  createSession,
  endSession,
  getAccount,
  loadAccount,
  limited,
  readBody,
  response,
  sameOrigin,
  sessionCookie,
} from '../../../../lib/account-auth';
import {
  dummyHash,
  hashPassword,
  verifyPassword,
  randomToken,
  digest,
} from '../../../../lib/passwords';
export const dynamic = 'force-dynamic';
const credentials = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(1).max(128),
  remember: z.boolean().optional(),
  locale: z.enum(['th', 'en']).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
});
const signup = credentials
  .extend({
    name: z.string().trim().min(2).max(70),
    password: z.string().min(12).max(128),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { message: 'รหัสผ่านไม่ตรงกัน' });
export async function GET(request: Request) {
  if (new URL(request.url).pathname !== '/api/auth/session')
    return response({ error: 'ไม่พบหน้าที่ต้องการ' }, 404);
  try {
    const user = await getAccount(request);
    return user ? response({ user }) : response({ user: null }, 401);
  } catch {
    return response({ error: 'เชื่อมต่อระบบบัญชีไม่ได้ กรุณาลองใหม่' }, 503);
  }
}
export async function POST(request: Request) {
  let raw;
  try {
    raw = await readBody(request);
  } catch {
    return response({ error: 'คำขอมีขนาดใหญ่เกินไป' }, 413);
  }
  if (!sameOrigin(request)) return response({ error: 'คำขอไม่ถูกต้อง' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return response({ error: 'รูปแบบคำขอไม่ถูกต้อง' }, 415);
  const action = new URL(request.url).pathname.split('/').at(-1);
  try {
    const db = database();
    if (action === 'logout') {
      return response({ ok: true }, 200, { 'Set-Cookie': await endSession(request) });
    }
    if (action === 'logout-all') {
      const user = await getAccount(request);
      if (!user) return response({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
      await db.remove('account_sessions', { account_id: user.id });
      return response({ ok: true }, 200, { 'Set-Cookie': await endSession(request) });
    }
    if (action === 'password') {
      const user = await getAccount(request);
      if (!user) return response({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
      let value;
      try {
        value = z
          .object({
            currentPassword: z.string().min(1).max(128),
            newPassword: z.string().min(12).max(128),
            confirmPassword: z.string(),
          })
          .strict()
          .refine((v) => v.newPassword === v.confirmPassword)
          .safeParse(JSON.parse(raw));
      } catch {
        return response({ error: 'ข้อมูลไม่ถูกต้อง' }, 400);
      }
      if (!value.success)
        return response(
          { error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 12 ตัวอักษรและตรงกันทั้งสองช่อง' },
          400,
        );
      if (await limited('password:' + user.id, 8, 900000))
        return response({ error: 'มีการลองหลายครั้ง กรุณารอ 15 นาที' }, 429);
      const account = (await db.select('accounts', { id: user.id }, ['password_hash'], 1))[0];
      if (
        !account ||
        !(await verifyPassword(value.data.currentPassword, String(account.password_hash)))
      )
        return response({ error: 'รหัสผ่านเดิมไม่ถูกต้อง' }, 400);
      if (value.data.newPassword === value.data.currentPassword)
        return response({ error: 'กรุณาใช้รหัสผ่านใหม่ที่ต่างจากรหัสผ่านเดิม' }, 400);
      const token = randomToken(),
        now = Date.now();
      const changed = await db.changePassword({
        id: user.id,
        oldHash: String(account.password_hash),
        newHash: await hashPassword(value.data.newPassword),
        tokenHash: digest(token),
        expires: now + 8 * 3600000,
        now,
      });
      if (!changed) return response({ error: 'บัญชีเปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่' }, 409);
      return response({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request, token, false) });
    }
    if (!['login', 'register'].includes(action || ''))
      return response({ error: 'ไม่พบหน้าที่ต้องการ' }, 404);
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return response({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, 400);
    }
    const parsed = (action === 'register' ? signup : credentials).safeParse(data);
    if (!parsed.success)
      return response(
        {
          error:
            action === 'register'
              ? 'กรอกชื่อ อีเมล และรหัสผ่านอย่างน้อย 12 ตัวอักษร พร้อมยืนยันรหัสผ่านให้ตรงกัน'
              : 'กรุณากรอกอีเมลและรหัสผ่านให้ถูกต้อง',
        },
        400,
      );
    const input = parsed.data;
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    if (
      (await limited('ip:' + ip, 100, 900000)) ||
      (await limited('email:' + input.email, 12, 900000))
    )
      return response({ error: 'มีการลองเข้าสู่ระบบหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่' }, 429, {
        'Retry-After': '900',
      });
    if (action === 'register') {
      const reg = signup.parse(data);
      const id = 'account:' + randomUUID();
      const encoded = await hashPassword(reg.password);
      const result = await db.insert(
        'accounts',
        {
          id,
          email: reg.email,
          name: reg.name,
          password_hash: encoded,
          created_at: Date.now(),
          role: 'employee',
          active: 1,
          version: 0,
          legacy_migrated: 1,
          locale: reg.locale || 'th',
          theme: reg.theme || 'system',
          onboarding_completed: 0,
        },
        true,
      );
      if (!result)
        return response(
          { error: 'ไม่สามารถสมัครด้วยอีเมลนี้ได้ หากมีบัญชีอยู่แล้วกรุณาเข้าสู่ระบบ' },
          409,
        );
      return response({ user: await loadAccount(id) }, 201, {
        'Set-Cookie': await createSession(request, id, Boolean(reg.remember)),
      });
    }
    const row = (
      await db.select(
        'accounts',
        { email: input.email },
        ['id', 'email', 'name', 'password_hash', 'active'],
        1,
      )
    )[0];
    const valid = await verifyPassword(input.password, String(row?.password_hash || dummyHash));
    if (!row || !valid || Number(row.active) !== 1)
      return response({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, 401);
    const user = await loadAccount(String(row.id));
    return response({ user }, 200, {
      'Set-Cookie': await createSession(request, String(row.id), Boolean(input.remember)),
    });
  } catch {
    return response({ error: 'ระบบบัญชีขัดข้องชั่วคราว กรุณาลองใหม่' }, 503);
  }
}
