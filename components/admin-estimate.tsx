'use client';
import {useEffect,useState,type ReactNode} from 'react';
type Range={perYear:number;lowPerYear:number;highPerYear:number};
type Model={n:number;measured:boolean;slope:number;typical:number;smear:number;shrink:number;scatter:number;states:Record<string,{n:number;raw:number;factor:number}>};
type Level=Range&{id:string;name:string;samples:number;model:Model|null;assumed:boolean};
type SizeClass=Range&{id:string;name:string;range:string;level:string;basis:'measured'|'thin'|'model'|'assumed'|'none';samples:number;germany:{count:number;population:number}};
type FederalState=Range&{id:string;name:string;municipalities:number;districts:number;associations:number;boroughs:number;population:number;samples:number;factors:Record<string,{examples:number;factor:number}|null>;perDay:number;per1000:number;ownShare:number};
type Example={id:string;name:string;origin:'stored'|'sample';level:string;class:string;state:string;population:number;reports:number;method:string|null;reason?:string};
type Provisional=Example&{reason:string;annual:number;weeks:number;connected:boolean};
type Stratum={id:string;name:string;drawn:number;connected:number;sampleExamples:number;storedWithData:number;storedExamples:number;candidates:{id:string;name:string;population:number}[]};
type Capture={classes:{id:string;name:string;units:number;counts:{connected:number;unreadable:number;unknown:number};connected:number|null;unreadable:number|null;known:{areas:number;connected:number};perYear:{connected:number;unreadable:number;unknown:number;knownOpen:number;total:number}}[];total:{connected:number;unreadable:number;unknown:number;knownOpen:number;total:number;connectedShare:number}};
type Metric={perYear:number;perDay:number;lowPerYear:number;highPerYear:number};
type Distribution={median:number;mean:number;p90:number;top10Share:number};
type Stat={median:number;mean:number;p90:number;max:number}|null;
type Volume={classes:{id:string;name:string;reportsPerYear:number;documentShare:number;withDocumentsPerYear:number;areas:number;sampled:number;pooled:boolean;means:Record<string,number>;perYear:Record<string,number>}[];states:{id:string;name:string;reportsPerYear:number;withDocumentsPerYear:number;perYear:Record<string,number>}[];withDocumentsPerYear:number;total:Record<string,Metric>;variants:{id:string;name:string;detail:string;perYear:number;perDay:number;lowPerDay:number;highPerDay:number;perReport:number}[];perReport:{pages:Distribution;tokens:Distribution;documents:Distribution};sample:{areas:number;reports:number}};
type Kind={documents:number;pages:number;tokens:number;bytes:number};
type Size={measuredAt:string;tokenizer:string|null;charsPerToken:number;charsPerTokenOther:number|null;perArea:number;areas:number;reports:number;documents:{tried:number;failed:number;read:number;large:number;largeBytes:number;notPdf:number;scans:number;pages:number;scanPages:number;bytes:number;tokens:number;perDocument:{pages:Stat;tokens:Stat;bytes:Stat};bins:(Kind&{id:string;label:string})[];types:Record<string,Kind>}};
type Season={weeks:number[];weekdays:number[];monthly:number[];strongWeek:number;quietWeeks:number;peakWeekday:number;followUpShare:number;consultationsPerReport:number;peakDay:number;followUpsPerYear:number};
type Validation={n:number;medianError:number|null;bias:number|null;within50:number|null;states:{level:string;state:string;name:string;examples:number;actual:number;predicted:number;error:number}[]};
type Estimate={asOf:string;from:string;to:string;frame:{source:string;populationYear:string;municipalities:number;population:number;districts:number;associations:number;memberMunicipalities:number;boroughs:number;units:Record<string,number>};
 sample:{builtAt:string;from:string;to:string;design:string;units:number;connected:number;counted:number;storedWithData:number;strata:Stratum[]};examples:Example[];excluded:Example[];provisional:Provisional[];
 classes:SizeClass[];states:FederalState[];levels:Level[];validation:Validation;sampleCount:number;basis:{own:number;typical:number;borrowed:number};total:Range&{perDay:number;lowPerDay:number;highPerDay:number;perWorkday:number};
 capture:Capture;documents:{share:number;byClass:Record<string,number>;linksPerReport:number|null};volume:Volume|null;size:Size|null;season:Season;
 rules:{minMonths:number;startSlackDays:number;endSlackDays:number;gapFactor:number;maxUnreadableMeetings:number;workdaysPerYear:number;minForModel:number;replicates:number;capTokens:number;primaryChars:number;primaryPages:number;maxBytes:number}};
