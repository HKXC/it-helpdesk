import { env } from 'cloudflare:workers';
import { getAccount } from '../../../lib/account-auth';
import { snapshotSchema } from '../../../lib/helpdesk';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 const user=await getAccount(request);if(!user)return json({error:'กรุณาเข้าสู่ระบบ'},401);
 try{if(!env.DB)return json({error:'ฐานข้อมูลยังไม่พร้อมใช้งาน'},503);
 const row=await env.DB.prepare('SELECT payload, revision FROM helpdesk_workspaces WHERE owner_id = ?').bind(user.id).first<{payload:string;revision:number}>();
 return json({jobs:row?JSON.parse(row.payload):[],revision:row?.revision??0,account:user.email});
 }catch{return json({error:'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่'},503)}
}
export async function PUT(request:Request){
 const user=await getAccount(request);
 // Consume a bounded body before returning a rejection, including on local Workers.
 let raw='';const reader=request.body?.getReader();let bytes=0;const decoder=new TextDecoder();
 try{if(reader){for(;;){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>1500000){await reader.cancel();return json({error:'ข้อมูลมีขนาดใหญ่เกินไป'},413)}raw+=decoder.decode(chunk.value,{stream:true})}raw+=decoder.decode()}}catch{return json({error:'อ่านคำขอไม่สำเร็จ'},400)}
 if(!user)return json({error:'กรุณาเข้าสู่ระบบ'},401);
 const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)return json({error:'คำขอไม่ถูกต้อง'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'ต้องใช้ JSON'},415);
 let input;try{input=snapshotSchema.safeParse(JSON.parse(raw))}catch{return json({error:'รูปแบบข้อมูลไม่ถูกต้อง'},400)}
 if(!input.success)return json({error:'ข้อมูลคำร้องไม่ครบหรือเกินขีดจำกัด'},400);
 try{if(!env.DB)return json({error:'ฐานข้อมูลยังไม่พร้อมใช้งาน'},503);
 const {jobs,revision}=input.data;
 const result=await env.DB.prepare('INSERT INTO helpdesk_workspaces (owner_id, payload, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(owner_id) DO UPDATE SET payload = excluded.payload, revision = helpdesk_workspaces.revision + 1, updated_at = excluded.updated_at WHERE helpdesk_workspaces.revision = ?').bind(user.id,JSON.stringify(jobs),new Date().toISOString(),revision).run();
 if(!result.meta.changes)return json({error:'มีการแก้ไขจากอีกแท็บหรืออุปกรณ์ กรุณาโหลดข้อมูลล่าสุดก่อนทำต่อ'},409);
 return json({revision:revision+1});
 }catch{return json({error:'บันทึกไม่สำเร็จ ข้อมูลที่แก้ยังอยู่บนหน้านี้ กรุณาลองอีกครั้ง'},503)}
}
