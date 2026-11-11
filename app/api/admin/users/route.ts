import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getAccount, readBody, response, sameOrigin } from '../../../../lib/account-auth';
import { database, databaseInfo } from '../../../../lib/database';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const actor = await getAccount(request);
    if (!actor) return response({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
    if (actor.role !== 'admin') return response({ error: 'เฉพาะ Admin ที่จัดการผู้ใช้ได้' }, 403);
    const db = database();
    const users = await db.select(
      'accounts',
      {},
      ['id', 'email', 'name', 'role', 'active', 'version', 'created_at'],
      1000,
    );
    const audit = (await db.select('role_audit', {}, undefined, 200))
      .sort((a, b) => Number(b.created_at) - Number(a.created_at))
      .slice(0, 50);
    return response({
      users: users.map((u) => ({
        ...u,
        protected: u.id === process.env.ROOT_ADMIN_ID || u.id === actor.id,
      })),
      audit,
      database: databaseInfo(),
    });
  } catch {
    return response({ error: 'โหลดข้อมูลผู้ใช้ไม่สำเร็จ' }, 503);
  }
}
const schema = z
  .object({
    id: z.string().max(100),
    version: z.number().int().min(0),
    role: z.enum(['admin', 'it', 'employee']),
    active: z.number().int().min(0).max(1),
  })
  .strict();
export async function PATCH(request: Request) {
  let raw;
  try {
    raw = await readBody(request);
  } catch {
    return response({ error: 'คำขอใหญ่เกินไป' }, 413);
  }
  if (!sameOrigin(request)) return response({ error: 'คำขอไม่ถูกต้อง' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return response({ error: 'ต้องใช้ JSON' }, 415);
  try {
    const actor = await getAccount(request);
    if (!actor) return response({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
    if (actor.role !== 'admin') return response({ error: 'เฉพาะ Admin ที่จัดการผู้ใช้ได้' }, 403);
    let parsed;
    try {
      parsed = schema.safeParse(JSON.parse(raw));
    } catch {
      return response({ error: 'ข้อมูลไม่ถูกต้อง' }, 400);
    }
    if (!parsed.success) return response({ error: 'ข้อมูลบทบาทไม่ถูกต้อง' }, 400);
    const input = parsed.data;
    if (input.id === actor.id || input.id === process.env.ROOT_ADMIN_ID)
      return response({ error: 'ไม่สามารถเปลี่ยนสิทธิ์ตนเองหรือบัญชี Admin หลักได้' }, 403);
    const db = database(),
      target = (await db.select('accounts', { id: input.id }, ['name', 'role', 'active'], 1))[0];
    if (!target) return response({ error: 'ไม่พบบัญชี' }, 404);
    const detail =
      actor.name +
      ' เปลี่ยน ' +
      String(target.name) +
      ' จาก ' +
      String(target.role) +
      ' เป็น ' +
      input.role +
      ' · ' +
      (input.active ? 'เปิดใช้งาน' : 'ระงับบัญชี');
    const changed = await db.changeAccount({
      actor: actor.id,
      target: input.id,
      role: input.role,
      active: input.active,
      version: input.version,
      root: process.env.ROOT_ADMIN_ID || '',
      auditId: randomUUID(),
      detail,
      now: Date.now(),
    });
    if (!changed)
      return response({ error: 'สิทธิ์หรือข้อมูลผู้ใช้เปลี่ยนแล้ว กรุณาโหลดใหม่' }, 409);
    return response({ ok: true });
  } catch {
    return response({ error: 'เปลี่ยนสิทธิ์ไม่สำเร็จ กรุณาลองใหม่' }, 503);
  }
}
