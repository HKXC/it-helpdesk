import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Flowdesk — IT Help Desk',description:'แจ้งปัญหา ติดตามคำร้อง และดูแลทุกงาน IT ในองค์กร'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="th"><body>{children}</body></html>}
