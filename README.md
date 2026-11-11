# Flowdesk — IT Help Desk

ระบบแจ้งปัญหา IT ภายในองค์กร: บัญชีอีเมล/รหัสผ่าน, บทบาท Admin / IT / พนักงาน, คิวงานร่วม, คลังความรู้ และรายงาน
สร้างด้วย Next.js 16 + Supabase (PostgreSQL) deploy บน Vercel

## เริ่มใช้งานในเครื่อง

```bash
npm install
cp .env.example .env.local   # แล้วใส่ SUPABASE_URL และ SUPABASE_SECRET_KEY
npm run dev                  # http://localhost:3000
```

## ตั้งค่าฐานข้อมูล Supabase

1. สร้าง project ใน Supabase
2. SQL Editor → รัน `supabase/migrations/001_flowdesk.sql` แล้ว `002_ui_preferences.sql` (ครั้งเดียว ตามลำดับ)
3. Project Settings → API Keys → คัดลอก Secret key (`sb_secret_…`) ไปใส่ `.env.local` / Vercel

ตารางทั้งหมดขึ้นต้น `flowdesk_` เปิด RLS และไม่ให้สิทธิ์ browser — เว็บเข้าถึงผ่าน server ด้วย secret key เท่านั้น

## Deploy บน Vercel

1. Import repo นี้ใน Vercel (Framework: Next.js ตรวจอัตโนมัติ)
2. Settings → Environment Variables: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ROOT_ADMIN_ID`
3. Deploy

## Admin คนแรก

ทุกบัญชีที่สมัครใหม่เป็น "พนักงาน" เสมอ วิธีตั้ง Admin คนแรก:

1. สมัครบัญชีบนเว็บ
2. ใน Supabase → Table Editor → `flowdesk_accounts` คัดลอกค่า `id` ของบัญชีนั้น
3. ตั้ง `ROOT_ADMIN_ID` เป็นค่านั้น (ใน Vercel แล้ว Redeploy) — บัญชีนี้จะได้สิทธิ์ Admin และถูกป้องกันไม่ให้ถูกลดสิทธิ์

จากนั้น Admin เปลี่ยนบทบาทคนอื่นเป็น IT/Admin ได้ในหน้า "จัดการผู้ใช้"

## บทบาท

- **พนักงาน:** สร้างและดูคำร้องของตัวเอง ส่งข้อความ ยกเลิก ยืนยันปิดงานพร้อมให้คะแนน หรือเปิดใหม่
- **IT:** เห็นคิวรวม มอบหมายงาน อัปเดตสถานะ บันทึกวิธีแก้
- **Admin:** ทุกอย่างของ IT + จัดการผู้ใช้ เปลี่ยนบทบาท ระงับบัญชี และดูประวัติการเปลี่ยนสิทธิ์

## ความปลอดภัย

- รหัสผ่านเก็บแบบ scrypt + salt, เก็บเฉพาะ hash ของ session token
- Cookie: HttpOnly, Secure, SameSite=Lax; session 8 ชั่วโมง หรือ 7 วันเมื่อเลือก "จำการเข้าสู่ระบบ"
- ทุก API ตรวจบัญชีและบทบาทจากฐานข้อมูล, จำกัดจำนวนครั้ง login ผิด, ป้องกัน CSRF ด้วยการตรวจ same-origin

## ทดสอบ

```bash
npm run test:store   # contract test ของ Supabase adapter
```
