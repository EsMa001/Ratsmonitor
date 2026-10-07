import {notFound} from 'next/navigation';
export default async function Page({params}:{params:Promise<{section?:string[]}>}){const {section=[]}=await params;if(section.length>1||(section[0]&&!['ueber','diffusion','graph','trends','vergleich'].includes(section[0])))notFound();return null;}
