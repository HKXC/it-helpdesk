# เชื่อมต่อ Supabase

ระบบเตรียมตัวเชื่อมต่อ server-side แล้ว: lib/database.ts เลือก D1 หรือ Supabase โดยใช้ DB_PROVIDER ส่วน lib/supabase-store.ts ติดต่อ Data API ผ่าน HTTPS โดยตรง ไม่ต้องเปลี่ยน UI หรือส่งคีย์ให้เบราว์เซอร์

## เปิดฐานข้อมูลใหม่

1. สร้าง Supabase project ในบัญชีของบริษัท เลือก region ตามนโยบายข้อมูลของบริษัท
2. ใช้ SQL Editor รัน supabase/migrations/001_flowdesk.sql โดยตรวจ schema ก่อน รันบน project ใหม่เพื่อหลีกเลี่ยงข้อมูลเดิม
3. ไฟล์สร้างตารางที่ขึ้นต้น flowdesk_ เปิด RLS และเพิกถอนสิทธิ์จาก anon/authenticated/PUBLIC ตัวเว็บไซต์ใช้งานผ่าน backend ด้วย secret key เท่านั้น
4. เปิด Data API สำหรับ public schema (ค่าปกติ) โดยตารางและ functions ของ Flowdesk ให้สิทธิ์เฉพาะ service_role ไม่มี browser policy
5. ตั้ง runtime variables ฝั่ง server:
   - DB_PROVIDER=supabase
   - SUPABASE_URL=https://PROJECT.supabase.co
   - SUPABASE_SECRET_KEY=secret key ของ project (ต้องตั้งเป็น secret)
   - ROOT_ADMIN_ID=ID บัญชี Admin หลักที่ได้รับอนุญาตแล้ว
   - รองรับ SUPABASE_SERVICE_ROLE_KEY แบบ JWT เดิมเป็นทางเลือก แต่ใช้ secret key รุ่นใหม่ได้โดยตรง
6. เผยแพร่ version ใหม่หลังเปลี่ยน runtime variables แล้วตรวจ signup/login/logout, พนักงานแยกข้อมูล, คิว IT, การเปลี่ยนบทบาท และการสำรอง/กู้คืน

ห้ามใช้ NEXT_PUBLIC_ กับ secret key ห้ามส่งคีย์ผ่านหน้าเว็บ/แชตหรือใส่ลง Git ตัว adapter ตั้งชื่อแยกจากตาราง Supabase Auth เพราะ Flowdesk ยังใช้บัญชีอีเมล/รหัสผ่านและ session ของเว็บเอง ไม่ได้เปลี่ยนเป็น Supabase Auth อัตโนมัติ

## ย้ายข้อมูลจาก D1

อย่าเปลี่ยน DB_PROVIDER ในระบบจริงก่อนย้ายข้อมูล หากใช้ Supabase project ว่าง เว็บไซต์จะมองเห็นฐานข้อมูลว่าง

- สำรอง D1 ด้วยช่องทางผู้ดูแลของโฮสต์ เก็บ backup ที่มี password hashes และ sessions เป็นข้อมูลลับ
- หยุดการเขียนชั่วคราวหรือกำหนด maintenance window ก่อนคัดลอกข้อมูลชุดสุดท้าย
- คัดลอก accounts, account_sessions, auth_rate_limits, helpdesk_workspaces, it_tickets, role_audit ไปยังตาราง flowdesk_ ที่ชื่อสอดคล้องกัน และเก็บ ID เดิม/FK/เวลา/revision ให้ครบ
- ควรยกเลิก sessions เดิมแทนการย้าย session หากต้องการให้ทุกคน login ใหม่ ส่วน password_hash แบบ scrypt-v1 ใช้ต่อได้
- บัญชี root ต้องเก็บ ID เดิมตาม ROOT_ADMIN_ID เพื่อไม่ให้เสียสิทธิ์ Admin
- หลังนำเข้า id ของ it_tickets ให้ปรับ sequence เช่น SELECT setval(pg_get_serial_sequence('public.flowdesk_it_tickets','id'), COALESCE((SELECT max(id) FROM public.flowdesk_it_tickets),1), EXISTS(SELECT 1 FROM public.flowdesk_it_tickets));
- เปรียบเทียบจำนวนแถวและสุ่มตรวจสิทธิ์ก่อนเปิดการเขียน/เปลี่ยน DNS หรือ provider
- ย้อนกลับไป D1 ได้ก่อนเปิดการเขียนลง Supabase หลังมีการเขียนลงฐานใหม่ต้องย้าย delta กลับก่อน rollback เพื่อไม่ให้ข้อมูลหาย

## ขอบเขตการตรวจสอบ

ตัว adapter มี contract tests สำหรับ URL, filters, version conditions, secret-header isolation และ RPC และไฟล์ SQL ผ่านการรันตรวจสอบบน PostgreSQL แบบ local/WASM แล้ว รวมถึงสิทธิ์ anon/authenticated, RPC transaction และการยกเลิก session แต่ยังไม่ได้ apply หรือทดสอบกับ Supabase project ของผู้ใช้จริง เพราะยังไม่มี project ที่เชื่อมต่อไว้

คิวงานรุ่นนี้โหลดสูงสุด 5,000 แถว และรายชื่อผู้ใช้สูงสุด 1,000 บัญชีสำหรับ Admin ควรเพิ่ม pagination ฝั่งเซิร์ฟเวอร์ก่อนมีข้อมูลจำนวนมาก Supabase Data API อาจจำกัดจำนวนแถวต่อ request ตาม Project settings ต้องตั้งให้สอดคล้องหรือเพิ่ม pagination ก่อนใช้งานระดับองค์กร

เอกสารอ้างอิง: https://supabase.com/docs/guides/api/securing-your-api และ https://supabase.com/docs/guides/getting-started/api-keys

## ส่วนเพิ่มด้านบัญชีและการแสดงผล

หลัง 001_flowdesk.sql ให้รัน migrations/002_ui_preferences.sql เพื่อเพิ่มภาษา ธีม สถานะคำแนะนำครั้งแรก และ RPC เปลี่ยนรหัสผ่านแบบยกเลิก session เดิมใน transaction เดียว ค่าภาษา/ธีมและสถานะคำแนะนำต้องย้ายพร้อมข้อมูลบัญชีด้วย
