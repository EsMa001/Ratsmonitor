'use client';
import {useId,useState} from 'react';
import {REGIONS} from '@/shared/regions';
import {mapSelection} from '@/shared/map-selection.mjs';
import {MAP_VIEWS,mapReading,mapLegend,mapPercent} from '@/shared/map-metrics.mjs';
import {ToggleGroup,ToggleGroupItem} from '@/components/ui/toggle-group';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Switch} from '@/components/ui/switch';
import {Button} from '@/components/ui/button';
import {RegionSelect,type RegionAvailability} from '@/components/region-select';
import map from '@/public/geo/germany.json';
const day=(value:string)=>value.split('-').reverse().join('.');
const span=(p:{from:string;to:string})=>day(p.from)+' – '+day(p.to);
const n=(value:number)=>value.toLocaleString('de-DE');
export function GermanyHeatmap({places,region,topicMode,availability,comparisonPeriods,subject,from,to}:{places:any[];region:string;topicMode:boolean;availability:RegionAvailability;comparisonPeriods:any;subject:string;from:string;to:string}){
 const [zoom,setZoom]=useState('region'),[requested,setSelected]=useState(region),[layer,setLayer]=useState(places.find(p=>p.id===region)?.kind||places[0]?.kind||'city');
 const [mode,setMode]=useState('share'),[completeOnly,setCompleteOnly]=useState(false);
 const prefix='map-'+useId().replaceAll(':','');
 const available=new Set(places.map(p=>p.kind));
 const {activeLayer,visible,current,selectedId:selected}=mapSelection(places,region,requested,layer);
 const byId=new Map(places.map(p=>[p.id,p]));
 const visibleIds=new Set(visible.map((p:any)=>p.id));
 const view=MAP_VIEWS.find(v=>v.id===mode)!;
 const read=(p:any)=>mapReading(p,mode,{completeOnly});
 const currentReading=read(current);
 const legend=mapLegend(mode,completeOnly?visible.filter((p:any)=>!p.partial):visible);
 const colored=visible.filter((p:any)=>['value','tie'].includes(read(p).kind));
 const basis=topicMode?'Ähnlich zu: '+subject:subject;
 const choose=(id:string)=>{setSelected(id);const place=byId.get(id);if(place)setLayer(place.kind);};
 const dataRows=visible.filter((p:any)=>p.total>0||p.id===selected);
 const openMatches=()=>{const element=document.getElementById('place-'+selected);if(element instanceof HTMLDetailsElement)element.open=true;};
 return <div className="map-workspace">
  <div className="map-view-controls">
   <div className="analysis-field"><label id={prefix+'-mode-label'}>Einfärbung der Karte</label><Select value={mode} onValueChange={setMode}><SelectTrigger aria-labelledby={prefix+'-mode-label'}><SelectValue/></SelectTrigger><SelectContent position="popper" className="analysis-options">{MAP_VIEWS.map(v=><SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select></div>
   <div className="map-scope"><span>{view.scope==='subject'?'Gewähltes Thema':'Gesamter Bestand im Zeitraum'}</span><strong>{view.scope==='subject'?basis:'Alle Themen und Einordnungen'}</strong><small>{day(from)} – {day(to)}</small></div>
  </div>
  <div className="map-question" aria-live="polite"><h3>{view.question}</h3><p>{view.description}</p>{mode==='count'&&<p className="page-note">Mehr Vorgänge können auch durch Größe, Zuständigkeit oder bessere Erfassung eines Gebiets entstehen. Die Flächengröße codiert keinen Wert.</p>}{mode==='unlabelled'&&<p className="page-note">Diese Ansicht zeigt die regelbasierte Einordnung. Sie misst weder KI-Genauigkeit noch die Vollständigkeit der Quelle.</p>}</div>
  {mode==='change'&&<div className="map-periods">{comparisonPeriods?<><div><span>Erster Abschnitt</span><strong>{span(comparisonPeriods.first)}</strong></div><span className="map-period-arrow" aria-hidden="true">→</span><div><span>Zweiter Abschnitt</span><strong>{span(comparisonPeriods.second)}</strong></div><p>Je {comparisonPeriods.days} Kalendertage. Mindestens 10 Vorgänge pro Abschnitt.{comparisonPeriods.omittedDay&&<> Der mittlere Tag ({day(comparisonPeriods.omittedDay)}) bleibt für diesen Vergleich unberücksichtigt.</>} Ein Vorgang kann in beiden Abschnitten jeweils einmal vorkommen.</p></>:<p>Bitte einen Zeitraum mit mindestens zwei Kalendertagen auswählen.</p>}</div>}
  <div className="map-tools"><ToggleGroup type="single" value={zoom} onValueChange={v=>v&&setZoom(v)} aria-label="Kartenausschnitt"><ToggleGroupItem value="germany">Deutschland</ToggleGroupItem><ToggleGroupItem value="region">NRW</ToggleGroupItem></ToggleGroup>{available.size>1&&<ToggleGroup type="single" value={activeLayer} onValueChange={v=>v&&setLayer(v)} aria-label="Verwaltungsebene"><ToggleGroupItem value="city">Städte & Gemeinden</ToggleGroupItem><ToggleGroupItem value="district">Kreise</ToggleGroupItem></ToggleGroup>}
   {mode!=='coverage'&&<div className="map-completeness"><Switch id={prefix+'-complete'} checked={completeOnly} onCheckedChange={setCompleteOnly}/><label htmlFor={prefix+'-complete'}>Teilstände ausblenden</label></div>}
  </div>
  <p id={prefix+'-help'} className="page-note">{colored.length} von {visible.length} {activeLayer==='city'?'Kommunen':'Kreisen'} in dieser Ansicht eingefärbt. Gebiet in der Karte, über die Suche oder in der Wertetabelle auswählen.</p>
  {!colored.length&&<p className="analysis-notice" role="status">Für diese Ansicht sind keine Gebiete auswertbar.{completeOnly&&mode!=='coverage'?' Blende Teilstände wieder ein oder wähle einen anderen Zeitraum.':mode==='change'?' Für die Veränderung werden mindestens 10 Vorgänge in jedem Abschnitt benötigt.':' Prüfe den Zeitraum und die Datenabdeckung.'}</p>}
  <div className="map-layout">
   <div className="map-canvas"><svg className={'germany-map '+(zoom==='region'?'is-zoomed':'')} viewBox={zoom==='region'?map.regionViewBox:map.viewBox} aria-label={view.name+'. '+(activeLayer==='city'?'Städte und Gemeinden':'Kreise')+' in NRW. Alle Werte sind auch in der Tabelle verfügbar.'} role="img" aria-describedby={prefix+'-help'}>
    <defs><pattern id={prefix+'-missing'} patternUnits="userSpaceOnUse" width="5" height="5"><rect width="5" height="5" fill="#f4f4f4"/><path d="M0 5L5 0" stroke="#999" strokeWidth=".5"/></pattern></defs>
    {map.states.map(s=><path key={s.id} d={s.path} fill="#eee" stroke="#fff" strokeWidth=".65" vectorEffect="non-scaling-stroke"><title>{s.name+' · außerhalb der dargestellten NRW-Gebiete ohne Auswertung'}</title></path>)}
    {map.regions.filter(r=>r.kind===activeLayer&&byId.has(r.id)).sort((a,b)=>Number(a.id===selected)-Number(b.id===selected)).map(r=>{const p=byId.get(r.id),value=read(p),valid=['value','tie','pending'].includes(value.kind);return <path className="map-region" key={r.id} d={r.path} fill={valid?value.color:`url(#${prefix}-missing)`} stroke={selected===r.id?'#101010':'#73818e'} strokeWidth={selected===r.id?2.4:.65} strokeDasharray={p.partial&&p.total>0&&selected!==r.id?'2 1.2':undefined} vectorEffect="non-scaling-stroke" data-selected={selected===r.id?'true':undefined} onClick={()=>choose(r.id)}><title>{p.name+': '+value.text+'. '+value.detail+(p.partial&&p.total?' Quellenbestand teilweise.':'')}</title></path>})}
   </svg><p className="map-canvas-note">Gestrichelte Grenze: Teilstand · Dunkle Umrandung: ausgewähltes Gebiet</p></div>
   <div className="map-inspector">
    {visible.length>0&&<RegionSelect availability={availability} value={selected} onChange={choose} options={REGIONS.filter(r=>visibleIds.has(r.id))} label="Gebiet in der Kartenebene auswählen" name="map-region"/>}
    <div aria-live="polite" aria-atomic="true"><h3>{current?.name||'Keine Gebiete für diese Auswahl'}</h3><p className={'map-value'+(['dominant','coverage'].includes(mode)||!['value','tie'].includes(currentReading.kind)?' map-value-text':'')}>{currentReading.text}</p><p>{currentReading.detail}</p>
     {current&&<><p className="page-note">{current.kind==='city'?'Stadt / Gemeinde':'Kreis'}{current.id===region?' · Ausgangsgebiet':''}{current.partial&&current.total?' · unvollständiger Quellenbestand':''}</p>{mode==='change'&&current.comparison.first&&<dl className="map-comparison-values"><div><dt>Erster Abschnitt</dt><dd>{current.comparison.first.count} / {current.comparison.first.total} · {mapPercent(current.comparison.first.share)}</dd></div><div><dt>Zweiter Abschnitt</dt><dd>{current.comparison.second.count} / {current.comparison.second.total} · {mapPercent(current.comparison.second.share)}</dd></div></dl>}
     <div className="map-inspector-links">{view.scope==='subject'&&current.count>0&&current.id!==region&&<a href={'#place-'+current.id} onClick={openMatches}>Passende Vorgänge ansehen</a>}<a href={'/quellen?region='+selected}>Quellenstand ansehen</a></div></>}
    </div>
   </div>
  </div>
  <div className="map-key" aria-label={'Legende: '+view.name}><strong>{view.name}</strong><div>{legend.map(item=><span key={item.label}><i style={{background:item.color}} aria-hidden="true"/>{item.label}</span>)}</div><div className="map-key-missing"><span><i className="no-data-swatch" aria-hidden="true"/>Keine auswertbaren Daten{['change','dominant'].includes(mode)?' / zu kleine Datenbasis':''}{mode==='dominant'?' / kein Sachgebiet':''}{completeOnly&&mode!=='coverage'?' / Teilstand ausgeblendet':''}</span><span><i style={{background:'#e7e7e7'}} aria-hidden="true"/>Noch nicht angebunden</span></div></div>
  <p className="page-note">{mode==='dominant'?'Mindestens 10 Vorgänge je Gebiet. Der Anteil des führenden Sachgebiets bezieht sich auf alle erfassten Vorgänge, einschließlich allgemeiner, formaler und offener Einordnungen. ':''}{mode==='change'?'Zunahme und Abnahme beziehen sich auf erfasste Anteile. Quellenlücken, Sitzungsturnus und kleine Fallzahlen können Veränderungen erklären. ':''}Null Treffer bei vorhandenem Bestand bleibt ein eigener Wert. Fehlende Daten bedeuten keine Nullaktivität. Farben allein reichen zur Bewertung nicht aus: prüfe Fallzahl und Quellenstand.</p>
  <details className="map-data-table"><summary>Wertetabelle: {view.name} <span>{dataRows.filter((p:any)=>p.total>0).length} Gebiete mit Daten in dieser Ebene</span></summary><div className="table-scroll" tabIndex={0} role="region" aria-label={'Kartenwerte '+view.name+', bei Bedarf seitlich scrollen'}><table className="analysis-table"><thead><tr><th>Gebiet</th><th>{view.name}</th><th>Grundlage</th><th>Datenlage</th></tr></thead><tbody>{dataRows.map((p:any)=>{const value=read(p);return <tr key={p.id} data-selected={p.id===selected?'true':undefined}><th><Button variant="link" className="map-table-select" onClick={()=>choose(p.id)} aria-pressed={p.id===selected}>{p.name}</Button></th><td>{value.text}</td><td>{mode==='change'&&p.comparison.first?`${p.comparison.first.count} / ${p.comparison.first.total} → ${p.comparison.second.count} / ${p.comparison.second.total}`:mode==='dominant'?value.detail:mode==='unlabelled'?`${p.unlabelled} / ${p.total}`:mode==='coverage'?n(p.total)+' Vorgänge':`${p.count??'—'} / ${p.total}`}</td><td>{!p.total?value.text:p.partial?'Teilstand':'Ohne gemeldete Lücke'}</td></tr>})}</tbody></table></div><p className="page-note">Gebiete ohne Daten lassen sich weiterhin über die Kartensuche auswählen. Die Tabelle zeigt die aktuelle Kartenebene.</p></details>
  <p className="map-attribution">© <a href="https://www.bkg.bund.de" target="_blank" rel="noopener noreferrer">BKG</a> (2026), <a href="https://www.govdata.de/dl-de/by-2-0" target="_blank" rel="noopener noreferrer">dl-de/by-2-0</a> · <a href={map.source} target="_blank" rel="noopener noreferrer">Datenquellen</a>. Länder / Kreise: VG2500 (31.12.2024); NRW-Gemeinden: VG250. Projektion und thematische Einfärbung durch vor Ort.</p>
 </div>;
}
