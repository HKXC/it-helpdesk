import { getAccount, response } from '../../../../../../lib/account-auth';
import { database } from '../../../../../../lib/database';
import { ticketView } from '../../../../../../lib/tickets';
import { IMAGE_TYPES, signedUrl } from '../../../../../../lib/storage';
export const dynamic = 'force-dynamic';

// Redirect to a short-lived signed URL after checking the viewer can see the ticket.
export async function GET(request: Request) {
  try {
    const user = await getAccount(request);
    if (!user) return response({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
    const parts = new URL(request.url).pathname.split('/');
    const id = Number(parts.at(-3)),
      aid = parts.at(-1) || '';
    if (!Number.isSafeInteger(id) || id < 1 || !/^[0-9a-f-]{36}$/.test(aid))
      return response({ error: 'ไม่พบไฟล์' }, 404);
    const row = (await database().select('it_tickets', { id }, undefined, 1))[0];
    if (!row || (user.role === 'employee' && row.requester_id !== user.id))
      return response({ error: 'ไม่พบไฟล์' }, 404);
    const job = await ticketView(row);
    const file = job.attachments?.find((a) => a.id === aid);
    if (!file || !IMAGE_TYPES[file.type]) return response({ error: 'ไม่พบไฟล์' }, 404);
    const url = await signedUrl(`${id}/${aid}.${IMAGE_TYPES[file.type]}`);
    return new Response(null, {
      status: 302,
      headers: { Location: url, 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return response({ error: 'โหลดไฟล์ไม่สำเร็จ' }, 503);
  }
}
