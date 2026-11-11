import { z } from 'zod';
export const statuses = [
  'เปิดใหม่',
  'กำลังดำเนินการ',
  'รอข้อมูล',
  'แก้ไขแล้ว',
  'ปิดงาน',
  'ยกเลิก',
] as const;
const event = z.object({
  at: z.string().datetime(),
  actor: z.string().max(80),
  text: z.string().max(500),
});
export const jobSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().trim().min(1).max(150),
  category: z.enum(['อุปกรณ์', 'เครือข่าย', 'ซอฟต์แวร์', 'บัญชีและสิทธิ์', 'อื่น ๆ']),
  status: z.enum(statuses),
  priority: z.enum(['ต่ำ', 'ปกติ', 'สูง', 'เร่งด่วน']),
  person: z.string().trim().min(1).max(80),
  agent: z.string().max(80),
  detail: z.string().trim().min(1).max(5000),
  comments: z.array(z.string().max(2200)).max(300),
  department: z.string().max(80).optional(),
  location: z.string().max(150).optional(),
  asset: z.string().max(80).optional(),
  contact: z.string().max(150).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  resolution: z.string().max(3000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  history: z.array(event).max(500).optional(),
  attachments: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().max(200),
        type: z.string(),
        size: z.number().int(),
        at: z.string(),
        by: z.string().max(80),
        byId: z.string().optional(),
      }),
    )
    .max(10)
    .optional(),
  requesterId: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  revision: z.number().int().positive().optional(),
});
export type Job = z.infer<typeof jobSchema>;
export const snapshotSchema = z
  .object({ revision: z.number().int().min(0), jobs: z.array(jobSchema).max(500) })
  .superRefine((v, c) => {
    if (new Set(v.jobs.map((j) => j.id)).size !== v.jobs.length)
      c.addIssue({ code: 'custom', message: 'Duplicate ticket ID' });
  });
export function safeCsvCell(value: string) {
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}
