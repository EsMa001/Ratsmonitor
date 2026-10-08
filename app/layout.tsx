import type { Metadata } from 'next';
import './globals.css';
import { BRAND_NAME, DEFAULT_BRAND, pageTitle } from '@/components/ratsmonitor/lib/brands';
export const metadata:Metadata={title:pageTitle(DEFAULT_BRAND),description:'Früher wissen, was vor Ort beraten wird: Sitzungen, Vorlagen und Beschlüsse aus Ratsinformationssystemen durchsuchen, mit Originalquellen.',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:BRAND_NAME[DEFAULT_BRAND]},icons:{icon:'/favicon.svg',shortcut:'/favicon.svg',apple:'/apple-touch-icon.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="de"><body><a className="skip-link" href="#inhalt">Zum Inhalt</a>{children}</body></html>}