const n=(v:number|null|undefined,digits=0)=>v===null||v===undefined||!Number.isFinite(v)?'–':v.toLocaleString('de-DE',{maximumFractionDigits:digits,minimumFractionDigits:digits});
// Estimates are shown rounded to three significant digits, so the figures do not suggest more precision than they have.
const round=(v:number|null|undefined)=>{if(v===null||v===undefined||!Number.isFinite(v))return '–';if(v<100)return n(Math.round(v));const p=10**(Math.floor(Math.log10(v))-2);return n(Math.round(v/p)*p);};
const big=(v:number)=>v>=1e9?n(v/1e9,v>=1e10?1:2)+' Mrd.':v>=1e6?n(v/1e6,v>=1e8?0:1)+' Mio.':round(v);
const bytes=(v:number)=>v>=1e12?n(v/1e12,1)+' TB':v>=1e9?n(v/1e9,v>=1e10?0:1)+' GB':v>=1e6?n(v/1e6,v>=1e7?0:1)+' MB':n(v/1e3)+' KB';
const pct=(v:number|null|undefined,digits=0)=>v===null||v===undefined?'–':n(100*v,digits)+' %';
const signed=(v:number)=>(v>0?'+':v<0?'−':'±')+n(Math.abs(100*v))+' %';
const day=(s:string)=>s.split('-').reverse().join('.');
const short=(name:string)=>name.replace(/^(Stadt|Gemeinde|Kreis|Landkreis) /,'');
const BASIS={measured:'aus Beispielen gerechnet',thin:'dünn belegt: wenige Beispiele',model:'kein eigenes Beispiel: Modell verlängert',assumed:'angenommen: Kurve der Gemeinden',none:'kein Beispiel'};
type DataKind='counted'|'model'|'assumed';
const KIND_NAMES:Record<DataKind,string>={counted:'gezählt',model:'gerechnet',assumed:'angenommen'};
/** Marks what a figure rests on: counted or measured for real, calculated from such data, or assumed without data of its own. */
const Tag=({kind,children}:{kind:DataKind;children?:ReactNode})=><span className={'admin-estimate-tag is-'+kind}>{children||KIND_NAMES[kind]}</span>;
const UNIT:Record<string,[string,string]>={municipality:['Gemeinde','Gemeinden'],district:['Kreis','Kreise'],association:['Verband','Verbände'],borough:['Bezirk','Bezirke']};
const TYPES:Record<string,string>={paper:'Vorlage, Antrag, Anfrage',decision:'Beschlusstext, Auszug',attachment:'Anlage',minutes:'Niederschrift, Protokoll',invitation:'Einladung, Bekanntmachung, Sitzungsmappe',other:'Sonstiges (Titel ohne erkennbare Art, meist Anlagen)'};
const SYSTEMS:Record<string,string>={oparl:'OParl',sessionnet:'SessionNet','more-rubin':'More! Rubin',sdnet:'SD.NET',allris:'ALLRIS',scraper:'SessionNet'};
const WEEKDAYS=['Mo','Di','Mi','Do','Fr','Sa','So'],MONTHS=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const at=(m:Model,population:number)=>Math.exp(m.typical+m.slope*Math.log(population))*m.smear;
const stateName=(states:FederalState[],id:string)=>states.find(s=>s.id===id)?.name||id;
const weekStart=(from:string,i:number)=>new Date(Date.parse(from+'T00:00:00Z')+i*7*86400000);
/** Examples of one level against their inhabitants, both on logarithmic axes, with the model for a typical state. */
function Scatter({level,examples,provisional}:{level:Level;examples:Example[];provisional:Provisional[]}){
 const own=examples.filter(e=>e.level===level.id&&e.reports>0&&e.population>0),m=level.model;
 if(!own.length||!m)return null;
 // Areas without a complete year: their yearly figure is projected from the weeks they cover.
 const open=provisional.filter(e=>e.level===level.id&&e.annual>=1&&e.population>0);
 const W=440,H=330,L=72,R=30,T=12,B=54,lx=[...own,...open].map(e=>Math.log10(e.population)),ly=[...own.map(e=>e.reports),...open.map(e=>e.annual)].map(v=>Math.log10(v));
 const x0=Math.floor(Math.min(...lx)),x1=Math.max(x0+1,Math.ceil(Math.max(...lx))),y0=Math.floor(Math.min(...ly)),y1=Math.max(y0+1,Math.ceil(Math.max(...ly)));
 const x=(v:number)=>L+(v-x0)/(x1-x0)*(W-L-R),y=(v:number)=>T+(H-T-B)*(1-(v-y0)/(y1-y0)),clampY=(v:number)=>Math.min(y1,Math.max(y0,v));
 const decades=(a:number,b:number)=>Array.from({length:b-a+1},(_,i)=>a+i),label=(e:number)=>e>=6?n(10**(e-6))+' Mio.':n(10**e);
 const line=(e:number)=>clampY(Math.log10(at(m,10**e))),[one]=UNIT[level.id];
 return <figure><figcaption>{level.name}: {n(own.length)} Beispiele <Tag kind="counted"/>{open.length>0&&<> + {n(open.length)} mit Teilbestand <Tag kind="assumed">hochgerechnet</Tag></>}</figcaption>
  <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${level.name}: Berichte pro Jahr (senkrecht) gegen Einwohner (waagerecht) für ${own.length} Beispiele, beide Achsen logarithmisch. Die Werte stehen in der Liste der Beispielgebiete.`}>
   {decades(y0,y1).map(e=><g key={'y'+e}><line x1={L} x2={W-R} y1={y(e)} y2={y(e)} stroke={e===y0?'#8a8a8a':'#e3e3e3'}/><text x={L-8} y={y(e)+4} textAnchor="end" fontSize="12" fill="#555">{label(e)}</text></g>)}
   {decades(x0,x1).map(e=><g key={'x'+e}><line x1={x(e)} x2={x(e)} y1={T} y2={H-B} stroke={e===x0?'#8a8a8a':'#e3e3e3'}/><text x={x(e)} y={H-B+17} textAnchor="middle" fontSize="12" fill="#555">{label(e)}</text></g>)}
   <text x={(L+W-R)/2} y={H-10} textAnchor="middle" fontSize="14" fill="#171717">Einwohner</text>
   <text transform={`translate(16 ${(T+H-B)/2}) rotate(-90)`} textAnchor="middle" fontSize="14" fill="#171717">Berichte pro Jahr</text>
   {open.map(e=>{const title=`${e.name}: ${n(e.population)} Einwohner, ${n(e.reports)} Berichte in ${n(e.weeks)} Wochen, aufs Jahr hochgerechnet rund ${round(e.annual)}. Nicht in der Rechnung: ${e.reason}.`,cx=x(Math.log10(e.population)),cy=y(Math.log10(e.annual));return e.origin==='stored'?<circle key={e.id} cx={cx} cy={cy} r="3.5" fill="#fff" fillOpacity=".6" stroke="#2352ad" strokeOpacity=".55" strokeWidth="1.2"><title>{title}</title></circle>:<rect key={e.id} x={cx-3.2} y={cy-3.2} width="6.4" height="6.4" fill="#fff" fillOpacity=".6" stroke="#b4530a" strokeOpacity=".6" strokeWidth="1.2"><title>{title}</title></rect>;})}
   <line x1={x(x0)} y1={y(line(x0))} x2={x(x1)} y2={y(line(x1))} stroke="#171717" strokeWidth="2"/>
   {own.map(e=>e.origin==='stored'?<circle key={e.id} cx={x(Math.log10(e.population))} cy={y(Math.log10(e.reports))} r="4.5" fill="#2352ad" fillOpacity=".75" stroke="#fff" strokeWidth="1"><title>{`${e.name}: ${n(e.population)} Einwohner, ${n(e.reports)} Berichte`}</title></circle>
    :<rect key={e.id} x={x(Math.log10(e.population))-4} y={y(Math.log10(e.reports))-4} width="8" height="8" fill="#b4530a" fillOpacity=".8" stroke="#fff" strokeWidth="1"><title>{`${e.name}: ${n(e.population)} Einwohner, ${n(e.reports)} Berichte`}</title></rect>)}
  </svg>
  <p className="admin-estimate-explain">Jeder Punkt ist ein Gebiet mit einem gezählten Jahr: je weiter rechts, desto mehr Einwohner; je weiter oben, desto mehr Berichte. Die Linie ist das Modell und beruht nur auf den gefüllten Punkten. {open.length>0?'Hohle Punkte sind Gebiete mit Berichten, aber ohne vollständiges Jahr: Ihr Jahreswert ist aus den vorhandenen Wochen hochgerechnet und geht nicht in die Rechnung ein. ':''}{m.slope<.1?`Sie verläuft fast waagerecht: Ein ${one} hat unabhängig von seiner Größe ähnlich viele Berichte.`:`Sie steigt: Bei doppelter Einwohnerzahl erwartet das Modell ${signed(2**m.slope-1)} Berichte.`}</p>
 </figure>;
}
/** Bars over a value axis in steps of one half; the exact figures are in the bar titles. */
function Bars({values,labels,ticks,unit,reference,xTitle,yTitle}:{values:number[];labels:(i:number)=>string;ticks:(i:number)=>string|null;unit:string;reference?:number;xTitle:string;yTitle:string}){
 const W=880,H=250,L=66,R=8,T=12,B=52,max=Math.max(.5,Math.ceil(Math.max(...values,reference||0)*2)/2),step=(W-L-R)/values.length,y=(v:number)=>T+(H-T-B)*(1-v/max);
 const marks=Array.from({length:Math.round(max*2)+1},(_,i)=>i/2);
 return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={unit}>
  {marks.map(v=><g key={v}><line x1={L} x2={W-R} y1={y(v)} y2={y(v)} stroke={v?'#e3e3e3':'#8a8a8a'}/><text x={L-8} y={y(v)+4} textAnchor="end" fontSize="12" fill="#555">{n(v,1)}</text></g>)}
  {values.map((v,i)=>{const tick=ticks(i);return <g key={i}><rect x={L+i*step+Math.min(2,step*.12)} y={y(v)} width={Math.max(1,step-Math.min(4,step*.24))} height={Math.max(0,H-B-y(v))} fill="#2352ad"><title>{labels(i)}</title></rect>{tick&&<><line x1={L+i*step} x2={L+i*step} y1={H-B} y2={H-B+5} stroke="#8a8a8a"/><text x={L+i*step+3} y={H-B+18} fontSize="12" fill="#555">{tick}</text></>}</g>;})}
  {reference!==undefined&&<><line x1={L} x2={W-R} y1={y(reference)} y2={y(reference)} stroke="#171717" strokeDasharray="5 4"/></>}
  <text x={(L+W-R)/2} y={H-8} textAnchor="middle" fontSize="14" fill="#171717">{xTitle}</text>
  <text transform={`translate(16 ${(T+H-B)/2}) rotate(-90)`} textAnchor="middle" fontSize="14" fill="#171717">{yTitle}</text>
 </svg>;
}
const Share=({value}:{value:number})=><span className="admin-estimate-share"><span style={{width:Math.max(0,Math.min(100,100*value))+'%'}}/></span>;
/** Germany-wide estimate of new reports and of the documents behind them, with every step of the derivation. Reads only. */
export function AdminEstimate({revision,initial}:{revision:number;initial?:Estimate}){
 const [loaded,setLoaded]=useState<Record<number,Estimate>>(initial?{[revision]:initial}:{}),[failed,setFailed]=useState<Record<number,string>>({}),[busy,setBusy]=useState(false),[loadedAt,setLoadedAt]=useState(0);
 const data=loaded[revision],error=failed[revision]||'';
 useEffect(()=>{
  if(loaded[revision]||failed[revision])return;const c=new AbortController();
  fetch('/api/admin/estimate',{cache:'no-store',signal:c.signal}).then(async r=>{const d=await r.json() as Estimate&{error?:string};if(!r.ok)throw Error(d.error||'Hochrechnung konnte nicht geladen werden.');setLoaded(prev=>({...prev,[revision]:d}));setLoadedAt(Date.now());}).catch(e=>{if(e.name!=='AbortError')setFailed(prev=>({...prev,[revision]:e instanceof Error?e.message:'Hochrechnung konnte nicht geladen werden.'}));});
  return()=>c.abort();
 },[revision,loaded,failed]);
 // The figures follow the database: recalculated on request and when the page becomes visible again after a while.
 // No timer runs; nothing is started on the server.
 const reload=()=>{
  if(busy)return;setBusy(true);
  fetch('/api/admin/estimate',{cache:'no-store'}).then(async r=>{const d=await r.json() as Estimate&{error?:string};if(!r.ok)throw Error(d.error||'Hochrechnung konnte nicht geladen werden.');setLoaded(prev=>({...prev,[revision]:d}));setLoadedAt(Date.now());}).catch(e=>setFailed(prev=>({...prev,[revision]:e instanceof Error?e.message:'Hochrechnung konnte nicht geladen werden.'}))).finally(()=>setBusy(false));
 };
 useEffect(()=>{
  const onVisible=()=>{if(document.visibilityState==='visible'&&loadedAt&&Date.now()-loadedAt>120000)reload();};
  document.addEventListener('visibilitychange',onVisible);return()=>document.removeEventListener('visibilitychange',onVisible);
 });
 const download=()=>{
  if(!data)return;const {examples,excluded,...figures}=data;
  const url=URL.createObjectURL(new Blob([JSON.stringify({hinweis:'Hochrechnung des Berichts- und Dokumentenaufkommens; Werte pro Jahr, sofern nicht anders benannt. Tokens sind lokal gezählte Näherungen.',...figures,examples:examples.length,excluded:excluded.length},null,1)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`hochrechnung-${data.to}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 if(error)return <section className="admin-estimate"><p role="alert" className="admin-error">{error} <button type="button" className="admin-timeline-retry" onClick={()=>setFailed(prev=>{const next={...prev};delete next[revision];return next;})}>Erneut laden</button></p></section>;
 if(!data)return <section className="admin-estimate"><p role="status" className="admin-note">Hochrechnung wird berechnet …</p></section>;
 const d=data,v=d.volume,size=d.size,variant=(id:string)=>v?.variants.find(x=>x.id===id),municipal=d.levels.find(l=>l.id==='municipality')?.model,today=variant('primary'),once=variant('once');
 const sampleStates=[...new Set(d.examples.filter(e=>e.origin==='sample').map(e=>e.state))],stored=d.examples.filter(e=>e.origin==='stored').length;
 const measuredStates=d.states.filter(s=>Object.values(s.factors).some(Boolean));
 const partialStored=d.excluded.filter(e=>e.origin==='stored'&&e.reports>0);
 const docs=size?.documents,readable=docs?docs.read:0;
 // Shares of the yearly total by what they rest on. Counted: the reports of the examples themselves.
 const counted=d.examples.reduce((sum,e)=>sum+e.reports,0),countedShare=Math.min(1,counted/d.total.perYear),assumedShare=(d.basis.typical+d.basis.borrowed)/d.total.perYear,modelShare=Math.max(0,1-countedShare-assumedShare);
 const withExamples=d.states.filter(s=>s.samples>0).map(s=>s.name),without=d.states.filter(s=>!s.samples).map(s=>s.name),borrowed=d.levels.filter(l=>l.assumed).map(l=>l.name),units=Object.values(d.frame.units).reduce((a,b)=>a+b,0);
 return <section className="admin-estimate" id="admin-hochrechnung">
  <div className="admin-section-heading"><div><p className="eyebrow">HOCHRECHNUNG DEUTSCHLAND</p><h2>Wie viele Berichte und wie viel Text fallen bundesweit pro Tag an?</h2></div><span>{n(d.sampleCount)} Beispiele mit vollständigem Jahr · {day(d.from)} bis {day(d.to)}<br/>Stand der Datenbank: {new Date(d.asOf).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'})} · <button type="button" className="admin-timeline-retry" disabled={busy} onClick={reload}>{busy?'Wird neu berechnet …':'Neu berechnen'}</button></span></div>
  <div className="admin-kpis">
   <div className="admin-kpi admin-kpi-primary"><span>Neue Berichte pro Tag</span><strong>{round(d.total.perDay)}</strong><small>Spanne {round(d.total.lowPerDay)} bis {round(d.total.highPerDay)} · Durchschnitt über alle Kalendertage</small></div>
   <div className="admin-kpi"><span>Pro Arbeitstag · an einem starken Tag</span><strong>{round(d.total.perWorkday)} <em>· {round(d.season.peakDay)}</em></strong><small>{n(d.rules.workdaysPerYear)} Arbeitstage im Jahr · stärkster Wochentag einer starken Sitzungswoche</small></div>
   <div className="admin-kpi"><span>Davon heute lesbar</span><strong>{pct(d.capture.total.connectedShare)}</strong><small>rund {round(d.capture.total.connected/365)} Berichte pro Tag mit den vorhandenen Anbindungen</small></div>
   <div className="admin-kpi"><span>Pro Jahr</span><strong>{big(d.total.perYear)}</strong><small>Spanne {big(d.total.lowPerYear)} bis {big(d.total.highPerYear)}</small></div>
  </div>
  {v&&today&&once&&<div className="admin-kpis">
   <div className="admin-kpi admin-kpi-primary"><span>Tokens pro Tag, wie heute verarbeitet</span><strong>{big(today.perDay)}</strong><small>Spanne {big(today.lowPerDay)} bis {big(today.highPerDay)} · eine Unterlage je Bericht</small></div>
   <div className="admin-kpi"><span>Tokens pro Tag, alles gelesen</span><strong>{big(once.perDay)}</strong><small>Spanne {big(once.lowPerDay)} bis {big(once.highPerDay)} · jedes Dokument einmal</small></div>
   <div className="admin-kpi"><span>Dokumente und Seiten pro Tag</span><strong>{round(v.total.documentsOnce.perDay)} <em>· {round(v.total.pagesOnce.perDay)}</em></strong><small>verschiedene PDF-Dateien · Seiten darin</small></div>
   <div className="admin-kpi"><span>Datenmenge pro Tag · pro Jahr</span><strong>{bytes(v.total.bytesOnce.perDay)} <em>· {bytes(v.total.bytesOnce.perYear)}</em></strong><small>Abruf und Speicherung, wenn jedes Dokument einmal geladen wird</small></div>
  </div>}
  <h3 className="admin-estimate-subheading">Was davon ist echt, was gerechnet, was angenommen?</h3>
  <div className="admin-estimate-facts">
   <div className="is-counted"><Tag kind="counted"/><strong>{pct(countedShare,1)} der Jahresmenge</strong><p>{n(counted)} Berichte aus {n(d.sampleCount)} Gebieten wurden wirklich gezählt{size&&docs?<>, {n(docs.tried)} Dokumente aus {n(size.reports)} Berichten vermessen</>:null}. Echt sind außerdem die Einwohnerzahlen aller {n(units)} Einheiten und das Ergebnis der Quellensuche in der Stichprobe.</p></div>
   <div className="is-model"><Tag kind="model"/><strong>{pct(modelShare)} der Jahresmenge</strong><p>Mit dem Modell aus den Zählungen hochgerechnet – für Länder, die eigene Beispiele haben: {withExamples.join(', ')}. Gerechnet sind auch alle Spannen, die Tokens pro Tag und der starke Tag.</p></div>
   <div className="is-assumed"><Tag kind="assumed"/><strong>{pct(assumedShare)} der Jahresmenge</strong><p>Noch ohne ein einziges eigenes Beispiel: {without.join(', ')}{borrowed.length?<> sowie {borrowed.join(', ')}</>:null}. Dort steht ein Platzhalter – das typische Niveau der gemessenen Länder –, bis dort gezählt ist.</p></div>
  </div>
  <p className="admin-note">Die drei Marken stehen auch an jedem Schritt und in den Tabellen. Die Zahlen beschreiben das gesamte kommunale Aufkommen in Deutschland, als wären alle Gremien technisch erfassbar. <button type="button" className="admin-timeline-retry" onClick={download}>Zahlen für das Kostenmodell als JSON speichern</button></p>

  <h3 className="admin-estimate-step"><span>1</span> Was gezählt wird<span className="admin-estimate-tags"><Tag kind="counted">amtliche Zahlen</Tag></span></h3>
  <p>Ein <strong>Bericht</strong> ist ein öffentlicher Tagesordnungspunkt oder Vorgang eines kommunalen Gremiums. Er zählt einmal: an dem Tag, an dem er zum ersten Mal auf einer Tagesordnung stand. Betrachtet werden zwölf Monate ({day(d.from)} bis {day(d.to)}). Gezählt wird je <strong>Einheit</strong>, die ein eigenes Ratsinformationssystem führt:</p>
  <ul className="admin-estimate-assumptions">
   <li><strong>{n(d.frame.units.municipality)} Städte und Gemeinden</strong>, die keinem Gemeindeverband angehören (alle Größen, auch kreisfreie Städte).</li>
   <li><strong>{n(d.frame.units.association)} Gemeindeverbände</strong> (Verbandsgemeinden, Ämter, Samtgemeinden, Verwaltungsgemeinschaften) mit ihren {n(d.frame.memberMunicipalities)} Mitgliedsgemeinden. Verband und Mitglieder führen in der Regel ein gemeinsames System; ein Verband zählt deshalb als eine Einheit mit allen Räten seiner Gemeinden. In Baden-Württemberg behalten die Mitglieder eigene Verwaltungen und zählen einzeln.</li>
   <li><strong>{n(d.frame.units.district)} Kreise</strong> mit Kreistag und Ausschüssen.</li>
   <li><strong>{n(d.frame.units.borough)} Bezirke</strong> von Berlin und Hamburg mit ihren Bezirksversammlungen. Die Landesparlamente der Stadtstaaten gehören nicht dazu.</li>
  </ul>
  <p className="admin-note">Zusammen {n(d.frame.municipalities)} Gemeinden mit {n(d.frame.population/1e6,1)} Mio. Einwohnern. {d.frame.source}; Stand {d.frame.populationYear}.</p>

  <h3 className="admin-estimate-step"><span>2</span> Woher die Beispiele stammen<span className="admin-estimate-tags"><Tag kind="counted"/></span></h3>
  <p>Zwei Quellen liefern gezählte Jahre: der <strong>gespeicherte Bestand in NRW</strong> ({n(d.sample.storedWithData)} Gebiete mit Berichten, davon {n(stored)} mit vollständigem Jahr) und eine <strong>Zufallsstichprobe außerhalb von NRW</strong>. Für die Stichprobe wurden {n(d.sample.units)} Einheiten ausgelost, für jede die offizielle Website nach dem Ratsinformationssystem durchsucht und, wo es lesbar war, zwölf Monate abgerufen und gezählt – ohne etwas in die Datenbank zu schreiben. So entstanden {n(d.examples.length-stored)} weitere Beispiele aus {n(sampleStates.length)} Bundesländern ({sampleStates.map(s=>stateName(d.states,s)).join(', ')}); gezählt am {day(d.sample.to)}.</p>
  {partialStored.length>0&&<p role="status" className="admin-notice"><strong>{n(d.sample.storedWithData-stored)} NRW-Gebiete haben Berichte, aber kein vollständiges Jahr</strong> und zählen deshalb nicht als Beispiel – fast immer, weil sie mit einem kürzeren Zeitraum (1 Woche, 1 Monat, 3 Monate) abgerufen wurden. Die Seite rechnet bei jedem Laden neu: Sobald ein Gebiet mit „12 Monate“ abgerufen ist, wird es zum Beispiel. In den Diagrammen in Schritt 3 stehen diese Gebiete als hohle Punkte. <a className="admin-estimate-action" href={'/admin?auswahl='+partialStored.map(e=>e.id).join(',')}>Diese {n(partialStored.length)} Gebiete auf Seite 1 für einen 12-Monats-Abruf auswählen →</a></p>}
  <p className="admin-note">{d.sample.design} Ausgelost wurde nach einer festen Zufallsreihenfolge, damit auch Einheiten ohne lesbares System im Ergebnis stehen: Sie zeigen, wie viel des Aufkommens erfassbar ist (Schritt 6).</p>
  <div className="admin-estimate-table"><table>
   <thead><tr><th scope="col">Klasse</th><th scope="col">Stichprobe: ausgelost</th><th scope="col">davon lesbar</th><th scope="col">vollständiges Jahr</th><th scope="col">NRW: mit Berichten</th><th scope="col">vollständiges Jahr</th><th scope="col">Beispiele gesamt</th></tr></thead>
   <tbody>{d.sample.strata.map(s=><tr key={s.id}><th scope="row">{s.name}</th><td>{n(s.drawn)}</td><td>{n(s.connected)}</td><td>{n(s.sampleExamples)}</td><td>{n(s.storedWithData)}</td><td>{n(s.storedExamples)}</td><td>{n(s.sampleExamples+s.storedExamples)}</td></tr>)}</tbody>
   <tfoot><tr><th scope="row">Gesamt</th><td>{n(d.sample.units)}</td><td>{n(d.sample.connected)}</td><td>{n(d.examples.length-stored)}</td><td>{n(d.sample.storedWithData)}</td><td>{n(stored)}</td><td>{n(d.sampleCount)}</td></tr></tfoot>
  </table></div>
  <p>Ein Gebiet gilt nur als Beispiel, wenn sein Jahr vollständig ist:</p>
  <ul className="admin-estimate-assumptions">
   <li><strong>Gespeicherter Bestand:</strong> Berichte in mindestens {d.rules.minMonths} von 12 Monaten, Beginn spätestens {d.rules.startSlackDays} Tage nach Anfang, letzter Bericht höchstens {d.rules.endSlackDays} Tage vor Ende des Zeitraums, kein Hinweis auf einen begrenzten Abruf.</li>
   <li><strong>Stichprobe:</strong> Die ganze Jahresliste wurde in einem Lauf gelesen. Ein Abbruch wird nur angenommen, wenn am Anfang oder Ende eine Lücke bleibt, die länger ist als das {n(d.rules.gapFactor)}-Fache des üblichen Abstands zwischen zwei Sitzungstagen dieses Gebiets (mindestens {d.rules.startSlackDays} bzw. {d.rules.endSlackDays} Tage). Kleine Räte, die nur wenige Male im Jahr tagen, bleiben so in der Rechnung.</li>
   <li>Ausgeschlossen wird auch, wenn mehr als {pct(d.rules.maxUnreadableMeetings)} der Sitzungen keine lesbare Tagesordnung hatten.</li>
  </ul>
  <details><summary>Alle {n(d.examples.length)} Beispiele, {n(d.excluded.length)} nicht verwendete Gebiete und Vorschläge für weitere</summary>
   {d.sample.strata.map(s=>{const own=d.examples.filter(e=>e.class===s.id),out=d.excluded.filter(e=>e.class===s.id);return <div className="admin-estimate-class" key={s.id}><h4>{s.name}</h4>
    {own.length?<p><strong>Vollständiges Jahr:</strong> {own.sort((a,b)=>a.population-b.population).map(e=>`${short(e.name)} (${e.origin==='sample'?stateName(d.states,e.state)+', ':''}${n(e.population)} Einw., ${n(e.reports)} Berichte)`).join(' · ')}</p>:<p>Kein Beispiel mit vollständigem Jahr.</p>}
    {out.length>0&&<p><strong>Nicht verwendet:</strong> {out.slice(0,14).map(e=>`${short(e.name)} – ${e.reason}`).join(' · ')}{out.length>14&&` · und ${out.length-14} weitere`}</p>}
    {s.candidates.length>0&&<p><strong>In NRW als weitere Beispiele geeignet:</strong> {s.candidates.map(c=>short(c.name)).join(', ')}. <a className="admin-estimate-action" href={'/admin?auswahl='+s.candidates.map(c=>c.id).join(',')}>Diese {s.candidates.length} auf Seite 1 auswählen →</a></p>}
   </div>;})}
  </details>

  <h3 className="admin-estimate-step"><span>3</span> Das Rechenmodell je Ebene<span className="admin-estimate-tags"><Tag kind="model">gerechnet aus den gezählten Beispielen</Tag></span></h3>
  <p>Größere Einheiten haben mehr Berichte, aber nicht im gleichen Verhältnis: Ein Rat tagt in einer Stadt mit zehnmal so vielen Einwohnern nicht zehnmal so oft. Für jede Ebene wird deshalb aus den Beispielen eine Kurve bestimmt:</p>
  <p className="admin-estimate-formula">Berichte pro Jahr = Niveau des Bundeslands × Einwohner<sup>Steigung</sup></p>
  <ul className="admin-estimate-assumptions">
   <li><strong>Steigung:</strong> gemessen aus den Unterschieden zwischen Einheiten desselben Landes, begrenzt auf 0 bis 1. Steigung 0 heißt: Die Größe spielt keine Rolle, jede Einheit hat im Mittel gleich viele Berichte. Steigung 1 heißt: Berichte wachsen im Gleichschritt mit den Einwohnern.</li>
   <li><strong>Niveau des Bundeslands:</strong> wie weit die Beispiele eines Landes im Mittel über oder unter der gemeinsamen Kurve liegen. Ein Land mit wenigen Beispielen wird zum typischen Niveau hin gezogen; wie stark, ergibt sich aus der Streuung innerhalb der Länder im Vergleich zur Streuung zwischen ihnen.</li>
   <li><strong>Länder ohne Beispiel</strong> erhalten das typische Niveau. Es ist der Mittelwert der Länderniveaus, nicht der Mittelwert aller Beispiele – sonst würde NRW mit seinen vielen Beispielen den Wert für alle anderen bestimmen.</li>
   <li>Mit weniger als {d.rules.minForModel} Beispielen einer Ebene wird keine Steigung gemessen: Gemeinden rechnen dann mit Berichten je Einwohner, die anderen Ebenen mit Berichten je Einheit.</li>
  </ul>
  <div className="admin-estimate-table"><table>
   <thead><tr><th scope="col">Ebene</th><th scope="col">Beispiele</th><th scope="col">Steigung</th><th scope="col">Doppelte Einwohnerzahl</th><th scope="col">Typische Berichte pro Jahr</th><th scope="col">Streuung der Beispiele</th></tr></thead>
   <tbody>{d.levels.map(l=>{const m=l.model,[one]=UNIT[l.id];return <tr key={l.id}><th scope="row">{l.name}</th><td>{n(l.samples)}</td>
    {m?<><td>{n(m.slope,2)}<small>{m.measured?(m.slope===0||m.slope===1?'gemessen, an der Grenze':'gemessen'):'gesetzt, zu wenige Beispiele'}</small></td><td>{m.slope===0?'gleich viele Berichte':signed(2**m.slope-1)+' Berichte'}</td>
     <td className="admin-estimate-wrap">{l.id==='municipality'?<>{[1000,10000,100000,1000000].map(p=>`${n(p)} Einw.: ${round(at(m,p))}`).join(' · ')}</>:m.slope===0?`${round(at(m,1))} je ${one}`:[10000,100000].map(p=>`${n(p)} Einw.: ${round(at(m,p))}`).join(' · ')}</td>
     <td className="admin-estimate-wrap">{m.scatter?<>×/÷ {n(Math.exp(m.scatter),2)}<small>zwei Drittel der Beispiele liegen so nah an ihrer Kurve</small></>:'–'}</td></>
    :<td colSpan={4} className="admin-estimate-wrap"><Tag kind="assumed"/> Kein Beispiel: Es gilt die Kurve der Gemeinden bei der Größe der Einheit.</td>}
   </tr>;})}</tbody>
  </table></div>
  <div className="admin-estimate-charts">{d.levels.map(l=><Scatter key={l.id} level={l} examples={d.examples} provisional={d.provisional}/>)}</div>
  <p className="admin-note"><span className="admin-estimate-key is-stored"/> gezählt: gespeicherter Bestand NRW <span className="admin-estimate-key is-sample"/> gezählt: Stichprobe außerhalb von NRW <span className="admin-estimate-key is-open"/> Teilbestand, aufs Jahr hochgerechnet (nicht in der Rechnung) <span className="admin-estimate-key is-line"/> gerechnet: Modell für ein Land mit typischem Niveau. Beide Achsen sind logarithmisch: Jeder Teilstrich ist das Zehnfache des vorigen.</p>
  {measuredStates.length>0&&<div className="admin-estimate-table"><table>
   <thead><tr><th scope="col">Niveau je Bundesland</th>{d.levels.filter(l=>l.model).map(l=><th scope="col" key={l.id}>{l.name}</th>)}</tr></thead>
   <tbody>{measuredStates.map(s=><tr key={s.id}><th scope="row">{s.name}</th>{d.levels.filter(l=>l.model).map(l=>{const f=s.factors[l.id],raw=l.model?.states[s.id]?.raw;return <td key={l.id}>{f?<>{signed(f.factor-1)}<small>{n(f.examples)} {f.examples===1?'Beispiel':'Beispiele'}{raw&&Math.abs(raw-f.factor)>.02?` · ungedämpft ${signed(raw-1)}`:''}</small></>:(l.id==='municipality'?s.municipalities:l.id==='district'?s.districts:l.id==='association'?s.associations:s.boroughs)?<Tag kind="assumed">angenommen: typisches Niveau</Tag>:'–'}</td>;})}</tr>)}</tbody>
  </table></div>}
  <p className="admin-note">Lesebeispiel: +20 % heißt, dass eine Einheit dieses Landes bei gleicher Einwohnerzahl 20 % mehr Berichte hat als im typischen Land. „Ungedämpft“ ist der reine Mittelwert der Beispiele, bevor er zum typischen Niveau hin gezogen wird. Ein Strich bedeutet: Diese Ebene gibt es in dem Land nicht. Länder ohne jedes Beispiel fehlen in dieser Tabelle; für sie gilt überall das typische Niveau.</p>

  <h3 className="admin-estimate-step"><span>4</span> Summe über alle Einheiten Deutschlands<span className="admin-estimate-tags"><Tag kind="model"/><Tag kind="assumed">teils angenommen</Tag></span></h3>
  <p>Die Kurve wird nicht auf Durchschnitte angewendet, sondern auf jede einzelne der {n(Object.values(d.frame.units).reduce((a,b)=>a+b,0))} Einheiten mit ihrer Einwohnerzahl und dem Niveau ihres Landes. Die Ergebnisse werden addiert.</p>
  <div className="admin-estimate-table"><table>
   <thead><tr><th scope="col">Klasse</th><th scope="col">Einheiten in Deutschland</th><th scope="col">Beispiele</th><th scope="col">Berichte pro Jahr</th><th scope="col">pro Tag</th><th scope="col">je Einheit</th><th scope="col">Anteil</th></tr></thead>
   <tbody>{d.classes.map(c=><tr key={c.id}><th scope="row">{c.name}<small>{c.range}</small></th>
    <td>{n(c.germany.count)}<small>{n(c.germany.population/1e6,1)} Mio. Einwohner</small></td>
    <td>{n(c.samples)}<small><Tag kind={c.basis==='measured'?'model':'assumed'}>{BASIS[c.basis]}</Tag></small></td>
    <td>{round(c.perYear)}<small>{round(c.lowPerYear)} bis {round(c.highPerYear)}</small></td><td>{round(c.perYear/365)}</td><td>{c.germany.count?round(c.perYear/c.germany.count):'–'}</td><td>{pct(c.perYear/d.total.perYear)}</td></tr>)}</tbody>
   <tfoot><tr><th scope="row">Deutschland gesamt</th><td>{n(Object.values(d.frame.units).reduce((a,b)=>a+b,0))}</td><td>{n(d.sampleCount)}</td><td>{round(d.total.perYear)}<small>{round(d.total.lowPerYear)} bis {round(d.total.highPerYear)}</small></td><td>{round(d.total.perDay)}</td><td></td><td>100 %</td></tr></tfoot>
  </table></div>
  <h4 className="admin-estimate-subheading">Nach Bundesland</h4>
  <div className="admin-estimate-table"><table>
   <thead><tr><th scope="col">Bundesland</th><th scope="col">Einheiten</th><th scope="col">Einwohner</th><th scope="col">Beispiele</th><th scope="col">Berichte pro Jahr</th><th scope="col">pro Tag</th><th scope="col">je 1.000 Einwohner</th></tr></thead>
   <tbody>{d.states.map(s=><tr key={s.id}><th scope="row">{s.name}</th>
    <td>{n(s.municipalities+s.associations+s.districts+s.boroughs)}<small>{[s.municipalities&&n(s.municipalities)+' Gemeinden',s.associations&&n(s.associations)+' Verbände',s.districts&&n(s.districts)+' Kreise',s.boroughs&&n(s.boroughs)+' Bezirke'].filter(Boolean).join(' · ')}</small></td>
    <td>{n(s.population/1e6,1)} Mio.</td><td>{n(s.samples)}<small>{!s.samples?<Tag kind="assumed">angenommen: typisches Niveau</Tag>:s.ownShare>.995?<Tag kind="model">aus eigenen Beispielen gerechnet</Tag>:<Tag kind="assumed">{pct(1-s.ownShare)} angenommen</Tag>}</small></td>
    <td>{round(s.perYear)}<small>{round(s.lowPerYear)} bis {round(s.highPerYear)}</small></td><td>{round(s.perDay)}</td><td>{n(s.per1000,1)}</td></tr>)}</tbody>
   <tfoot><tr><th scope="row">Deutschland gesamt</th><td>{n(Object.values(d.frame.units).reduce((a,b)=>a+b,0))}</td><td>{n(d.frame.population/1e6,1)} Mio.</td><td>{n(d.sampleCount)}</td><td>{round(d.total.perYear)}<small>{round(d.total.lowPerYear)} bis {round(d.total.highPerYear)}</small></td><td>{round(d.total.perDay)}</td><td>{n(1000*d.total.perYear/d.frame.population,1)}</td></tr></tfoot>
  </table></div>
  <p className="admin-note">In der Spalte „Beispiele“ steht, worauf die Zahl eines Landes beruht. „Angenommen“ heißt: Für diesen Teil gibt es im Land kein eigenes Beispiel, es gilt das typische Niveau der gemessenen Länder. Länder mit vielen kleinen Gemeinden und Verbänden liegen je Einwohner deutlich höher: Jeder Gemeinderat tagt, auch wenn die Gemeinde nur wenige hundert Einwohner hat.</p>

  <h3 className="admin-estimate-step"><span>5</span> Wie sicher die Zahl ist<span className="admin-estimate-tags"><Tag kind="model"/></span></h3>
  <p><strong>Spanne:</strong> Die Rechnung wird {n(d.rules.replicates)}-mal wiederholt. Jedes Mal werden die Beispiele je Ebene und Land neu ausgelost (mit Zurücklegen), Steigung und Niveaus neu bestimmt und alles neu addiert. Ein Land ohne Beispiel erhält in jedem Durchgang das Niveau eines zufällig gewählten gemessenen Landes – so geht die Unsicherheit über unbekannte Länder in die Spanne ein. Angegeben ist der Bereich, in dem 8 von 10 Durchgängen liegen: <strong>{round(d.total.lowPerDay)} bis {round(d.total.highPerDay)} Berichte pro Tag</strong>.</p>
  {d.validation.n>0&&<><p><strong>Probe an bekannten Gebieten:</strong> Jedes der {n(d.validation.n)} Beispiele wurde einmal weggelassen und aus den übrigen vorhergesagt. Die Vorhersage lag im Mittel (Median) um <strong>{pct(d.validation.medianError)}</strong> neben dem gezählten Wert; bei {pct(d.validation.within50)} der Gebiete um höchstens die Hälfte. Über alle Gebiete summiert weicht sie um {signed(d.validation.bias||0)} ab. Für ein einzelnes Gebiet ist die Schätzung also grob, in der Summe gleichen sich die Abweichungen weitgehend aus.</p>
  {d.validation.states.length>0&&<><p><strong>Probe an ganzen Ländern:</strong> Jedes Land mit mindestens drei Beispielen einer Ebene wurde vollständig weggelassen und nur aus den anderen Ländern vorhergesagt. Das ist die Lage der Länder ohne eigenes Beispiel.</p>
  <div className="admin-estimate-table"><table>
   <thead><tr><th scope="col">Weggelassenes Land</th><th scope="col">Ebene</th><th scope="col">Beispiele</th><th scope="col">gezählt</th><th scope="col">vorhergesagt</th><th scope="col">Abweichung</th></tr></thead>
   <tbody>{d.validation.states.map(s=><tr key={s.level+s.state}><th scope="row">{s.name}</th><td>{d.levels.find(l=>l.id===s.level)?.name}</td><td>{n(s.examples)}</td><td>{n(s.actual)}</td><td>{round(s.predicted)}</td><td className={Math.abs(s.error)>.35?'admin-estimate-basis':undefined}>{signed(s.error)}</td></tr>)}</tbody>
  </table></div></>}</>}

  <h3 className="admin-estimate-step"><span>6</span> Wie viel davon heute lesbar ist<span className="admin-estimate-tags"><Tag kind="counted">Stichprobe gezählt</Tag><Tag kind="model">Anteil gerechnet</Tag></span></h3>
  <p>Die Hochrechnung beschreibt das gesamte Aufkommen. Erfassen lässt sich nur, was ein Ratsinformationssystem öffentlich und maschinenlesbar anbietet. Die Zufallsstichprobe zeigt, wie oft das der Fall ist; für NRW ist der Stand jeder einzelnen Anbindung bekannt. Die Anteile sind nach erwarteten Berichten gewichtet – eine Großstadt zählt mehr als ein Dorf.</p>
  <div className="admin-estimate-table"><table>
   <thead><tr><th scope="col">Klasse</th><th scope="col">Stichprobe</th><th scope="col">lesbar</th><th scope="col">System erkannt, nicht lesbar</th><th scope="col">kein System gefunden</th><th scope="col">NRW angebunden</th><th scope="col">Lesbare Berichte pro Tag</th><th scope="col">von</th></tr></thead>
   <tbody>{d.capture.classes.map(c=><tr key={c.id}><th scope="row">{c.name}</th><td>{n(c.units)}</td>
    <td>{c.units?<>{n(c.counts.connected)}<small>{pct(c.connected)} der Berichte</small></>:'–'}</td><td>{c.units?<>{n(c.counts.unreadable)}<small>{pct(c.unreadable)} der Berichte</small></>:'–'}</td><td>{c.units?n(c.counts.unknown):'–'}</td>
    <td>{c.known.areas?`${n(c.known.connected)} von ${n(c.known.areas)}`:'–'}</td><td>{round(c.perYear.connected/365)}</td><td>{round(c.perYear.total/365)}</td></tr>)}</tbody>
   <tfoot><tr><th scope="row">Deutschland gesamt</th><td>{n(d.sample.units)}</td><td>{n(d.sample.connected)}</td><td></td><td></td><td></td><td>{round(d.capture.total.connected/365)}</td><td>{round(d.capture.total.total/365)}</td></tr></tfoot>
  </table></div>
  <p className="admin-note">Lesbar: {pct(d.capture.total.connectedShare)} des Aufkommens. System erkannt, aber mit den vorhandenen Bausteinen nicht lesbar (zum Beispiel ALLRIS ohne offene Schnittstelle oder ein Abrufschutz): {pct(d.capture.total.unreadable/d.capture.total.total)}. Nicht angebundene Gebiete in NRW: {pct(d.capture.total.knownOpen/d.capture.total.total)}. Kein System gefunden: {pct(d.capture.total.unknown/d.capture.total.total)} – das ist eine Obergrenze, denn die Suche findet nicht jedes System, vor allem bei kleinen Gemeinden ohne bekannte Website.</p>

  {v&&size&&docs&&<>
  <h3 className="admin-estimate-step"><span>7</span> Umfang der Dokumente<span className="admin-estimate-tags"><Tag kind="counted">gemessen</Tag></span></h3>
  <p>Für die KI-Kosten zählt, wie viel Text zu lesen ist. Aus jedem der {n(size.areas)} Gebiete mit gezähltem Bestand wurden bis zu {n(size.perArea)} Berichte mit Dokumenten ausgewählt (feste Zufallsreihenfolge) und ihre {n(docs.tried)} PDF-Verweise einmal abgerufen und vermessen: Dateigröße, Seiten, Zeichen, Tokens, Textebene. Gespeichert wurden nur diese Messwerte, kein Text. Messung vom {day(size.measuredAt)}.</p>
  <div className="admin-kpis">
   <div className="admin-kpi"><span>Berichte mit Dokument</span><strong>{pct(d.documents.share)}</strong><small>der Berichte verweisen auf mindestens ein PDF; die übrigen bestehen nur aus Titel und Beratungsverlauf</small></div>
   <div className="admin-kpi"><span>Dokumente je Bericht</span><strong>{n(v.total.documentsOnce.perYear/v.withDocumentsPerYear,1)} <em>/ {n(d.documents.linksPerReport,1)}</em></strong><small>eigene Dokumente / alle Verweise – Einladungen und Niederschriften hängen an vielen Berichten zugleich</small></div>
   <div className="admin-kpi"><span>Seiten je Bericht</span><strong>{n(v.perReport.pages.median)} <em>· {n(v.perReport.pages.mean,1)}</em></strong><small>Median · Mittelwert; 90 % der Berichte haben höchstens {n(v.perReport.pages.p90)} Seiten</small></div>
   <div className="admin-kpi"><span>Tokens je Bericht, alles gelesen</span><strong>{round(v.perReport.tokens.median)} <em>· {round(v.perReport.tokens.mean)}</em></strong><small>Median · Mittelwert; die umfangreichsten 10 % der Berichte tragen {pct(v.perReport.tokens.top10Share)} des Textes</small></div>
  </div>
  <p className="admin-note">Der Mittelwert liegt weit über dem Median, weil wenige Berichte sehr umfangreiche Unterlagen haben (Haushaltspläne, Bebauungspläne, Gutachten). Für Kosten zählt der Mittelwert, für die typische Verarbeitungszeit der Median.</p>
  <div className="admin-estimate-table"><table>
   <thead><tr><th scope="col">Je Dokument</th><th scope="col">Median</th><th scope="col">Mittelwert</th><th scope="col">90 % höchstens</th><th scope="col">Größtes</th></tr></thead>
   <tbody>
    <tr><th scope="row">Seiten</th><td>{n(docs.perDocument.pages?.median)}</td><td>{n(docs.perDocument.pages?.mean,1)}</td><td>{n(docs.perDocument.pages?.p90)}</td><td>{n(docs.perDocument.pages?.max)}</td></tr>
    <tr><th scope="row">Tokens</th><td>{round(docs.perDocument.tokens?.median)}</td><td>{round(docs.perDocument.tokens?.mean)}</td><td>{round(docs.perDocument.tokens?.p90)}</td><td>{round(docs.perDocument.tokens?.max)}</td></tr>
    <tr><th scope="row">Dateigröße</th><td>{bytes(docs.perDocument.bytes?.median||0)}</td><td>{bytes(docs.perDocument.bytes?.mean||0)}</td><td>{bytes(docs.perDocument.bytes?.p90||0)}</td><td>{bytes(docs.perDocument.bytes?.max||0)}</td></tr>
   </tbody>
  </table></div>
  <h4 className="admin-estimate-subheading">Wenige lange Dokumente tragen den größten Teil des Textes</h4>
  <p className="admin-estimate-explain">Lesebeispiel: {pct(docs.bins[0].documents/readable)} der Dokumente haben höchstens fünf Seiten, enthalten aber nur {pct(docs.bins[0].tokens/docs.tokens)} des Textes. Die Balken zeigen denselben Anteil wie die Zahl links daneben.</p>
  <div className="admin-estimate-table"><table>
   <thead><tr><th scope="col">Länge</th><th scope="col">Anteil der Dokumente</th><th scope="col"></th><th scope="col">Anteil des Textes</th><th scope="col"></th><th scope="col">Anteil der Datenmenge</th></tr></thead>
   <tbody>{docs.bins.map(b=><tr key={b.id}><th scope="row">{b.label}</th><td>{pct(b.documents/readable)}</td><td><Share value={b.documents/readable}/></td><td>{pct(b.tokens/docs.tokens)}</td><td><Share value={b.tokens/docs.tokens}/></td><td>{pct(b.bytes/docs.bytes)}</td></tr>)}</tbody>
  </table></div>
  <h4 className="admin-estimate-subheading">Nach Art des Dokuments</h4>
  <p className="admin-estimate-explain">Die Art ist aus dem Titel des Dokuments erkannt. Der Balken zeigt, welchen Anteil am gesamten Text diese Art hat.</p>
  <div className="admin-estimate-table"><table>
   <thead><tr><th scope="col">Art (aus dem Titel erkannt)</th><th scope="col">Anteil der Dokumente</th><th scope="col">Seiten je Dokument</th><th scope="col">Tokens je Dokument</th><th scope="col">Anteil des Textes</th><th scope="col"></th></tr></thead>
   <tbody>{Object.entries(docs.types).sort((a,b)=>b[1].tokens-a[1].tokens).map(([id,t])=><tr key={id}><th scope="row">{TYPES[id]||id}</th><td>{pct(t.documents/readable)}</td><td>{n(t.pages/t.documents,1)}</td><td>{round(t.tokens/t.documents)}</td><td>{pct(t.tokens/docs.tokens)}</td><td><Share value={t.tokens/docs.tokens}/></td></tr>)}</tbody>
  </table></div>
  <ul className="admin-estimate-assumptions">
   <li><strong>Ohne Textebene:</strong> {pct(docs.scanPages/docs.pages)} der Seiten sind Scans oder Zeichnungen ohne lesbaren Text; {pct(docs.scans/readable)} der Dokumente bestehen überwiegend daraus. Ihr Inhalt wäre nur über Texterkennung oder als Bild lesbar und ist in den Tokens nicht enthalten.</li>
   <li><strong>Größer als {n(d.rules.maxBytes/1e6)} MB:</strong> {pct(docs.large/(readable+docs.large+docs.notPdf),1)} der Dokumente. Die Verarbeitung überspringt sie; ihre Größe stammt aus der Serverangabe und zählt bei der Datenmenge mit, nicht bei Seiten und Tokens.</li>
   <li><strong>Kein PDF</strong> trotz PDF-Verweis (Fehlerseite, anderes Format): {pct(docs.notPdf/(readable+docs.large+docs.notPdf),1)}. <strong>Nicht abrufbar</strong> beim Messen: {pct(docs.failed/docs.tried,1)} der Verweise; für sie wird der Durchschnitt der übrigen Dokumente desselben Berichts angesetzt.</li>
   <li><strong>Tokens:</strong> lokal gezählt mit dem Tokenizer {size.tokenizer?<code>{size.tokenizer}</code>:'(nicht verfügbar; Zeichen geteilt durch 2,8)'} – ohne Aufruf einer KI-Schnittstelle. Im Mittel {n(size.charsPerToken,2)} Zeichen je Token{size.charsPerTokenOther?<>; zum Vergleich der Tokenizer o200k: {n(size.charsPerTokenOther,2)} Zeichen je Token, also {signed(size.charsPerToken/size.charsPerTokenOther-1)} Tokens</>:null}. Aktuelle Modelle zählen anders als dieser Tokenizer; für die Kosten sollte ein Zuschlag oder Abschlag als eigener Faktor geführt werden.</li>
  </ul>

  <h3 className="admin-estimate-step"><span>8</span> Text und Datenmenge pro Tag<span className="admin-estimate-tags"><Tag kind="model"/></span></h3>
  <p>Rechnung je Klasse: Berichte pro Jahr × Anteil mit Dokument × gemessener Mittelwert je Bericht. Der Mittelwert einer Klasse ist der Mittelwert ihrer Gebiete, gewichtet mit deren Zahl an Berichten mit Dokument; eine Klasse mit weniger als drei gemessenen Gebieten nutzt den Wert über alle Gebiete. Die Spanne entsteht wie in Schritt 5, zusätzlich werden die gemessenen Gebiete neu ausgelost.</p>
  <div className="admin-estimate-table"><table>
   <thead><tr><th scope="col">Was gelesen wird</th><th scope="col">Tokens je Bericht mit Dokument</th><th scope="col">Tokens pro Tag</th><th scope="col">Spanne</th><th scope="col">Tokens pro Jahr</th></tr></thead>
   <tbody>{v.variants.map(x=><tr key={x.id}><th scope="row">{x.name}<small>{x.detail}</small></th><td>{round(x.perReport)}</td><td>{big(x.perDay)}</td><td>{big(x.lowPerDay)} bis {big(x.highPerDay)}</td><td>{big(x.perYear)}</td></tr>)}</tbody>
  </table></div>
  <p className="admin-note">Hinzu kommt je Bericht der Text der Tagesordnung selbst (Titel, Beratungsfolge, Beschlusstext der Seite) – wenige hundert Tokens – sowie die Antwort des Modells. „Wie heute“ entspricht der jetzigen Verarbeitung: höchstens {n(d.rules.primaryChars)} Zeichen aus einer Unterlage mit höchstens {n(d.rules.primaryPages)} Seiten.</p>
  <div className="admin-estimate-table"><table>
   <thead><tr><th scope="col">Klasse, pro Tag</th><th scope="col">Berichte mit Dokument</th><th scope="col">Dokumente</th><th scope="col">Seiten</th><th scope="col">Datenmenge</th><th scope="col">Tokens: wie heute</th><th scope="col">Tokens: alles einmal</th><th scope="col">Gemessen</th></tr></thead>
   <tbody>{v.classes.map(c=><tr key={c.id}><th scope="row">{c.name}<small>{pct(c.documentShare)} mit Dokument</small></th><td>{round(c.withDocumentsPerYear/365)}</td><td>{round(c.perYear.documentsOnce/365)}</td><td>{round(c.perYear.pagesOnce/365)}</td><td>{bytes(c.perYear.bytesOnce/365)}</td><td>{big(c.perYear.tokensPrimary/365)}</td><td>{big(c.perYear.tokensOnce/365)}</td>
    <td>{n(c.sampled)} Berichte<small>{c.pooled?<Tag kind="assumed">{n(c.areas)} {c.areas===1?'Gebiet':'Gebiete'}: Wert aller Gebiete</Tag>:`aus ${n(c.areas)} Gebieten gemessen`}</small></td></tr>)}</tbody>
   <tfoot><tr><th scope="row">Deutschland gesamt</th><td>{round(v.withDocumentsPerYear/365)}</td><td>{round(v.total.documentsOnce.perDay)}</td><td>{round(v.total.pagesOnce.perDay)}</td><td>{bytes(v.total.bytesOnce.perDay)}</td><td>{big(v.total.tokensPrimary.perDay)}</td><td>{big(v.total.tokensOnce.perDay)}</td><td>{n(v.sample.reports)} Berichte</td></tr></tfoot>
  </table></div>
  <div className="admin-estimate-table"><table>
   <thead><tr><th scope="col">Bundesland, pro Tag</th><th scope="col">Berichte mit Dokument</th><th scope="col">Dokumente</th><th scope="col">Seiten</th><th scope="col">Datenmenge</th><th scope="col">Tokens: wie heute</th><th scope="col">Tokens: alles einmal</th></tr></thead>
   <tbody>{v.states.map(s=><tr key={s.id}><th scope="row">{s.name}</th><td>{round(s.withDocumentsPerYear/365)}</td><td>{round(s.perYear.documentsOnce/365)}</td><td>{round(s.perYear.pagesOnce/365)}</td><td>{bytes(s.perYear.bytesOnce/365)}</td><td>{big(s.perYear.tokensPrimary/365)}</td><td>{big(s.perYear.tokensOnce/365)}</td></tr>)}</tbody>
  </table></div>
  <p className="admin-note"><strong>Speicher und Datenverkehr im Jahr:</strong> rund {bytes(v.total.bytesOnce.perYear)} (Spanne {bytes(v.total.bytesOnce.lowPerYear)} bis {bytes(v.total.bytesOnce.highPerYear)}), wenn jedes Dokument einmal geladen und aufbewahrt wird; {big(v.total.documentsOnce.perYear)} Dokumente mit {big(v.total.pagesOnce.perYear)} Seiten, davon {big(v.total.scanPagesOnce.perYear)} Seiten ohne Textebene.</p>
  </>}
  {!v&&<p role="status" className="admin-notice">Der Umfang der Dokumente ist noch nicht gemessen. <code>scripts/estimate/measure-size.mjs</code> und danach <code>scripts/estimate/build-samples.mjs</code> liefern die Zahlen für die Schritte 7 und 8.</p>}

  <h3 className="admin-estimate-step"><span>9</span> Verteilung über das Jahr und Wiedervorlagen<span className="admin-estimate-tags"><Tag kind="counted">Verteilung gezählt</Tag><Tag kind="model">starker Tag gerechnet</Tag></span></h3>
  <p>Der Tageswert ist ein Jahresdurchschnitt. Sitzungen finden fast nur von Montag bis Donnerstag statt, häufen sich vor den Ferien und ruhen im Sommer und um den Jahreswechsel. Die Verteilung stammt aus allen Beispielen zusammen.</p>
  <figure className="admin-estimate-figure"><figcaption>Neue Berichte je Woche, alle Beispiele zusammen <Tag kind="counted"/></figcaption><Bars values={d.season.weeks} reference={1} xTitle={`Wochen von ${day(d.from)} bis ${day(d.to)} (beschriftet ist jeweils der Monatsanfang)`} yTitle="Vielfaches der Durchschnittswoche" unit="Berichte je Woche im Verhältnis zur Durchschnittswoche; die Werte stehen an den Balken und in den Tabellen darunter" labels={i=>`Woche ab ${weekStart(d.from,i).toLocaleDateString('de-DE',{timeZone:'UTC'})}: ${n(d.season.weeks[i],2)}-faches der Durchschnittswoche`} ticks={i=>i===0||weekStart(d.from,i).getUTCMonth()!==weekStart(d.from,i-1).getUTCMonth()?MONTHS[weekStart(d.from,i).getUTCMonth()]:null}/><p className="admin-estimate-explain">Jeder Balken ist eine Woche. Höhe 1 ist eine durchschnittliche Woche (gestrichelte Linie), Höhe 2 doppelt so viele Berichte. Die Lücken sind die Herbstferien, der Jahreswechsel, Ostern und die Sommerferien.</p></figure>
  <div className="admin-estimate-table"><table>
   <thead><tr><th scope="col">Anteil der Berichte</th>{WEEKDAYS.map(w=><th scope="col" key={w}>{w}</th>)}</tr></thead>
   <tbody><tr><th scope="row">nach Wochentag</th>{d.season.weekdays.map((s,i)=><td key={i}>{pct(s)}</td>)}</tr></tbody>
  </table></div>
  <div className="admin-estimate-table"><table>
   <thead><tr><th scope="col">Anteil der Berichte</th>{MONTHS.map(m=><th scope="col" key={m}>{m}</th>)}</tr></thead>
   <tbody><tr><th scope="row">nach Monat</th>{d.season.monthly.map((s,i)=><td key={i}>{pct(s)}</td>)}</tr></tbody>
  </table></div>
  <ul className="admin-estimate-assumptions">
   <li><strong>Starker Tag:</strong> rund {round(d.season.peakDay)} neue Berichte. Gerechnet als starke Woche (nur jede zwanzigste ist stärker; das {n(d.season.strongWeek,2)}-Fache der Durchschnittswoche) mal Anteil des stärksten Wochentags ({pct(d.season.peakWeekday)}). {n(d.season.quietWeeks)} Wochen des Jahres bleiben unter einem Viertel der Durchschnittswoche.</li>
   <li><strong>Bundesweit glättet sich die Kurve etwas:</strong> Die Ferien der Länder liegen versetzt, die Beispiele stammen aber überwiegend aus wenigen Ländern. Der starke Tag ist deshalb eher zu hoch als zu niedrig angesetzt.</li>
   <li><strong>Wiedervorlagen:</strong> {pct(d.season.followUpShare)} der Berichte stehen innerhalb des Jahres an mehr als einem Sitzungstag auf einer Tagesordnung; im Mittel sind es {n(d.season.consultationsPerReport,2)} Sitzungstage je Bericht. Wird ein Bericht bei jeder weiteren Beratung neu verarbeitet, kommen rund {round(d.season.followUpsPerYear/365)} Verarbeitungen pro Tag hinzu ({round(d.season.followUpsPerYear)} pro Jahr).</li>
   <li><strong>Zeitpunkt:</strong> Gezählt wird am Sitzungstag. Einladung und Unterlagen erscheinen meist ein bis zwei Wochen vorher, Niederschrift und Beschlusstext einige Wochen danach; die Verarbeitung verteilt sich entsprechend.</li>
  </ul>

  <h3 className="admin-estimate-step"><span>10</span> Annahmen und Grenzen<span className="admin-estimate-tags"><Tag kind="assumed"/></span></h3>
  <ul className="admin-estimate-assumptions">
   <li>Beispiele gibt es nur für Einheiten mit lesbarem System. Die Rechnung nimmt an, dass Gremien ohne lesbares System ähnlich viele Berichte haben. Kleine Gemeinden ohne Online-Angebot tagen vermutlich eher seltener; die Gesamtzahl ist dort eher zu hoch.</li>
   <li>Die Stichprobe deckt {n(sampleStates.length)} Länder ab. Für die übrigen gilt das typische Niveau; ihre Gremienstruktur kann abweichen. Die Probe an ganzen Ländern in Schritt 5 zeigt, wie groß dieser Fehler bei den gemessenen Ländern wäre.</li>
   <li>Gemeindeverbände: Gezählt wird, was im System des Verbands steht. Führen einzelne Mitgliedsgemeinden ein eigenes System, fehlen ihre Berichte in der Zählung des Verbands. Die Zahl der Verbände ist deshalb eher zu niedrig angesetzt.</li>
   <li>Bezirke von Berlin und Hamburg: {d.levels.find(l=>l.id==='borough')?.model?'eigene Beispiele vorhanden.':'kein Bezirk war lesbar (ALLRIS ohne offene Schnittstelle bzw. Abrufschutz); ihre Berichte sind mit der Kurve der Gemeinden angenommen.'}</li>
   <li>Nicht enthalten: Landtage, Zweckverbände, Regionalverbände, Ortsbeiräte ohne eigenes System und alles Nichtöffentliche.</li>
   {municipal&&<li>Kleinstgemeinden außerhalb von Verbänden liegen am Rand des gemessenen Bereichs: Die Kurve wird dort über die kleinsten Beispiele hinaus verlängert.</li>}
   <li>Stand der Zählung: Bestand NRW vom {new Date(d.asOf).toLocaleDateString('de-DE')}, Stichprobe vom {day(d.sample.builtAt)}. Die NRW-Beispiele ändern sich mit jedem Abruf; die Stichprobe und die Dokumentenmessung werden mit den Skripten unter <code>scripts/estimate/</code> erneuert.</li>
  </ul>
  <p className="admin-note">Erkannte Systeme der lesbaren Stichprobe: {Object.entries(d.examples.filter(e=>e.origin==='sample'&&e.method).reduce<Record<string,number>>((sum,e)=>({...sum,[SYSTEMS[e.method!]||e.method!]:(sum[SYSTEMS[e.method!]||e.method!]||0)+1}),{})).map(([name,count])=>`${name} ${n(count)}`).join(' · ')}.</p>
 </section>;
}
