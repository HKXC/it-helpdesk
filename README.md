# Flowdesk — IT Help Desk v2

แอป Help Desk ภาษาไทย บันทึกคำร้องใน D1 แยกตามบัญชี ChatGPT โดยคง Sites access policy แบบส่วนตัว

## ใช้งาน

npm install
npm run dev

ใช้ลิงก์เข้าสู่ระบบในแถบแจ้งสถานะเพื่อเข้าสู่บัญชีจำลอง local เท่านั้น ส่วนเว็บที่เผยแพร่ใช้การเข้าสู่ระบบของ Sites

## ฐานข้อมูล local

npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_right_roland_deschain.sql

ใช้คำสั่ง migration เฉพาะเมื่อยังไม่ได้ apply ในฐานข้อมูล local นั้น การเผยแพร่ผ่าน Sites จะ apply migration บน hosted database

## ตรวจสอบ

node node_modules/typescript/bin/tsc --noEmit
npm run build
npm start -- --port 5174
node scripts/test-helpdesk.mjs

Integration tests ใช้ Worker local และ user ID สำหรับทดสอบที่สุ่มใหม่ ตรวจ anonymous access, account isolation, persistence, revision conflict, schema validation และ origin check

## ฟีเจอร์

- สร้างคำร้อง ระบุแผนก สถานที่ ช่องทางติดต่อ รหัสอุปกรณ์
- ค้นหา กรองสถานะ/ความสำคัญ เรียงลำดับ มอบหมาย เปลี่ยนสถานะ สนทนา
- บันทึกวิธีแก้ไข ยืนยันปิดงาน ให้คะแนน เปิดงานซ้ำพร้อมเหตุผล ยกเลิกพร้อมเหตุผล
- เวลาและประวัติการดำเนินการ (ไม่ใช่ audit log ที่ป้องกันผู้ใช้แก้ไขเอง)
- คลังความรู้ รายงาน CSV พร้อมป้องกัน formula injection
- นำเข้าข้อมูล v1 จาก localStorage เมื่อพื้นที่เซิร์ฟเวอร์ยังว่าง โดยไม่ลบสำเนา local เดิม
- แสดงสถานะการบันทึก ป้องกัน stale write จากหลายแท็บด้วย revision และสำรองข้อมูลที่ยังบันทึกไม่ได้เป็น JSON

## ขอบเขต

พื้นที่ส่วนตัวต่อบัญชี ยังไม่ใช่คิวงานหลายผู้ใช้ของบริษัท ชื่อผู้ดำเนินการ/ผู้รับผิดชอบเป็นชื่อแสดงผล ไม่ใช่การให้สิทธิ์ การตั้งค่าโปรไฟล์ยังเป็น device preference ข้อมูลคำร้องอยู่บนเซิร์ฟเวอร์ จำกัด 500 คำร้องต่อบัญชี 300 ข้อความและ 500 ประวัติต่อคำร้อง

ยังไม่เชื่อม SSO บริษัท, RBAC พนักงาน/IT/ผู้ดูแล, อีเมล, ไฟล์แนบ และ SLA ตามเวลาทำการ/วันหยุด ต้องกำหนดนโยบายและเชื่อมระบบองค์กรก่อนใช้งานจริง การยืนยันปิดงานปัจจุบันทำโดยเจ้าของพื้นที่ส่วนตัว
