import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
// Run against a built LOCAL Worker only: npm start -- --port 5174.
const origin='http://127.0.0.1:5174';
const uid='qa-'+crypto.randomUUID();
const headers=(id=uid)=>({'oai-authenticated-user-id':id,'oai-authenticated-user-email':'qa@example.test','Content-Type':'application/json',Origin:origin});
function request(method,body,h=headers()) {const args=['--max-time','15','-sS','-X',method,'-w','\n%{http_code}'];for(const [key,value] of Object.entries(h))args.push('-H',key+': '+value);if(body!==undefined)args.push('--data-binary','@-');args.push(origin+'/api/helpdesk');const output=execFileSync(process.platform==='win32'?'curl.exe':'curl',args,{encoding:'utf8',input:body===undefined?undefined:JSON.stringify(body)});const cut=output.lastIndexOf('\n');return {status:Number(output.slice(cut+1)),data:JSON.parse(output.slice(0,cut))}}
const sample={id:1029,title:'ทดสอบการบันทึก',category:'อุปกรณ์',status:'เปิดใหม่',priority:'ปกติ',person:'QA',agent:'ยังไม่มอบหมาย',detail:'ข้อมูลทดสอบในฐานข้อมูล local เท่านั้น',comments:[]};

let result=await request('GET');assert.equal(result.status,200);assert.deepEqual(result.data.jobs,[]);assert.equal(result.data.revision,0);
result=await request('PUT',{revision:0,jobs:[sample]});assert.equal(result.status,200);assert.equal(result.data.revision,1);
result=await request('GET');assert.equal(result.data.jobs[0].title,sample.title);assert.equal(result.data.revision,1);
assert.deepEqual((await request('GET',undefined,headers(uid+'-other'))).data.jobs,[],'accounts are isolated');
assert.equal((await request('PUT',{revision:0,jobs:[]})).status,409,'stale writes rejected');
assert.equal((await request('PUT',{revision:1,jobs:[{...sample,status:'invalid'}]})).status,400,'invalid status rejected');
assert.equal((await request('PUT',{revision:1,jobs:[sample,sample]})).status,400,'duplicate IDs rejected');
assert.equal((await request('PUT',{revision:1,jobs:[]},{...headers(),Origin:'https://other.example'})).status,403,'cross-origin write rejected');
assert.equal((await request('PUT',{revision:1,jobs:[]},{...headers(),'Content-Type':'text/plain'})).status,415,'non-JSON write rejected');
result=await request('PUT',{revision:1,jobs:[{...sample,status:'แก้ไขแล้ว',resolution:'ทดสอบสำเร็จ'}]});assert.equal(result.status,200);assert.equal(result.data.revision,2);
result=await request('GET');assert.equal(result.data.jobs[0].resolution,'ทดสอบสำเร็จ');assert.equal(result.data.revision,2);
assert.equal((await request('GET',undefined,{})).status,401,'anonymous read rejected');
assert.equal((await request('PUT',{revision:0,jobs:[]},{})).status,401,'anonymous write rejected');
console.log('PASS: authentication, account isolation, persistence, optimistic concurrency, validation, and request-origin protection');
