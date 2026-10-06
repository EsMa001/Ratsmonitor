import {REGIONS,mapKeys} from '@/shared/regions';
import {radiusParam} from '@/shared/radius-areas.mjs';
import {usePathname,useSearchParams} from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import type { FilterSpec } from "../lib/filter";
import type { MapEngine } from "../lib/geo/mapEngine";
import type { ParseResult, PlaceHit } from "../lib/place";
import { applySearchState, clearAreaState, commitPlacesState, deriveFilters } from "../lib/searchLogic";
import { canonicalQuery, hasScope, queryText, signature, type SearchSnapshot } from "../lib/savedSearch";
import { terms as toTerms } from "../lib/text";
import type { AreaSource, Article, Radius, SavedSearch, SearchState, StatusId } from "../types";
import { useData } from "./data";
import { useFiltersOpen } from "../lib/filtersOpen";
import { usePhone } from "../lib/usePhone";

export const INITIAL_SEARCH: SearchState = {
  level:"city", q: "", area: "", areaSrc: "", radius: null, thema: "", monat: "", von: "", bis: "", scope: "only", status: "", sort: "desc", placeOverrides: {}, placeIgnored: {}, placeScopes: {}, morePlaces: [],
};

interface SearchActions {
  /** Suchtext übernehmen; erkannte Orte werden als Gebietsfilter gesetzt */
  applySearch: (value: string, extra?: Partial<SearchState>) => void;
  /** Gebiet setzen; src bestimmt, ob ein Ort aus der Suche entfernt wird */
  setArea: (ags: string, src: AreaSource, opts?: { zoom?: boolean; clearRadius?: boolean; keepPopup?: boolean }) => void;
  /** Umkreis um das gewählte Gebiet (Kreis oder Gemeinde); 0 km hebt ihn auf */
  setRadiusKm: (km: number) => void;
  clearRadius: () => void;
  setThema: (v: string) => void;
  setMonat: (v: string) => void;
  setZeitraum: (von: string, bis: string) => void;
  setScope: (v: "only" | "with") => void;
  /** Umfang eines weiteren Orts aus der Suche */
  setPlaceScope: (ags: string, v: "only" | "with") => void;
  /**
   * Im Suchtext erkannte Orte als feste Filter übernehmen und aus dem Text entfernen,
   * damit das Feld frei für den nächsten Begriff ist. sep: Eingabe endete mit einem Komma.
   */
  commitPlaces: (sep?: boolean) => void;
  /** Ersten Ortsfilter entfernen; ein weiterer Ort rückt nach */
  clearArea: () => void;
  removeMorePlace: (ags: string) => void;
  setStatus: (v: StatusId | "") => void;
  setLevel: (v:"city"|"district")=>void;
  setSort: (v: SearchState["sort"]) => void;
  setFuture: (v: boolean) => void;
  setNoformal: (v: boolean) => void;
  setAllterms: (v: boolean) => void;
  resetAll: () => void;
  /** Gespeicherte Suche anwenden; false, solange die Karte für einen Umkreis noch lädt */
  applySaved: (s: SavedSearch) => boolean;
  /** Sucht im Voraus (ohne Anzeige), z. B. beim Überfahren eines Vorschlags */
  prefetchText: (value: string) => void;
  prefetchSaved: (s: SavedSearch) => void;
  setPopup: (ags: string) => void;
}

interface SearchValue extends SearchActions {
  derived:SearchResults;
  state: SearchState;
  popup: string;
  mapRef: MutableRefObject<MapEngine | null>;
}

const SearchContext = createContext<SearchValue | null>(null);

