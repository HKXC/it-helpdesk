# Flowdesk — IT Help Desk v3

IT Help Desk ภาษาไทย พร้อมระบบสมัครสมาชิกและเข้าสู่ระบบด้วยอีเมล/รหัสผ่านของเว็บไซต์

## Run

npm install
npm run dev

## Build and check

node node_modules/typescript/bin/tsc --noEmit
npm run build
npm start -- --port 5174
node scripts/test-accounts.mjs

## Database

ใช้ D1 binding DB ตาม .openai/hosting.json สร้าง migration ด้วย npm run db:generate
สำหรับฐานข้อมูล local ใหม่ apply migration ตามลำดับเพียงครั้งเดียว:

node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_right_roland_deschain.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_moaning_salo.sql

Sites applies hosted migrations during publication. Local and hosted databases are separate.

## Authentication

- /api/auth/register: ชื่อ อีเมล รหัสผ่าน 12–128 ตัวอักษร และยืนยันรหัสผ่าน
- /api/auth/login: ตรวจรหัสผ่านและสร้าง session ใหม่
- /api/auth/session: ตรวจ session จาก cookie
- /api/auth/logout: เพิกถอน session ใน D1 และล้าง cookie
- Passwords: salted scrypt (N=32768,r=8,p=3,maxmem=64MiB)
- Sessions: random 32-byte tokens; only SHA-256 token digests stored in D1
- HTTPS cookie: __Host-flowdesk_session, HttpOnly, Secure, SameSite=Lax, Path=/
- Loopback HTTP preview uses flowdesk_local_session only
- Lifetime: 8 hours; Remember: 7 days, with persistent cookie
- Login limits: 12 attempts/email and 100/IP per 15 minutes
- Same-origin JSON writes and bounded request bodies; no secrets in localStorage

ระบบใช้บัญชีเว็บโดยตรงและไม่ใช้ oai-authenticated-user headers สำหรับอนุญาตเข้าถึงข้อมูล การเข้าสู่ระบบไม่เปลี่ยนสิทธิ์บุคคลอื่น พื้นที่ข้อมูลแยกตาม account ID ชื่อผู้ดำเนินการและผู้รับผิดชอบเป็นชื่อแสดงผล

ข้อมูลเดิมจากบัญชี ChatGPT เก็บไว้ใต้ key เดิมโดยไม่ลบ ไม่เชื่อมกับบัญชีใหม่อัตโนมัติจาก email บัญชีเว็บใหม่ใช้ ID แบบสุ่มแยก namespace และเริ่มพื้นที่ใหม่

## Help Desk

สร้างคำร้องพร้อมแผนก สถานที่ อุปกรณ์ ช่องทางติดต่อ, ค้นหา/กรอง/เรียง, มอบหมายและสนทนา, วิธีแก้ไข, ปิดงานพร้อมคะแนน, เปิดงานซ้ำ/ยกเลิกพร้อมเหตุผล, ประวัติและเวลา, คลังความรู้ และรายงาน CSV ที่ป้องกัน formula injection

Optimistic revision prevents stale writes. Errors preserve current edits for retry or JSON backup. รองรับ 500 คำร้องต่อบัญชี 300 ข้อความและ 500 ประวัติต่อคำร้อง ประวัติไม่ได้เป็น immutable audit log

## Tests

scripts/test-accounts.mjs ใช้บัญชีสังเคราะห์ใน local Worker ตรวจ signup, duplicate email, password validation, login, cookie flags, logout revocation, sessions across devices, account isolation, forged platform headers, CSRF, persistence, revision conflict และ throttling

## Remaining scope

ยังไม่เชื่อม email verification, password recovery, company-domain registration policy, shared company queue, RBAC พนักงาน/IT/Admin, ไฟล์แนบ, email notifications และ SLA ตามเวลาทำการ ชื่อโปรไฟล์เป็น device preference แยกตาม account ID

หน้าเข้าสู่ระบบต้องเปิดให้เข้าถึงได้โดยไม่ผ่าน platform sign-in gate แต่ API ข้อมูลทั้งหมดต้องผ่าน session ของเว็บไซต์
