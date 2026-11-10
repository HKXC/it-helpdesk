import {identifier,type DataStore,type Filters,type Row,type Table} from './data-store';
// Server-only adapter. Never import it from a client component.
export function createSupabaseStore(base:string,secret:string,send:typeof fetch=fetch):DataStore{
 const origin=new URL(base);if(origin.protocol!=='https:')throw Error('Supabase requires HTTPS');
 const root=origin.origin+'/rest/v1/';
 const headers:Record<string,string>={apikey:secret,'Content-Type':'application/json',Prefer:'return=representation'};
 if(secret.startsWith('eyJ'))headers.Authorization='Bearer '+secret;
 async function call(path:string,method:string,body?:unknown,extra:Record<string,string>={}){const r=await send(root+path,{method,headers:{...headers,...extra},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Supabase operation failed ('+r.status+')');if(r.status===204)return null;const text=await r.text();return text?JSON.parse(text):null}
 function query(where:Filters={}){const q=new URLSearchParams();for(const [k,v] of Object.entries(where)){identifier(k);if(v===null)q.set(k,'is.null');else if(typeof v==='object'&&v&&'lt'in v)q.set(k,'lt.'+v.lt);else if(typeof v==='object'&&v&&'gt'in v)q.set(k,'gt.'+v.gt);else q.set(k,'eq.'+String(v))}return q}
 return{
 async select(table,where={},columns=['*'],limit=5000){const q=query(where);q.set('select',columns.map(c=>c==='*'?c:identifier(c)).join(','));q.set('limit',String(limit));return await call(identifier('flowdesk_'+table)+'?'+q,'GET') as Row[]},
 async insert(table,row,ignore=false){Object.keys(row).forEach(identifier);const result=await call(identifier('flowdesk_'+table)+(ignore&&['accounts','it_tickets'].includes(table)?'?on_conflict='+(table==='accounts'?'email':'legacy_key'):''),'POST',row,ignore?{Prefer:'return=representation,resolution=ignore-duplicates'}:{});return result?.[0]??null},
 async patch(table,where,row){if(!Object.keys(where).length)throw Error('Filtered update required');Object.keys(row).forEach(identifier);return await call(identifier('flowdesk_'+table)+'?'+query(where),'PATCH',row) as Row[]},
 async remove(table,where){if(!Object.keys(where).length)throw Error('Filtered delete required');await call(identifier('flowdesk_'+table)+'?'+query(where),'DELETE')},
 async incrementLimit(key,expires){return Number(await call('rpc/flowdesk_increment_limit','POST',{p_key:key,p_expires:expires}))},
 async changeAccount(input){return Boolean(await call('rpc/flowdesk_change_account','POST',{p_input:input}))}
 };
}
