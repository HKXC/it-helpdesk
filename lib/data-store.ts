export type Row=Record<string,unknown>;
export type Filters=Record<string,unknown|{lt:number}|{gt:number}>;
export const tables=['accounts','account_sessions','auth_rate_limits','helpdesk_workspaces','it_tickets','role_audit'] as const;
export type Table=typeof tables[number];
export interface DataStore{
 select(table:Table,where?:Filters,columns?:string[],limit?:number):Promise<Row[]>;
 insert(table:Table,row:Row,ignore?:boolean):Promise<Row|null>;
 patch(table:Table,where:Filters,row:Row):Promise<Row[]>;
 remove(table:Table,where:Filters):Promise<void>;
 incrementLimit(key:string,expires:number):Promise<number>;
 changeAccount(input:{actor:string;target:string;version:number;role:string;active:number;root:string;auditId:string;detail:string;now:number}):Promise<boolean>;
 changePassword(input:{id:string;oldHash:string;newHash:string;tokenHash:string;expires:number;now:number}):Promise<boolean>;
}
export function identifier(s:string){if(!/^[a-z][a-z_]*$/.test(s))throw Error('Invalid database identifier');return s}
