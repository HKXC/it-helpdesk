import { randomUUID } from 'node:crypto';
import { getAccount, response, sameOrigin } from '../../../../../lib/account-auth';
import { database } from '../../../../../lib/database';
import { ticketView } from '../../../../../lib/tickets';
import { hiddenDemoTicket } from '../../../../../lib/demo';
import {
  IMAGE_TYPES,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  removeObject,
  sniffImage,
  uploadObject,
} from '../../../../../lib/storage';
export const dynamic = 'force-dynamic';

// Upload one image to a ticket. Body: multipart/form-data with field "file".
export async function POST(request: Request) {
  if (!sameOrigin(request)) return response({ error: 'คำขอไม่ถูกต้อง' }, 403);
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_ATTACHMENT_BYTES + 64 * 1024)
    return response({ error: 'ไฟล์ใหญ่เกิน 4 MB' }, 413);
  let path = '';
  try {
    const user = await getAccount(request);
    if (!user) return response({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
    const id = Number(new URL(request.url).pathname.split('/').at(-2));
    if (!Number.isSafeInteger(id) || id < 1) return response({ error: 'ไม่พบคำร้อง' }, 404);
    const db = database(),
      row = (await db.select('it_tickets', { id }, undefined, 1))[0];
    if (
      !row ||
      (user.role === 'employee' && row.requester_id !== user.id) ||
      (await hiddenDemoTicket(row))
    )
      return response({ error: 'ไม่พบคำร้อง' }, 404);
    const job = await ticketView(row);
    if (['ปิดงาน', 'ยกเลิก'].includes(job.status))
      return response({ error: 'คำร้องนี้ปิดแล้ว แนบไฟล์เพิ่มไม่ได้' }, 400);
    if ((job.attachments?.length || 0) >= MAX_ATTACHMENTS)
      return response({ error: `แนบได้สูงสุด ${MAX_ATTACHMENTS} รูปต่อคำร้อง` }, 400);
    let file: File | null = null;
    try {
      const form = await request.formData();
      const value = form.get('file');
      file = value instanceof File ? value : null;
    } catch {
      return response({ error: 'ข้อมูลไฟล์ไม่ถูกต้อง' }, 400);
    }
    if (!file || !file.size) return response({ error: 'กรุณาเลือกไฟล์รูปภาพ' }, 400);
    if (file.size > MAX_ATTACHMENT_BYTES) return response({ error: 'ไฟล์ใหญ่เกิน 4 MB' }, 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImage(bytes);
    if (!type || !IMAGE_TYPES[type])
      return response({ error: 'รองรับเฉพาะไฟล์รูป PNG, JPG, WEBP หรือ GIF' }, 415);
    const attachmentId = randomUUID();
    path = `${id}/${attachmentId}.${IMAGE_TYPES[type]}`;
    await uploadObject(path, bytes.buffer as ArrayBuffer, type);
    const at = new Date().toISOString();
    const name = (file.name || 'image').replace(/[\r\n]/g, ' ').slice(0, 200);
    const next = {
      ...job,
      attachments: [
        ...(job.attachments || []),
        { id: attachmentId, name, type, size: file.size, at, by: user.name, byId: user.id },
      ],
      history: [...(job.history || []), { at, actor: user.name, text: 'แนบรูป ' + name }].slice(
        -500,
      ),
      updatedAt: at,
    };
    const revision = Number(row.revision);
    const changed = await db.patch(
      'it_tickets',
      { id, revision },
      { body: JSON.stringify(next), revision: revision + 1, updated_at: Date.now() },
    );
    if (!changed.length) {
      await removeObject(path);
      return response({ error: 'มีการแก้ไขพร้อมกัน กรุณาลองอีกครั้ง' }, 409);
    }
    return response({ job: await ticketView(changed[0]) }, 201);
  } catch {
    if (path) await removeObject(path).catch(() => {});
    return response({ error: 'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่' }, 503);
  }
}
