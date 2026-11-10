import {randomBytes,scrypt,timingSafeEqual,createHash} from 'node:crypto';
const params={N:32768,r:8,p:3,maxmem:64*1024*1024};
function derive(password:string,salt:string){return new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,params,(err,key)=>err?reject(err):resolve(key)))}
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return `scrypt-v1$${salt}$${(await derive(password,salt)).toString('hex')}`}
export async function verifyPassword(password:string,encoded:string){const [version,salt,hex]=encoded.split('$');if(version!=='scrypt-v1'||!salt||!hex)return false;const actual=await derive(password,salt);const expected=Buffer.from(hex,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected)}
export const dummyHash='scrypt-v1$00000000000000000000000000000000$'+'00'.repeat(64);
export const randomToken=()=>randomBytes(32).toString('hex');
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