/** Der Umkreis hängt am gewählten Kreis bzw. an der Gemeinde: wechselt das Gebiet, wandert er mit; ohne passendes Gebiet entfällt er */
function tieRadius(s: SearchState, geo: { center: (ags: string) => { x: number; y: number } | null } | null): SearchState {
  const r = s.radius;
  if (!r || r.ags === s.area) return s;
  const c = s.area.length >= 5 ? geo?.center(s.area) : null;
  return { ...s, radius: c ? { ags: s.area, x: c.x, y: c.y, km: r.km } : null, morePlaces: c ? [] : s.morePlaces };
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const { geo, place } = useData();
  const [state, setState] = useState<SearchState>(INITIAL_SEARCH);
  const params=useSearchParams();
  // Die Karte kennt Samtgemeinden und neue Fusionsgemeinden nicht: sie werden über eine Mitglieds- bzw. frühere
  // Gemeinde gewählt, die Suche ordnet diese ihnen zu.
  useEffect(()=>{const region=REGIONS.find(r=>r.id===params.get("region"));if(region)setState(s=>({...s,area:mapKeys(region)[0],areaSrc:"ui",level:region.kind}));},[params.get("region")]);
  // Gesucht wird nur, solange die Übersicht zu sehen ist. Sie bleibt auf allen Seiten versteckt eingebunden (Karte und
  // Suchstand bleiben erhalten); ohne diese Bedingung löste jede Detail-, Info- und Kontoseite die volle Suche aus.
  /* Handy: Ändert man Filter im offenen Filterfenster, wird die Suche erst beim Schließen neu ausgeführt
     (die Ergebnisse bleiben bis dahin auf dem Stand beim Öffnen) */
  const filtersOpen=useFiltersOpen(),phone=usePhone(),hold=filtersOpen&&phone;
  const frozen=useRef(state);
  if(!hold)frozen.current=state;
  /* Handy: 15 statt 20 Treffer je Seite */
  const live=useDerivedResults(hold?frozen.current:state,usePathname()==='/',phone?15:20);
  /* Läuft eine Suche, bleibt die Übersicht auf dem letzten fertigen Stand (Leiste, Chips, Karte, Zahl, Liste) und
     wechselt erst, wenn die neuen Treffer da sind; pending zeigt nur den Ladebalken */
  const shown=useRef(live);
  if(!live.loading)shown.current=live;
  const derived=useMemo(()=>live.loading&&shown.current!==live?{...shown.current,setPage:live.setPage,retry:live.retry,pending:true}:live,[live]);
  /* Wann was zu sehen ist: In den ersten 0,5 s passiert nichts. Sind die ersten Treffer bis dahin da, wechseln Karte und
     Liste sofort und nur an der Trefferzahl laufen Punkte, bis die genaue Zahl feststeht. Fehlen sie nach 0,5 s noch,
     steht der Ladering im Suchfeld, bis auch die genaue Zahl da ist (dann keine Punkte). Nie beides zugleich. */
  const searching=derived.pending||derived.totalPending;
  const pendingNow=useRef(false);
  pendingNow.current=derived.pending;
  const [slow,setSlow]=useState(false);
  useEffect(()=>{
    setSlow(false);
    const t=window.setTimeout(()=>{if(pendingNow.current)setSlow(true);},500);
    return()=>window.clearTimeout(t);
  },[live.key,live.page]);
  useEffect(()=>{if(!searching)setSlow(false);},[searching]);
  const results=useMemo<SearchResults>(()=>({...derived,searching,showRing:slow&&searching,showDots:!slow&&!derived.pending&&derived.totalPending}),[derived,searching,slow]);
  const [popup, setPopupState] = useState("");
  const ref = useRef(state);
  ref.current = state;
  const mapRef = useRef<MapEngine | null>(null);
  const focusTimer = useRef(0);
  const geoRef = useRef(geo);
  geoRef.current = geo;

  const commit = useCallback((value: SearchState) => {
    const next = tieRadius(value, geoRef.current);
    ref.current = next;
    setState(next);
  }, []);

  const parse = useCallback(
    (q: string, s: SearchState): ParseResult =>
      place ? place.parse(q, s.placeOverrides, s.placeIgnored) : { place: null, alts: [], rest: q.trim(), key: "", phraseRaw: "" },
    [place],
  );

  const schedFocus = useCallback((ags: string) => {
    clearTimeout(focusTimer.current);
    /* Zentrieren übernimmt die Karte selbst (MapPanel), auch bei mehreren Orten */
    void ags;
  }, []);

  /* Vorausladen: erste Seite der Suche für einen möglichen nächsten Zustand holen (Umkreissuchen ausgenommen) */
  const prefetchState = useCallback(
    (next: SearchState | null) => {
      if (next) warmSearch(computeLocal(next, geo, place, phone ? 15 : 20));
    },
    [geo, place, phone],
  );

  const actions = useMemo<SearchActions>(() => {
    /* Entfernt einen als Gebiet übernommenen Ort aus dem Suchtext */
    const stripPlace = (s: SearchState): Partial<SearchState> => {
      if (s.areaSrc !== "search") return {};
      const pq = parse(s.q, s);
      return pq.place ? { q: pq.rest } : {};
    };
    /* Zustand einer gespeicherten Suche (ohne ihn anzuwenden), auch zum Vorausladen */
    const savedState = (sv: SavedSearch): SearchState | null => {
        let radius: Radius | null = null;
        if (sv.radius) {
          const c = sv.radius.x != null && sv.radius.y != null ? { x: sv.radius.x, y: sv.radius.y } : geo?.center(sv.radius.ags);
          if (!c) return null;
          radius = { ags: sv.radius.ags, km: sv.radius.km, x: c.x, y: c.y };
        }
        let q = sv.q || "";
        /* Ältere gespeicherte Umkreise hatten kein Gebiet: das Zentrum wird zum Gebiet */
        const area = sv.area || radius?.ags || "";
        let areaSrc: AreaSource = sv.area ? sv.areaSrc || "ui" : area ? "ui" : "";
        const overrides: Record<string, string> = {};
        const ignored: Record<string, true> = {};
        const pq = q && place ? place.parse(q, {}, {}) : null;
        if (areaSrc === "search") {
          if (pq?.place) {
            if (pq.place.ags !== area && pq.key) overrides[pq.key] = area;
          } else {
            q = sv.text || "";
            areaSrc = "ui";
          }
        } else if (pq?.place && pq.key) ignored[pq.key] = true;
      return {
          ...INITIAL_SEARCH, sort: ref.current.sort, level:sv.level||"city", q, area, areaSrc, radius, thema: sv.thema, monat: sv.monat, von: sv.von||"", bis: sv.bis||"", scope: sv.scope||"only", status: sv.status, future: !!sv.future, noformal: !!sv.noformal, allterms: !!sv.allterms,
          placeOverrides: overrides, placeIgnored: ignored, placeScopes: Object.fromEntries((sv.more || []).map((m) => [m.ags, m.scope])), morePlaces: radius ? [] : (sv.more || []).filter((m) => m.ags !== area),
        };
    };
    const a: SearchActions = {
      applySearch(value, extra) {
        /* Ein bereits übernommener Ortsfilter bleibt stehen; neu getippte Orte kommen als weitere Orte dazu */
        const { next, focus } = applySearchState({ ...ref.current, ...extra }, value, parse);
        if (focus !== undefined) {
          if (focus) setPopupState("");
          schedFocus(focus);
        }
        commit(next);
      },
      setArea(ags, src, opts = {}) {
        const s = ref.current;
        const next: SearchState = { ...s, ...(src !== "search" ? stripPlace(s) : {}), area: ags, areaSrc: ags ? src : "", level:ags.length===8?"city":s.level };
        if (opts.clearRadius) next.radius = null;
        if (src !== "map" && !opts.keepPopup) setPopupState("");
        clearTimeout(focusTimer.current);
        commit(next);
        if (opts.zoom) mapRef.current?.focusArea(ags);
      },
      setRadiusKm(km) {
        const s = ref.current;
        if (km <= 0) {
          if (s.radius) commit({ ...s, radius: null });
          return;
        }
        if (s.radius) {
          if (s.radius.km !== km) commit({ ...s, radius: { ...s.radius, km } });
          return;
        }
        const c = s.area.length >= 5 ? geo?.center(s.area) : null;
        if (c) commit({ ...s, radius: { ags: s.area, x: c.x, y: c.y, km }, morePlaces: [] });
      },
      clearRadius() {
        commit({ ...ref.current, radius: null });
        setPopupState("");
      },
      setThema: (v) => commit({ ...ref.current, thema: v }),
      setMonat: (v) => commit({ ...ref.current, monat: v }),
      setZeitraum: (von, bis) => commit({ ...ref.current, von, bis, monat: "" }),
      setScope: (v) => {
        const s = ref.current;
        /* „Nur Kreis“ auf der Kreisebene der Karte zeigen, „inklusive Gemeinden“ auf der Gemeindeebene */
        commit({ ...s, scope: v, level: s.area.length === 5 ? (v === "only" ? "district" : "city") : s.level });
      },
      commitPlaces(sep) {
        const next = commitPlacesState(ref.current, !!sep, parse);
        if (next) commit(next);
      },
      clearArea() {
        commit(clearAreaState(ref.current, parse));
        setPopupState("");
      },
      removeMorePlace(ags) {
        const s = ref.current;
        commit({ ...s, morePlaces: (s.morePlaces ?? []).filter((m) => m.ags !== ags) });
      },
      setPlaceScope: (ags, v) => {
        const s = ref.current;
        commit({ ...s, placeScopes: { ...s.placeScopes, [ags]: v }, morePlaces: (s.morePlaces ?? []).map((m) => (m.ags === ags ? { ...m, scope: v } : m)) });
      },
      setStatus: (v) => commit({ ...ref.current, status: v }),
      setLevel(v) {
        const s=ref.current;
        const area=v==='district'&&s.area.length===8?s.area.slice(0,5):s.area;
        commit({...s,...(area!==s.area?stripPlace(s):{}),level:v,area,areaSrc:area!==s.area?'ui':s.areaSrc});
        setPopupState('');
      },
      setSort: (v) => commit({ ...ref.current, sort: v }),
      setFuture: (v) => commit({ ...ref.current, future: v }),
      setNoformal: (v) => commit({ ...ref.current, noformal: v }),
      setAllterms: (v) => commit({ ...ref.current, allterms: v }),
      resetAll() {
        clearTimeout(focusTimer.current);
        commit({ ...INITIAL_SEARCH, sort: ref.current.sort });
        setPopupState("");
        mapRef.current?.focusArea("");
      },
      applySaved(sv) {
        const next = savedState(sv);
        if (!next) return false;
        clearTimeout(focusTimer.current);
        commit(next);
        setPopupState("");
        if (next.radius) mapRef.current?.fitCircle(next.radius);
        else mapRef.current?.focusArea(next.area);
        return true;
      },
      /* Vorausladen beim Überfahren eines Vorschlags: Suche starten, ohne etwas anzuzeigen */
      prefetchText(value) {
        const { next } = applySearchState({ ...ref.current }, value, parse);
        prefetchState(commitPlacesState(next, false, parse) ?? next);
      },
      prefetchSaved(sv) {
        prefetchState(savedState(sv));
      },
      setPopup: (ags) => setPopupState(ags),
    };
    return a;
  }, [commit, geo, parse, place, prefetchState, schedFocus]);

  useEffect(() => () => clearTimeout(focusTimer.current), []);

  const value = useMemo<SearchValue>(() => ({ ...actions, state, popup, mapRef,derived:results }), [actions, state, popup,results]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchValue {
  const v = useContext(SearchContext);
  if (!v) throw new Error("useSearch außerhalb von SearchProvider");
  return v;
}

/* ---------- Abgeleitete Werte: Treffer, Zähler, erkannter Ort ---------- */
export interface CoverageEntry {ags:string;name:string;count:number;complete:boolean}
/** Was die Hook selbst liefert; Ring und Punkte kommen aus dem Provider (siehe dort) */
type LiveResults=Omit<SearchResults,'showRing'|'showDots'|'searching'>;
export interface SearchResults {
 /** Suche läuft noch: neue Treffer oder genaue Zahl fehlen */searching:boolean;/** Ladering im Suchfeld (Suche dauert über 0,5 s) */showRing:boolean;/** Punkte an der Trefferzahl (erste Treffer schnell da, Zahl noch nicht) */showDots:boolean;
 total:number;/** Genaue Trefferzahl noch unterwegs */totalPending:boolean;/** Es gibt eine weitere Seite (auch ohne die genaue Gesamtzahl) */hasMore:boolean;coverage:CoverageEntry[];
  /** Abfrage der aktuellen Suche (für Export), ohne Seite */
  key:string;
  around:{set:Set<string>|null;level:string}|null;
  /** jüngster erfolgreicher Datenabruf (ISO) */
  updatedAt:string|null;loading:boolean;/** neue Suche läuft, angezeigt wird noch der letzte fertige Stand */pending:boolean;error:string;page:number;setPage:(page:number)=>void;retry:()=>void;
  pq: ParseResult;
  /** Ort aus der Suche ist als Gebiet aktiv */
  placeActive: boolean;
  /** Im Suchtext erkannte Orte, die gerade als Filter wirken (noch nicht übernommen) */
  liveHits: PlaceHit[];
  text: string;
  terms: string[];
  /** Treffer je Seite (Handy 15, sonst 20) */
  pageSize: number;
  spec: FilterSpec;
  results: Article[];
  areaCounts: Record<string, number>;
  themaCounts: Record<string, number>;
  monatCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  statusTotal: number;
  kommunenInRadius: number;
  snapshot: SearchSnapshot;
  signature: string;
}


const EMPTY_LIST:Article[]=[],EMPTY_MAP:Record<string,number>={},EMPTY_COVERAGE:CoverageEntry[]=[];
type ResponseData={articles:Article[];total:number;hasMore?:boolean;areaCounts:Record<string,number>;themaCounts:Record<string,number>;monatCounts:Record<string,number>;statusCounts:Record<string,number>;revision:string};
type DataValue=ReturnType<typeof useData>;
/* Fertige Antworten (5 Minuten) und laufende Anfragen, geteilt von der Übersicht und dem Vorausladen (z. B. beim Überfahren
   eines Vorschlags): gleiche Suche = eine Anfrage, und ein Klick trifft oft schon die fertige Antwort */
const SEARCH_CACHE=new Map<string,{at:number;data:ResponseData}>(),INFLIGHT=new Map<string,Promise<ResponseData>>();
/* Zähler (Gebiete, Themen, Status, Gesamtzahl) kommen getrennt von der Ergebnisseite und gelten für die ganze Suche, nicht je Seite */
type Facets=Pick<ResponseData,'total'|'areaCounts'|'themaCounts'|'monatCounts'|'statusCounts'|'revision'>;
const FACETS_CACHE=new Map<string,{at:number;data:Facets}>();
const freshFacets=(key:string)=>{const hit=FACETS_CACHE.get(key);return hit&&Date.now()-hit.at<300000?hit.data:null;};
const searchKey=(key:string,page=1,attempt=0)=>key+'&page='+page+'&attempt='+attempt;
const freshSearch=(requestKey:string)=>{const hit=SEARCH_CACHE.get(requestKey);return hit&&Date.now()-hit.at<300000?hit.data:null;};
function rememberSearch(requestKey:string,data:ResponseData){SEARCH_CACHE.delete(requestKey);SEARCH_CACHE.set(requestKey,{at:Date.now(),data});if(SEARCH_CACHE.size>40)SEARCH_CACHE.delete(SEARCH_CACHE.keys().next().value as string);}
async function fetchSearch(query:string,signal?:AbortSignal):Promise<ResponseData>{
 const response=await fetch('/api/search?'+query,{signal});
 const data=await response.json() as ResponseData & {error?:string};
 if(!response.ok)throw Error(data.error||'Die Suche konnte nicht geladen werden.');
 return {...data,articles:data.articles.map((a:Article)=>({...a,month:a.date.slice(0,7),hay:''}))};
}
/** Sucht im Voraus (erste Seite), ohne etwas anzuzeigen; Umkreissuchen und bereits Vorhandenes werden übersprungen */
function warmSearch(local:{key:string;around:unknown}){
 if(local.around)return;
 const requestKey=searchKey(local.key);
 if(freshSearch(requestKey)||INFLIGHT.has(requestKey))return;
 const params=new URLSearchParams(local.key);params.delete('around');params.set('page','1');params.set('part','page');
 const job=fetchSearch(params.toString()).then(data=>{rememberSearch(requestKey,data);return data;}).finally(()=>INFLIGHT.delete(requestKey));
 INFLIGHT.set(requestKey,job);job.catch(()=>{});
}
function computeLocal(state:SearchState,geo:DataValue['geo'],place:DataValue['place'],pageSize:number){
  const pq:ParseResult=place?place.parse(state.q,state.placeOverrides,state.placeIgnored):{place:null,alts:[],rest:state.q.trim(),key:'',phraseRaw:''};
  /* Ortsfilter: fester erster Ort (state.area), feste weitere Orte (morePlaces) und live im Text erkannte Orte */
  const {placeActive,liveHits,text,more}=deriveFilters(state,pq,ags=>hasScope(ags,geo));
  const within=state.radius&&geo?geo.within(state.radius):null;
  const snapshot:SearchSnapshot={q:state.q.trim(),text:text.trim(),area:state.area,areaSrc:state.area?state.areaSrc:'',radius:state.radius?{...state.radius}:null,thema:state.thema,monat:state.monat,von:state.von,bis:state.bis,scope:state.scope,more,status:state.status,level:state.level,future:!!state.future,noformal:!!state.noformal,allterms:!!state.allterms};
  /* Kreisfreie Städte (Kreisschlüssel ohne Umfangwahl) zählen immer mit ihrer Stadt; mit Umkreis ist das Gebiet nur dessen Mittelpunkt; gesucht wird in allen Gebieten im Umkreis */
  const area=state.radius?'':state.area;
  /* Ohne „inkl. Zukunft“ endet der Zeitraum heute (sofern kein eigenes Enddatum gesetzt ist) */
  const today=new Date().toISOString().slice(0,10),to=state.bis||(state.future?'':today);
  const params=new URLSearchParams({q:canonicalQuery(queryText(text,state.allterms)),area,label:state.thema,month:state.monat,from:state.von,to,scope:area?(area.length===5&&!hasScope(area,geo)?"with":state.scope):"with",status:state.status,level:state.level,sort:state.sort});
  if(state.noformal)params.set('noformal','1');
  if(pageSize!==20)params.set('size',String(pageSize));
  if(more.length&&!state.radius)params.set('more',more.map(m=>m.ags+':'+(m.ags.length===5&&!hasScope(m.ags,geo)?'with':m.scope)).join(','));
  /* Umkreis: Der Schlüssel der Anfrage nennt nur den Kreis; welche Gebiete darin liegen, setzt der Abruf selbst ein (siehe unten) */
  if(state.radius)params.set('around',[state.radius.ags,state.radius.km,Math.round(state.radius.x??0),Math.round(state.radius.y??0),within?within.set.size:'-'].join(':'));
  const spec:FilterSpec={area,radiusSet:within?.set??null,thema:state.thema,monat:state.monat,status:state.status,terms:toTerms(text)};
  return {pq,placeActive,liveHits,text,terms:toTerms(text),pageSize,snapshot,signature:signature(snapshot),spec,kommunenInRadius:within?.kommunen??0,key:params.toString(),around:state.radius?{set:within?.set??null,level:state.level}:null};
 }
function useDerivedResults(state:SearchState,active:boolean,pageSize=20):LiveResults {
 const {geo,place}=useData();
 const local=useMemo(()=>computeLocal(state,geo,place,pageSize),[state,geo,place,pageSize]);
 const [navigation,setNavigation]=useState({key:'',page:1}),[attempt,setAttempt]=useState(0);
 const page=navigation.key===local.key?navigation.page:1;
 const revision=useRef({key:'',value:''});
 /* Gebiete mit Berichten je Ebene und der jüngste Abruf: ein eigener Abruf je Ebene (/api/search/coverage), den der
    Browser zwischenspeichern darf. Früher kamen sie mit jeder Suche (rund 400 KB je Anfrage und Tastendruck). */
 const covered=useRef<Record<string,Set<string>>>({});
 const [cover,setCover]=useState<Record<string,{coverage:CoverageEntry[];updatedAt:string|null}>>({});
 const loadCover=useCallback(async(level:string,signal?:AbortSignal)=>{
  const response=await fetch('/api/search/coverage?level='+level,{signal});if(!response.ok)return null;
  const data=await response.json() as {coverage:CoverageEntry[];updatedAt:string|null};
  covered.current[level]=new Set(data.coverage.map(c=>c.ags));setCover(c=>({...c,[level]:data}));return data;
 },[]);
 useEffect(()=>{if(!active||cover[state.level])return;const abort=new AbortController();loadCover(state.level,abort.signal).catch(()=>{});return()=>abort.abort();},[active,state.level,cover,loadCover]);
 /* Abfrage für Seite oder Zähler. Umkreis: nur Gebiete mit Berichten, als kürzere der beiden Listen (shared/radius-areas.mjs).
    Welche Gebiete Berichte haben, nennt jede Antwort; vor der ersten wird einmal danach gefragt. */
 const buildQuery=useCallback(async(page:number,part:'page'|'facets',signal:AbortSignal)=>{
  const params=new URLSearchParams(local.key);params.delete('around');params.set('part',part);
  if(part==='page'){params.set('page',String(page));if(page>1&&revision.current.key===local.key&&revision.current.value)params.set('revision',revision.current.value);}
  if(local.around){
   const {set,level}=local.around;
   if(!set)params.set('within','');
   else{
    let known=covered.current[level];
    if(!known&&await loadCover(level,signal))known=covered.current[level];
    const [name,keys]=radiusParam(REGIONS.filter(r=>r.kind===level),set,known||null);params.set(name,keys);
   }
  }
  return params.toString();
 },[local,loadCover]);
 const [remote,setRemote]=useState<{key:string;data:ResponseData|null;error:string}>({key:'',data:null,error:''});
 const requestKey=searchKey(local.key,page,attempt);
 /* Wann gesucht wird: Die erste Suche geht sofort hinaus. Beim Tippen wird erst nach 400 ms Ruhe und erst ab 3 Buchstaben
    im Voraus gesucht (die Kurzsuchen sind am teuersten und bleiben unsichtbar, die Seite wechselt erst nach Enter). Enter
    oder die Auswahl aus der Liste starten die Suche sofort bzw. nutzen die schon laufende Vorab-Suche. Filter und Sortierung
    warten 180 ms. Fertige Antworten merkt sich der Browser 5 Minuten, damit Löschen und Zurückgehen sofort gehen. */
 const sent=useRef(false),lastText=useRef(''),flush=useRef<(()=>void)|null>(null);
 useEffect(()=>{
  const on=()=>flush.current?.();
  window.addEventListener('rm:search-confirmed',on);
  return()=>window.removeEventListener('rm:search-confirmed',on);
 },[]);
 useEffect(()=>{
  if(!active)return;
  const hit=freshSearch(requestKey);
  if(hit){lastText.current=local.text;revision.current={key:local.key,value:hit.revision};setRemote({key:requestKey,data:hit,error:''});return;}
  const abort=new AbortController();let timer=0,started=false;
  const start=()=>{
   if(started)return;
   started=true;clearTimeout(timer);flush.current=null;lastText.current=local.text;sent.current=true;
   (async()=>{
    try{
     const query=await buildQuery(page,'page',abort.signal);
     /* Läuft für dieselbe Suche schon eine Vorab-Anfrage (Tippen, Überfahren eines Vorschlags), wird deren Antwort genutzt */
     const ready=await (INFLIGHT.get(requestKey)??fetchSearch(query,abort.signal));
     if(abort.signal.aborted)return;
     revision.current={key:local.key,value:ready.revision};
     rememberSearch(requestKey,ready);
     setRemote({key:requestKey,data:ready,error:''});
    }catch(e){if(!abort.signal.aborted)setRemote({key:requestKey,data:null,error:e instanceof Error?e.message:'Netzwerkfehler.'});}
   })();
  };
  const typing=local.text!==lastText.current,t=local.text.trim();
  flush.current=start;
  /* 1 bis 2 neue Buchstaben: noch nicht suchen, nur bei Enter oder Auswahl (flush) */
  if(!(typing&&t.length>0&&t.length<3))timer=window.setTimeout(start,!sent.current?0:typing&&t?400:180);
  return()=>{clearTimeout(timer);abort.abort();if(flush.current===start)flush.current=null;};
 },[active,local.key,page,attempt,requestKey,buildQuery]);
 /* Zähler: nach der Ergebnisseite, einmal je Suche (Blättern ändert sie nicht) */
 const [facets,setFacets]=useState<{key:string;data:Facets|null}>({key:'',data:null});
 const pageReady=remote.key===requestKey&&!!remote.data;
 useEffect(()=>{
  if(!active||!pageReady)return;
  const hit=freshFacets(local.key);
  if(hit){setFacets({key:local.key,data:hit});return;}
  const abort=new AbortController();
  (async()=>{
   try{
    const query=await buildQuery(1,'facets',abort.signal);
    const data=await fetchSearch(query,abort.signal) as Facets;
    if(abort.signal.aborted)return;
    FACETS_CACHE.delete(local.key);FACETS_CACHE.set(local.key,{at:Date.now(),data});if(FACETS_CACHE.size>40)FACETS_CACHE.delete(FACETS_CACHE.keys().next().value as string);
    setFacets({key:local.key,data});
   }catch{/* Zähler fehlen, die Treffer bleiben nutzbar */}
  })();
  return()=>abort.abort();
 },[active,pageReady,local.key,attempt,buildQuery]);
 /* Zähler der vorigen Suche wären falsch: bis die neuen da sind, bleiben Karte und Filter ohne Zahlen */
 const exact=facets.key===local.key?facets.data:null;
 const fx=exact;
 /* Liegt die Antwort schon im Zwischenspeicher, gilt sie sofort als fertig: kein „lädt“, kein Ring, kein Aufblitzen */
 const cached=active?freshSearch(requestKey):null;
 const loading=!cached&&remote.key!==requestKey;
 const lastGood=useRef<ResponseData|null>(null);
 if(!loading&&(cached||remote.data))lastGood.current=cached??remote.data;
 /* Beim Nachladen die bisherigen Treffer stehen lassen, statt die Liste zu leeren */
 const data=loading?lastGood.current:(cached??remote.data);
 const setPage=useCallback((p:number)=>setNavigation({key:local.key,page:p}),[local.key]);
 const retry=useCallback(()=>{revision.current={key:'',value:''};setNavigation({key:local.key,page:1});setAttempt(a=>a+1);},[local.key]);
 /* Stabiles Ergebnisobjekt: ändert sich nur, wenn sich Suche oder Antwort ändern (sonst rendern alle Konsumenten neu) */
 const error=loading||cached?'':remote.error;
 /* Genaue Zahl, sobald die Zähler da sind; davor die gedeckelte Zählung der Seite */
 /* Gibt es keine weitere Seite, ist die Zahl auch ohne die Zähler bekannt; sonst fehlt sie, bis die Zähler da sind */
 const known=data&&data.hasMore===false?(page-1)*pageSize+data.articles.length:null;
 const total=exact?exact.total:known??0,pendingTotal=!exact&&known===null;
 /* Mit genauer Zahl zählt die Seitenzahl, davor meldet die Antwort selbst, ob noch eine Seite folgt */
 const hasMore=exact?page<Math.ceil(exact.total/pageSize):!!data?.hasMore;
 /* Nächste Seite still im Hintergrund holen, damit „Weiter“ sofort geht (die Anfrage nutzt dieselbe laufende Abfrage wie der Klick) */
 useEffect(()=>{
  if(!active||!pageReady||!hasMore||loading)return;
  const next=searchKey(local.key,page+1,attempt);
  if(freshSearch(next)||INFLIGHT.has(next))return;
  const abort=new AbortController();
  (async()=>{
   try{
    const query=await buildQuery(page+1,'page',abort.signal);
    if(abort.signal.aborted||freshSearch(next)||INFLIGHT.has(next))return;
    const job=fetchSearch(query).then(d=>{rememberSearch(next,d);return d;}).finally(()=>INFLIGHT.delete(next));
    INFLIGHT.set(next,job);job.catch(()=>{});
   }catch{/* Vorladen ist nur eine Hilfe */}
  })();
  return()=>abort.abort();
 },[active,pageReady,hasMore,loading,page,attempt,local.key,buildQuery]);
 return useMemo(()=>({...local,results:data?.articles??EMPTY_LIST,total,totalPending:pendingTotal,hasMore,areaCounts:fx?.areaCounts??EMPTY_MAP,themaCounts:fx?.themaCounts??EMPTY_MAP,monatCounts:fx?.monatCounts??EMPTY_MAP,statusCounts:fx?.statusCounts??EMPTY_MAP,statusTotal:Object.values(fx?.statusCounts??{}).reduce((a,b)=>a+b,0),coverage:cover[state.level]?.coverage??EMPTY_COVERAGE,updatedAt:cover[state.level]?.updatedAt??null,loading,pending:false,error,page,setPage,retry}),[local,data,total,pendingTotal,hasMore,fx,loading,error,page,setPage,retry,cover,state.level]);
}
export function useSearchResults():SearchResults{return useSearch().derived;}
