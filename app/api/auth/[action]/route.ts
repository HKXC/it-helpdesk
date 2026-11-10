import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {createSession,endSession,getAccount,limited,readBody,response,sameOrigin} from '../../../../lib/account-auth';
import {dummyHash,hashPassword,verifyPassword} from '../../../../lib/passwords';
export const dynamic='force-dynamic';
const credentials=z.object({email:z.string().trim().email().max(254).transform(s=>s.toLowerCase()),password:z.string().min(1).max(128),remember:z.boolean().optional()});
const signup=credentials.extend({name:z.string().trim().min(2).max(70),password:z.string().min(12).max(128),confirmPassword:z.string()}).refine(v=>v.password===v.confirmPassword,{message:'รหัสผ่านไม่ตรงกัน'});
export async function GET(request:Request){if(new URL(request.url).pathname!=='/api/auth/session')return response({error:'ไม่พบหน้าที่ต้องการ'},404);try{const user=await getAccount(request);return user?response({user}):response({user:null},401)}catch{return response({error:'เชื่อมต่อระบบบัญชีไม่ได้ กรุณาลองใหม่'},503)}}
export async function POST(request:Request){
 let raw;try{raw=await readBody(request)}catch{return response({error:'คำขอมีขนาดใหญ่เกินไป'},413)}
 if(!sameOrigin(request))return response({error:'คำขอไม่ถูกต้อง'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return response({error:'รูปแบบคำขอไม่ถูกต้อง'},415);
 const action=new URL(request.url).pathname.split('/').at(-1);
 try{
 if(!env.DB)return response({error:'ระบบบัญชียังไม่พร้อม กรุณาลองใหม่'},503);
 if(action==='logout'){return response({ok:true},200,{'Set-Cookie':await endSession(request)})}
 if(!['login','register'].includes(action||''))return response({error:'ไม่พบหน้าที่ต้องการ'},404);
 let data:unknown;try{data=JSON.parse(raw)}catch{return response({error:'รูปแบบข้อมูลไม่ถูกต้อง'},400)}
 const parsed=(action==='register'?signup:credentials).safeParse(data);if(!parsed.success)return response({error:action==='register'?'กรอกชื่อ อีเมล และรหัสผ่านอย่างน้อย 12 ตัวอักษร พร้อมยืนยันรหัสผ่านให้ตรงกัน':'กรุณากรอกอีเมลและรหัสผ่านให้ถูกต้อง'},400);
 const input=parsed.data;const ip=request.headers.get('cf-connecting-ip')||'local';
 if(await limited('ip:'+ip,100,900000)||await limited('email:'+input.email,12,900000))return response({error:'มีการลองเข้าสู่ระบบหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่'},429,{'Retry-After':'900'});
 if(action==='register'){
 const reg=signup.parse(data);const id='account:'+randomUUID();const encoded=await hashPassword(reg.password);
 const result=await env.DB.prepare('INSERT INTO accounts (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING').bind(id,reg.email,reg.name,encoded,Date.now()).run();
 if(!result.meta.changes)return response({error:'ไม่สามารถสมัครด้วยอีเมลนี้ได้ หากมีบัญชีอยู่แล้วกรุณาเข้าสู่ระบบ'},409);
 return response({user:{id,email:reg.email,name:reg.name}},201,{'Set-Cookie':await createSession(request,id,Boolean(reg.remember))});
 }
 const row=await env.DB.prepare('SELECT id, email, name, password_hash FROM accounts WHERE email = ?').bind(input.email).first<{id:string;email:string;name:string;password_hash:string}>();
 const valid=await verifyPassword(input.password,row?.password_hash||dummyHash);if(!row||!valid)return response({error:'อีเมลหรือรหัสผ่านไม่ถูกต้อง'},401);
 return response({user:{id:row.id,email:row.email,name:row.name}},200,{'Set-Cookie':await createSession(request,row.id,Boolean(input.remember))});
 }catch{return response({error:'ระบบบัญชีขัดข้องชั่วคราว กรุณาลองใหม่'},503)}
}
