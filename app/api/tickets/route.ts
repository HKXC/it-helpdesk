import { getAccount, readBody, response, sameOrigin } from '../../../lib/account-auth';
import { database } from '../../../lib/database';
import { jobSchema } from '../../../lib/helpdesk';
import { ticketView } from '../../../lib/tickets';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  let raw;
  try {
    raw = await readBody(request, 18000);
  } catch {
    return response({ error: 'คำขอใหญ่เกินไป' }, 413);
  }
  if (!sameOrigin(request)) return response({ error: 'คำขอไม่ถูกต้อง' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return response({ error: 'ต้องใช้ JSON' }, 415);
  try {
    const user = await getAccount(request);
    if (!user) return response({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
    let input, requestId;
    try {
      const envelope = JSON.parse(raw);
      requestId = envelope.requestId;
      input = jobSchema.safeParse(envelope.job);
    } catch {
      return response({ error: 'ข้อมูลไม่ถูกต้อง' }, 400);
    }
    if (
      typeof requestId !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId)
    )
      return response({ error: 'กรุณารีเฟรชหน้าแล้วสร้างคำร้องอีกครั้ง' }, 400);
    if (!input.success) return response({ error: 'กรอกข้อมูลคำร้องให้ครบ' }, 400);
    const db = database(),
      job = input.data,
      now = Date.now(),
      key = 'create:' + user.id + ':' + requestId;
    const previous = (await db.select('it_tickets', { legacy_key: key }, undefined, 1))[0];
    if (previous) return response({ job: await ticketView(previous) }, 201);
    const own = await db.select('it_tickets', { requester_id: user.id }, ['id'], 501);
    if (own.length >= 500) return response({ error: 'บัญชีนี้มีคำร้องครบขีดจำกัดแล้ว' }, 400);
    const data = {
      ...job,
      id: 1,
      person: user.name,
      status: 'เปิดใหม่',
      agent: 'ยังไม่มอบหมาย',
      comments: [],
      resolution: undefined,
      rating: undefined,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      history: [{ at: new Date(now).toISOString(), actor: user.name, text: 'สร้างคำร้อง' }],
    };
    const row = await db.insert(
      'it_tickets',
      {
        requester_id: user.id,
        assignee_id: null,
        body: JSON.stringify(data),
        revision: 1,
        created_at: now,
        updated_at: now,
        legacy_key: key,
      },
      true,
    );
    const saved = row || (await db.select('it_tickets', { legacy_key: key }, undefined, 1))[0];
    return response({ job: await ticketView(saved!) }, 201);
  } catch {
    return response({ error: 'สร้างคำร้องไม่สำเร็จ กรุณาลองใหม่' }, 503);
  }
}
