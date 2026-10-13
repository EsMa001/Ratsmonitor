import {notFound,redirect} from 'next/navigation';
// /konto und die frühere Seite /konto/hilfe führen auf das Profil
export default async function Page({params}:{params:Promise<{section?:string[]}>}){const {section=[]}=await params;if(!section.length||section[0]==='hilfe')redirect('/konto/profil');if(section.length>1||!['suchen','profil','artikel','kalender','postfach'].includes(section[0]))notFound();return null;}
