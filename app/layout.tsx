import type { Metadata } from 'next';
import './globals.css';
import { UiProvider } from '../components/ui-provider';
export const metadata: Metadata = {
  title: 'Flowdesk — IT Help Desk',
  description: 'แจ้งปัญหา ติดตามคำร้อง และดูแลทุกงาน IT ในองค์กร',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var p=JSON.parse(localStorage.getItem('flowdesk-ui')||'{}');var d=p.theme==='dark'||((!p.theme||p.theme==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}",
          }}
        />
      </head>
      <body>
        <UiProvider>{children}</UiProvider>
      </body>
    </html>
  );
}
