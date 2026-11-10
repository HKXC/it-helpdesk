import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const directory=path.resolve('.sites-runtime/test-modules');await fs.mkdir(directory,{recursive:true});
for(const name of ['data-store','supabase-store']){let code=ts.transpileModule(await fs.readFile('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;code=code.replaceAll("'./data-store'","'./data-store.mjs'");await fs.writeFile(path.join(directory,name+'.mjs'),code)}
const {createSupabaseStore}=await import(pathToFileURL(path.join(directory,'supabase-store.mjs')).href);
const requests=[];const fake=async(url,options)=>{requests.push({url:new URL(url),options});const payload=String(url).includes('flowdesk_increment_limit')?3:String(url).includes('flowdesk_change_account')?true:[{id:'safe-row'}];return new Response(JSON.stringify(payload),{status:200})};
const store=createSupabaseStore('https://example.supabase.co','sb_secret_test_not_real',fake);
await store.select('accounts',{email:'name+tag@example.test'},['id','role'],1);let r=requests.at(-1);assert.equal(r.url.pathname,'/rest/v1/flowdesk_accounts');assert.equal(r.url.searchParams.get('email'),'eq.name+tag@example.test');assert.equal(r.options.headers.apikey,'sb_secret_test_not_real');assert.equal(r.options.headers.Authorization,undefined);assert.equal(r.options.cache,'no-store');
await store.insert('accounts',{id:'id',email:'test@example.test'},true);r=requests.at(-1);assert.equal(r.url.searchParams.get('on_conflict'),'email');assert.match(r.options.headers.Prefer,/ignore-duplicates/);
await store.patch('it_tickets',{id:3,revision:4},{revision:5});r=requests.at(-1);assert.equal(r.url.pathname,'/rest/v1/flowdesk_it_tickets');assert.equal(r.url.searchParams.get('revision'),'eq.4');assert.equal(r.options.method,'PATCH');
await store.remove('account_sessions',{account_id:'id'});assert.equal(requests.at(-1).url.pathname,'/rest/v1/flowdesk_account_sessions');
assert.equal(await store.incrementLimit('key',123),3);assert.equal(await store.changeAccount({actor:'a',target:'b',version:0,role:'it',active:1,root:'root',auditId:'audit',detail:'change',now:1}),true);
await assert.rejects(()=>store.patch('accounts',{},{}));await assert.rejects(()=>store.remove('accounts',{}));assert.throws(()=>createSupabaseStore('http://example.test','secret',fake));
const denied=createSupabaseStore('https://example.supabase.co','secret-value',async()=>new Response('sensitive provider details',{status:503}));await assert.rejects(()=>denied.select('accounts'),e=>e.message==='Supabase operation failed (503)'&&!e.message.includes('secret-value'));
console.log('PASS: Supabase adapter URL mapping, secret-key isolation, query filters, conflict conditions, guarded writes, RPC and safe errors');
