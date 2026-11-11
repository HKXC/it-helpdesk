import { z } from 'zod';
import { getAccount, readBody, response, sameOrigin } from '../../../../lib/account-auth';
import { database } from '../../../../lib/database';
import { demoAccountIds, isDemoEmail, readSettings, writeSettings } from '../../../../lib/demo';
export const dynamic = 'force-dynamic';

async function summary() {
  const settings = await readSettings();
  const ids = await demoAccountIds();
  const tickets = await database().select('it_tickets', {}, ['requester_id'], 5000);
  return {
    demoEnabled: settings.demoEnabled,
    demoAccounts: ids.size,
    demoTickets: tickets.filter((t) => ids.has(String(t.requester_id))).length,
  };
}

export async function GET(request: Request) {
  try {
    const actor = await getAccount(request);
    if (!actor) return response({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
    if (actor.role !== 'admin') return response({ error: 'เฉพาะ Admin เท่านั้น' }, 403);
    return response({ ...(await summary()), actorIsDemo: isDemoEmail(actor.email) });
  } catch {
    return response({ error: 'โหลดการตั้งค่าไม่สำเร็จ' }, 503);
  }
}

const schema = z.object({ demoEnabled: z.boolean() }).strict();

export async function PUT(request: Request) {
  let raw;
  try {
    raw = await readBody(request, 1024);
  } catch {
    return response({ error: 'คำขอใหญ่เกินไป' }, 413);
  }
  if (!sameOrigin(request)) return response({ error: 'คำขอไม่ถูกต้อง' }, 403);
  try {
    const actor = await getAccount(request);
    if (!actor) return response({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
    if (actor.role !== 'admin') return response({ error: 'เฉพาะ Admin เท่านั้น' }, 403);
    let input;
    try {
      input = schema.safeParse(JSON.parse(raw));
    } catch {
      return response({ error: 'ข้อมูลไม่ถูกต้อง' }, 400);
    }
    if (!input.success) return response({ error: 'ข้อมูลไม่ถูกต้อง' }, 400);
    if (!input.data.demoEnabled && isDemoEmail(actor.email))
      return response(
        {
          error:
            'คุณกำลังใช้บัญชีจำลองอยู่ ถ้าปิดตอนนี้จะเข้าระบบไม่ได้ กรุณาสร้างบัญชี Admin จริงแล้วเข้าสู่ระบบด้วยบัญชีนั้นก่อน',
        },
        409,
      );
    await writeSettings({ demoEnabled: input.data.demoEnabled });
    return response({ ...(await summary()), actorIsDemo: isDemoEmail(actor.email) });
  } catch {
    return response({ error: 'บันทึกการตั้งค่าไม่สำเร็จ' }, 503);
  }
}
