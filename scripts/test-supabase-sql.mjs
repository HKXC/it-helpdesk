// Optional offline PostgreSQL validation. Install @electric-sql/pglite in
// .sites-runtime/pg-check (not a production dependency).
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '../.sites-runtime/pg-check/node_modules/@electric-sql/pglite/dist/index.js';
const pg=new PGlite();
try{
 await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 await pg.exec(await fs.readFile('supabase/migrations/001_flowdesk.sql','utf8'));
 await pg.exec(await fs.readFile('supabase/migrations/002_ui_preferences.sql','utf8'));
 await pg.exec("SET ROLE service_role;");
 await pg.query("INSERT INTO public.flowdesk_accounts(id,email,name,password_hash,created_at,role) VALUES ('root','root@example.test','Admin','test-hash',1,'admin'),('employee','employee@example.test','Employee','test-hash',1,'employee')");
 assert.equal((await pg.query('SELECT public.flowdesk_increment_limit($1,$2) AS count',['key',100])).rows[0].count,1);
 assert.equal((await pg.query('SELECT public.flowdesk_increment_limit($1,$2) AS count',['key',100])).rows[0].count,2);
 await pg.query("INSERT INTO public.flowdesk_account_sessions(token_hash,account_id,expires_at,created_at) VALUES ('token','employee',100,1)");
 const input={actor:'root',target:'employee',version:0,role:'it',active:1,root:'root',auditId:'audit-1',detail:'test',now:2};
 assert.equal((await pg.query('SELECT public.flowdesk_change_account($1::jsonb) AS ok',[JSON.stringify(input)])).rows[0].ok,true);
 assert.equal((await pg.query("SELECT role FROM public.flowdesk_accounts WHERE id='employee'")).rows[0].role,'it');
 assert.equal((await pg.query('SELECT count(*)::int AS count FROM public.flowdesk_account_sessions')).rows[0].count,0);
 assert.equal((await pg.query('SELECT public.flowdesk_change_account($1::jsonb) AS ok',[JSON.stringify({...input,auditId:'audit-stale'})])).rows[0].ok,false);
 assert.equal((await pg.query('SELECT public.flowdesk_change_account($1::jsonb) AS ok',[JSON.stringify({...input,target:'root',role:'employee'})])).rows[0].ok,false);
 assert.equal((await pg.query('SELECT count(*)::int AS count FROM public.flowdesk_role_audit')).rows[0].count,1);
 await pg.query("INSERT INTO public.flowdesk_it_tickets(requester_id,body,created_at,updated_at) VALUES ('employee','{}',1,1)");
 const first=await pg.query('UPDATE public.flowdesk_it_tickets SET revision=2 WHERE id=1 AND revision=1 RETURNING id');assert.equal(first.rows.length,1);
 const stale=await pg.query('UPDATE public.flowdesk_it_tickets SET revision=3 WHERE id=1 AND revision=1 RETURNING id');assert.equal(stale.rows.length,0);
 const pw={id:'employee',oldHash:'test-hash',newHash:'new-test-hash',tokenHash:'new-token',expires:300,now:20};
 assert.equal((await pg.query('SELECT public.flowdesk_change_password($1::jsonb) AS ok',[JSON.stringify(pw)])).rows[0].ok,true);
 assert.equal((await pg.query('SELECT public.flowdesk_change_password($1::jsonb) AS ok',[JSON.stringify(pw)])).rows[0].ok,false);
 assert.equal((await pg.query("SELECT count(*)::int AS count FROM public.flowdesk_account_sessions WHERE token_hash='new-token'")).rows[0].count,1);
 await pg.query("UPDATE public.flowdesk_accounts SET locale='en',theme='dark',onboarding_completed=1 WHERE id='employee'");
 assert.equal((await pg.query("SELECT locale FROM public.flowdesk_accounts WHERE id='employee'")).rows[0].locale,'en');
 await pg.exec('RESET ROLE; SET ROLE anon;');
 await assert.rejects(()=>pg.query('SELECT public.flowdesk_change_password($1::jsonb)',[JSON.stringify(pw)]));
 await assert.rejects(()=>pg.query('SELECT * FROM public.flowdesk_accounts'));
 await assert.rejects(()=>pg.query('SELECT public.flowdesk_increment_limit($1,$2)',['denied',1]));
 await pg.exec('RESET ROLE; SET ROLE authenticated;');
 await assert.rejects(()=>pg.query('SELECT * FROM public.flowdesk_it_tickets'));
 console.log('PASS: PostgreSQL schema, RPC transactions, rate-limit increment, role CAS, audit append, session revocation, protected root, ticket CAS and anonymous/authenticated database denial');
}finally{await pg.close()}
