'use client';
import {Brand} from '../components/ratsmonitor/components/Brand';
// Last resort when even the layout could not be rendered: a complete document of its own, without the stylesheet and
// without further imports. Replaces the framework's English default page.
const frame={maxWidth:580,margin:'60px auto',padding:28,fontFamily:'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',fontSize:16,lineHeight:1.6,color:'#171717'} as const;
const action={font:'inherit',fontSize:14,minHeight:44,padding:'0 18px',border:'1px solid #171717',background:'#171717',color:'#fff',cursor:'pointer',marginRight:16} as const;
export default function GlobalError({error}:{error:Error&{digest?:string};reset?:()=>void}){
 return <html lang="de"><head><title>Seite nicht geladen · Plenara</title></head><body style={{margin:0,background:'#fff'}}><main style={frame}><div style={{display:'flex',alignItems:'center',color:'#0f172a',lineHeight:1,whiteSpace:'nowrap'}}><Brand /></div><h1 style={{fontSize:32,fontWeight:600,lineHeight:1.2,margin:'36px 0 20px'}}>Die Seite konnte gerade nicht geladen werden.</h1><p role="alert">Der Server hat die Anfrage nicht beantwortet, zum Beispiel weil ein laufender Abruf die Datenbank belegt. Gespeicherte Daten und ein laufender Auftrag bleiben erhalten.</p><p><button type="button" style={action} onClick={()=>window.location.reload()}>Seite neu laden</button><a href="/" style={{color:'#2352ad'}}>Zur Startseite</a></p>{error?.digest&&<p style={{fontSize:14,color:'#555'}}>Fehlerkennung: {error.digest}</p>}</main></body></html>;
}
