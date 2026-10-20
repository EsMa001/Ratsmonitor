'use client';
import {useEffect} from 'react';
import {Brand} from '../components/ratsmonitor/components/Brand';
import {reportError} from '../components/ratsmonitor/lib/reportError';
// Last resort when even the layout could not be rendered: a complete document of its own, without the stylesheet and
// without further imports. Replaces the framework's English default page.
const frame={maxWidth:580,margin:'60px auto',padding:28,fontFamily:'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',fontSize:16,lineHeight:1.6,color:'#18181b'} as const;
const action={font:'inherit',fontSize:14,minHeight:44,padding:'0 18px',border:'1px solid #18181b',background:'#18181b',color:'#fff',cursor:'pointer',marginRight:16} as const;
export default function GlobalError({error}:{error:Error&{digest?:string};reset?:()=>void}){
 useEffect(()=>{reportError('render',error);},[error]);
// eslint-disable-next-line @next/next/no-html-link-for-pages -- eigene Seite ohne Router (global-error), nur ein einfacher Link geht
 return <html lang="de"><head><title>Seite nicht geladen · plenara</title></head><body style={{margin:0,background:'#fff'}}><main style={frame}><div style={{display:'flex',alignItems:'center',color:'#18181b',lineHeight:1,whiteSpace:'nowrap'}}><Brand /></div><h1 style={{fontSize:32,fontWeight:600,lineHeight:1.2,margin:'36px 0 20px'}}>Die Seite konnte gerade nicht geladen werden.</h1><p role="alert">Der Server hat die Anfrage nicht beantwortet, zum Beispiel weil ein laufender Abruf die Datenbank belegt. Gespeicherte Daten und ein laufender Auftrag bleiben erhalten.</p><p><button type="button" style={action} onClick={()=>window.location.reload()}>Seite neu laden</button><a href="/" style={{color:'#29467a'}}>Zur Startseite</a></p>{error?.digest&&<p style={{fontSize:14,color:'#52525b'}}>Fehlerkennung: {error.digest}</p>}</main></body></html>;
}
