'use client';
import {Component,lazy,Suspense,useEffect,useRef,useState,type ReactNode} from 'react';
import {Button} from '@/components/ui/button';
import type {RegionAvailability} from '@/components/region-select';
const Map=lazy(()=>import('./germany-heatmap').then(module=>({default:module.GermanyHeatmap})));
type Props={places:any[];region:string;topicMode:boolean;availability:RegionAvailability;comparisonPeriods:any;subject:string;from:string;to:string};
class MapBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<div className="map-loading" role="alert"><p>Die Karte konnte nicht geladen werden. Die übrigen Auswertungen bleiben verfügbar.</p><Button variant="outline" onClick={()=>window.location.reload()}>Seite neu laden</Button></div>:this.props.children;}
}
export function DeferredMap(props:Props){
 const element=useRef<HTMLDivElement>(null),[visible,setVisible]=useState(false);
 useEffect(()=>{
  if(!('IntersectionObserver' in window)){setVisible(true);return;}
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'300px'});
  if(element.current)observer.observe(element.current);
  return ()=>observer.disconnect();
 },[]);
 return <div ref={element} className="deferred-map">{visible?<MapBoundary><Suspense fallback={<p className="map-loading" role="status">Karte wird geladen …</p>}><Map {...props}/></Suspense></MapBoundary>:<div className="map-loading"><p>Karte und sechs Ansichten werden beim Erreichen dieses Abschnitts geladen.</p><Button variant="outline" onClick={()=>setVisible(true)}>Karte jetzt laden</Button></div>}</div>;
}
