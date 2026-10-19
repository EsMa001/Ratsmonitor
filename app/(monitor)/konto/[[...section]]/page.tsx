import {notFound,redirect} from 'next/navigation';
import {privateMeta} from '../../page-meta';
export const metadata=privateMeta('Konto');
// /konto und die frühere Seite /konto/hilfe führen auf das Profil; das Postfach (Dev-Postausgang) gibt es nur in der Entwicklung
export default async function Page({params}:{params:Promise<{section?:string[]}>}){const {section=[]}=await params;if(!section.length||section[0]==='hilfe')redirect('/konto/profil');if(section.length>1||!['suchen','profil','artikel','kalender','benachrichtigungen','willkommen',...(process.env.NODE_ENV==='production'?[]:['postfach'])].includes(section[0]))notFound();return null;}
