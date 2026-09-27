import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'vor Ort · Politik für deine Region',description:'Kommunalpolitik in NRW: öffentliche Vorhaben, Beratungen und Beschlüsse verständlich erklärt, mit Originalquellen.',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'vor Ort'},icons:{icon:'/favicon.svg',shortcut:'/favicon.svg',apple:'/apple-touch-icon.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="de"><body><a className="skip-link" href="#inhalt">Zum Inhalt</a>{children}</body></html>}
