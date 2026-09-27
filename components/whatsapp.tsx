'use client';
import {Share2} from 'lucide-react';
import {useEffect,useState} from 'react';
export function WhatsApp({id,title,large=false}:{id:string;title:string;large?:boolean}){const[url,setUrl]=useState('');useEffect(()=>setUrl(new URL('/thema/'+encodeURIComponent(id),window.location.origin).href),[id]);return <a className={large?'button button--primary':'share-button'} aria-label={'„'+title+'“ über WhatsApp teilen'} href={url?'https://wa.me/?text='+encodeURIComponent(title+'\n'+url):undefined} target="_blank" rel="noopener noreferrer"><Share2 size={large?20:18}/><span>{large?'Per WhatsApp teilen':'WhatsApp'}</span></a>}
