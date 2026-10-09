'use client';
import {useRef,useState} from 'react';
const n=(v:number)=>v.toLocaleString('de-DE');
type Step={error?:string;completed?:number;noText?:number;failed?:number;skipped?:number;more?:boolean;cursor?:string};
/** Admin-Auftrag „Regelbasierter Auszug“: bis zu fünf Originalsätze für Berichte ohne KI-Zusammenfassung. Startet nur auf Klick. */
export function AdminExcerpt({areas}:{areas:{id:string;name:string}[]}){
 const [running,setRunning]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[sum,setSum]=useState({completed:0,noText:0,failed:0}),stop=useRef(false);
 async function run(){
  stop.current=false;setRunning(true);setError('');setMessage('');const total={completed:0,noText:0,failed:0};setSum(total);
  try{
   for(let i=0;i<areas.length&&!stop.current;i++){
    let after='';
    for(;;){
     setMessage(`${areas[i].name} (${i+1} von ${areas.length}) …`);
     const r=await fetch('/api/admin/analyse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({region:areas[i].id,mode:'excerpt',after}),signal:AbortSignal.timeout(60000)}),d=await r.json() as Step;
     if(!r.ok)throw Error(d.error||'Auszug fehlgeschlagen.');
     total.completed+=d.completed||0;total.noText+=d.noText||0;total.failed+=d.failed||0;setSum({...total});
     if(!d.more||stop.current)break;
     after=d.cursor||'';
    }
   }
   setMessage(stop.current?'Angehalten. Gespeicherte Auszüge bleiben erhalten; ein neuer Start setzt fort.':'Fertig.');
  }catch(e){setError(e instanceof Error&&e.name!=='TimeoutError'?e.message:'Die Antwort dauert länger. Bitte später erneut starten; gespeicherte Auszüge bleiben erhalten.');}
  finally{setRunning(false);}
 }
 return <section className="admin-pipeline" id="abruf-auszug"><div className="admin-section-heading"><h2>Regelbasierten Auszug erstellen</h2><span>{areas.length?`${n(areas.length)} Gebiete in der Auswahl`:'Bitte oben Gebiete auswählen'}</span></div>
  <p className="mt-1 max-w-[820px] text-[14px] text-slate-500">Für Berichte ohne KI-Zusammenfassung werden bis zu fünf Sätze wörtlich aus der Originalunterlage übernommen: Beschluss, Anlass, Kern, Zahlen und Fristen. Nichts wird umformuliert. Der Bericht trägt den Hinweis „Automatischer Auszug aus der Originalunterlage, keine KI-Zusammenfassung“. KI-Zusammenfassungen bleiben unverändert. Das Dokument wird nur zum Auslesen geladen und nicht gespeichert. Pro Schritt werden bis zu 8 Dokumente gelesen.</p>
  <div className="admin-selection-actions mt-3">{running?<button type="button" className="btn-secondary btn-sm" onClick={()=>{stop.current=true;}}>Nach dem laufenden Schritt anhalten</button>:<button type="button" className="btn-secondary btn-sm" disabled={!areas.length} onClick={()=>void run()}>Auszug für die Auswahl erstellen</button>}</div>
  {(running||message)&&<p role="status" className="mt-2 text-[14px] text-slate-500">{message}{(sum.completed||sum.noText||sum.failed)?` · ${n(sum.completed)} Auszüge erstellt, ${n(sum.noText)} ohne lesbaren Text, ${n(sum.failed)} nicht abrufbar`:''}</p>}
  {error&&<p role="alert" className="mt-2 text-[14px]">{error}</p>}
 </section>;
}
