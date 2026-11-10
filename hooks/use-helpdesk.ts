"use client";
import {useState,useEffect,useRef,useCallback,type SetStateAction} from 'react';
import type {Job} from '../lib/helpdesk';
type Reply={jobs:Job[];revision:number;account:string;error?:string};
export function useHelpdesk(){
 const [jobs,setJobs]=useState<Job[]>([]),[status,setStatus]=useState<'loading'|'saved'|'saving'|'error'|'conflict'>('loading'),[error,setError]=useState(''),[account,setAccount]=useState('');
 const current=useRef<Job[]>([]),revision=useRef(0),busy=useRef(false),loaded=useRef(false),statusRef=useRef(status);
 statusRef.current=status;
 const reload=useCallback(async()=>{setStatus('loading');setError('');loaded.current=false;try{const r=await fetch('/api/helpdesk',{cache:'no-store'});const data=await r.json() as Reply;if(r.status===401)window.dispatchEvent(new Event('flowdesk-session-expired'));if(!r.ok)throw new Error(data.error||'โหลดข้อมูลไม่สำเร็จ');current.current=data.jobs;revision.current=data.revision;setJobs(data.jobs);setAccount(data.account);loaded.current=true;setStatus('saved')}catch(e){setStatus('error');setError(e instanceof Error?e.message:'โหลดข้อมูลไม่สำเร็จ')}},[]);
 useEffect(()=>{reload()},[reload]);
 useEffect(()=>{if(!loaded.current||!['saving','error','conflict'].includes(status))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[status]);
 const save=useCallback(async(next:Job[])=>{if(busy.current)return false;busy.current=true;setStatus('saving');setError('');try{const r=await fetch('/api/helpdesk',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:revision.current,jobs:next})});const data=await r.json() as Reply;if(r.status===401)window.dispatchEvent(new Event('flowdesk-session-expired'));if(!r.ok){setStatus(r.status===409?'conflict':'error');setError(data.error||'บันทึกไม่สำเร็จ');return false}revision.current=data.revision;setStatus('saved');return true}catch{setStatus('error');setError('เชื่อมต่อไม่ได้ ข้อมูลที่แก้ยังอยู่บนหน้านี้ กรุณาลองบันทึกอีกครั้ง');return false}finally{busy.current=false}},[]);
 const change=useCallback((action:SetStateAction<Job[]>)=>{if(!loaded.current||busy.current||['conflict','error'].includes(statusRef.current))return false;const next=typeof action==='function'?action(current.current):action;current.current=next;setJobs(next);void save(next);return true},[save]);
 const retry=()=>loaded.current?save(current.current):reload();
 return {jobs,change,status,error,account,reload,retry,canEdit:status==='saved'};
}
