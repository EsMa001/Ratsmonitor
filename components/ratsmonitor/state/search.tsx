import {REGIONS} from '@/shared/regions';
import {useSearchParams} from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { STATUS } from "../lib/constants";
import { addCount, countBy, matches, type FilterSpec } from "../lib/filter";
import type { MapEngine } from "../lib/geo/mapEngine";
import { textPart, type ParseResult } from "../lib/place";
import { signature, type SearchSnapshot } from "../lib/savedSearch";
import { terms as toTerms } from "../lib/text";
import type { AreaSource, Article, Radius, SavedSearch, SearchState, StatusId } from "../types";
import { useData } from "./data";

export const INITIAL_SEARCH: SearchState = {
  level:"city", q: "", area: "", areaSrc: "", radius: null, thema: "", monat: "", status: "", sort: "desc", placeOverrides: {}, placeIgnored: {},
};

interface SearchActions {
  /** Suchtext übernehmen; erkannte Orte werden als Gebietsfilter gesetzt */
  applySearch: (value: string, extra?: Partial<SearchState>) => void;
  /** Gebiet setzen; src bestimmt, ob ein Ort aus der Suche entfernt wird */
  setArea: (ags: string, src: AreaSource, opts?: { zoom?: boolean; clearRadius?: boolean; keepPopup?: boolean }) => void;
  startRadius: (ags: string) => void;
  setRadiusKm: (km: number) => void;
  clearRadius: () => void;
  setThema: (v: string) => void;
  setMonat: (v: string) => void;
  setStatus: (v: StatusId | "") => void;
  setLevel: (v:"city"|"district")=>void;
  setSort: (v: "asc" | "desc") => void;
  resetAll: () => void;
  /** Gespeicherte Suche anwenden; false, solange die Karte für einen Umkreis noch lädt */
  applySaved: (s: SavedSearch) => boolean;
  setPopup: (ags: string) => void;
}

interface SearchValue extends SearchActions {
  derived:SearchResults;
  state: SearchState;
  popup: string;
  mapRef: MutableRefObject<MapEngine | null>;
}

const SearchContext = createContext<SearchValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const { geo, place } = useData();
  const [state, setState] = useState<SearchState>(INITIAL_SEARCH);
  const params=useSearchParams();
  useEffect(()=>{const region=REGIONS.find(r=>r.id===params.get("region"));if(region)setState(s=>({...s,area:region.ags,areaSrc:"ui",level:region.kind}));},[params.get("region")]);
  const derived=useDerivedResults(state);
  const [popup, setPopupState] = useState("");
  const ref = useRef(state);
  ref.current = state;
  const mapRef = useRef<MapEngine | null>(null);
  const focusTimer = useRef(0);

  const commit = useCallback((next: SearchState) => {
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
    focusTimer.current = window.setTimeout(() => mapRef.current?.focusArea(ags), 450);
  }, []);

  const actions = useMemo<SearchActions>(() => {
    /* Entfernt einen als Gebiet übernommenen Ort aus dem Suchtext */
    const stripPlace = (s: SearchState): Partial<SearchState> => {
      if (s.areaSrc !== "search") return {};
      const pq = parse(s.q, s);
      return pq.place ? { q: pq.rest } : {};
    };
    const a: SearchActions = {
      applySearch(value, extra) {
        const s = { ...ref.current, ...extra };
        const pq = parse(value, s);
        const next: SearchState = { ...s, q: value, level: pq.place?.ags.length === 8 ? "city" : s.level };
        if (pq.place) {
          if (s.area !== pq.place.ags || s.areaSrc !== "search") {
            next.area = pq.place.ags;
            next.areaSrc = "search";
            next.radius = null;
            setPopupState("");
            schedFocus(pq.place.ags);
          }
        } else if (s.areaSrc === "search") {
          next.area = "";
          next.areaSrc = "";
          schedFocus("");
        }
        commit(next);
      },
      setArea(ags, src, opts = {}) {
        const s = ref.current;
        const next: SearchState = { ...s, ...(src !== "search" ? stripPlace(s) : {}), area: ags, areaSrc: ags ? src : "", level:ags.length===8?"city":s.level };
        if (ags || opts.clearRadius) next.radius = null;
        if (src !== "map" && !opts.keepPopup) setPopupState("");
        clearTimeout(focusTimer.current);
        commit(next);
        if (opts.zoom) mapRef.current?.focusArea(ags);
      },
      startRadius(ags) {
        const c = geo?.center(ags);
        if (!c) return;
        const s = ref.current;
        const r: Radius = { ags, x: c.x, y: c.y, km: s.radius ? s.radius.km : 20 };
        const moving = !!s.radius;
        commit({ ...s, ...stripPlace(s), radius: r, area: "", areaSrc: "" });
        setPopupState("");
        mapRef.current?.fitCircle(r, moving);
      },
      setRadiusKm(km) {
        const s = ref.current;
        if (s.radius && s.radius.km !== km) commit({ ...s, radius: { ...s.radius, km } });
      },
      clearRadius() {
        commit({ ...ref.current, radius: null });
        setPopupState("");
      },
      setThema: (v) => commit({ ...ref.current, thema: v }),
      setMonat: (v) => commit({ ...ref.current, monat: v }),
      setStatus: (v) => commit({ ...ref.current, status: v }),
      setLevel(v) {
        const s=ref.current;
        const area=v==='district'&&s.area.length===8?s.area.slice(0,5):s.area;
        commit({...s,...(area!==s.area?stripPlace(s):{}),level:v,area,areaSrc:area!==s.area?'ui':s.areaSrc});
        setPopupState('');
      },
      setSort: (v) => commit({ ...ref.current, sort: v }),
      resetAll() {
        clearTimeout(focusTimer.current);
        commit({ ...INITIAL_SEARCH, sort: ref.current.sort });
        setPopupState("");
        mapRef.current?.focusArea("");
      },
      applySaved(sv) {
        let radius: Radius | null = null;
        if (sv.radius) {
          const c = sv.radius.x != null && sv.radius.y != null ? { x: sv.radius.x, y: sv.radius.y } : geo?.center(sv.radius.ags);
          if (!c) return false;
          radius = { ags: sv.radius.ags, km: sv.radius.km, x: c.x, y: c.y };
        }
        let q = sv.q || "";
        let areaSrc: AreaSource = sv.area ? sv.areaSrc || "ui" : "";
        const overrides: Record<string, string> = {};
        const ignored: Record<string, true> = {};
        const pq = q && place ? place.parse(q, {}, {}) : null;
        if (areaSrc === "search") {
          if (pq?.place) {
            if (pq.place.ags !== sv.area && pq.key) overrides[pq.key] = sv.area;
          } else {
            q = sv.text || "";
            areaSrc = "ui";
          }
        } else if (pq?.place && pq.key) ignored[pq.key] = true;
        clearTimeout(focusTimer.current);
        commit({
          ...INITIAL_SEARCH, sort: ref.current.sort, level:sv.level||"city", q, area: sv.area, areaSrc, radius, thema: sv.thema, monat: sv.monat, status: sv.status,
          placeOverrides: overrides, placeIgnored: ignored,
        });
        setPopupState("");
        if (radius) mapRef.current?.fitCircle(radius);
        else mapRef.current?.focusArea(sv.area);
        return true;
      },
      setPopup: (ags) => setPopupState(ags),
    };
    return a;
  }, [commit, geo, parse, place, schedFocus]);

  useEffect(() => () => clearTimeout(focusTimer.current), []);

  const value = useMemo<SearchValue>(() => ({ ...actions, state, popup, mapRef,derived }), [actions, state, popup,derived]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchValue {
  const v = useContext(SearchContext);
  if (!v) throw new Error("useSearch außerhalb von SearchProvider");
  return v;
}

/* ---------- Abgeleitete Werte: Treffer, Zähler, erkannter Ort ---------- */
export interface CoverageEntry {ags:string;name:string;count:number;complete:boolean}
export interface SearchResults {
 total:number;coverage:CoverageEntry[];loading:boolean;error:string;page:number;setPage:(page:number)=>void;retry:()=>void;
  pq: ParseResult;
  /** Ort aus der Suche ist als Gebiet aktiv */
  placeActive: boolean;
  text: string;
  terms: string[];
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


function useDerivedResults(state:SearchState):SearchResults {
 const {geo,place}=useData();
 const local=useMemo(()=>{
  const pq:ParseResult=place?place.parse(state.q,state.placeOverrides,state.placeIgnored):{place:null,alts:[],rest:state.q.trim(),key:'',phraseRaw:''};
  const placeActive=!!(pq.place&&state.areaSrc==='search'&&state.area===pq.place.ags),text=textPart(state.q,state.area,state.areaSrc,pq);
  const within=state.radius&&geo?geo.within(state.radius):null;
  const snapshot:SearchSnapshot={q:state.q.trim(),text:text.trim(),area:state.area,areaSrc:state.area?state.areaSrc:'',radius:state.radius?{...state.radius}:null,thema:state.thema,monat:state.monat,status:state.status,level:state.level};
  const params=new URLSearchParams({q:text,area:state.area,label:state.thema,month:state.monat,status:state.status,level:state.level,sort:state.sort});
  if(state.radius)params.set('within',within?REGIONS.filter(r=>r.kind===state.level&&within.set.has(r.ags)).map(r=>r.ags).join(','):'');
  const spec:FilterSpec={area:state.area,radiusSet:within?.set??null,thema:state.thema,monat:state.monat,status:state.status,terms:toTerms(text)};
  return {pq,placeActive,text,terms:toTerms(text),snapshot,signature:signature(snapshot),spec,kommunenInRadius:within?.kommunen??0,key:params.toString()};
 },[state,geo,place]);
 const [navigation,setNavigation]=useState({key:'',page:1}),[attempt,setAttempt]=useState(0);
 const page=navigation.key===local.key?navigation.page:1;
 const revision=useRef({key:'',value:''});
 type ResponseData={articles:Article[];total:number;areaCounts:Record<string,number>;themaCounts:Record<string,number>;monatCounts:Record<string,number>;statusCounts:Record<string,number>;coverage:CoverageEntry[];revision:string};
 const [remote,setRemote]=useState<{key:string;data:ResponseData|null;error:string}>({key:'',data:null,error:''});
 const requestKey=local.key+'&page='+page+'&attempt='+attempt;
 useEffect(()=>{
  const abort=new AbortController(),timer=setTimeout(async()=>{
   const params=new URLSearchParams(local.key);params.set('page',String(page));
   if(page>1&&revision.current.key===local.key&&revision.current.value)params.set('revision',revision.current.value);
   try{
    const response=await fetch('/api/search?'+params,{signal:abort.signal});
    const data=await response.json() as ResponseData & {error?:string};
    if(!response.ok)throw Error(data.error||'Die Suche konnte nicht geladen werden.');
    if(abort.signal.aborted)return;
    revision.current={key:local.key,value:data.revision};
    setRemote({key:requestKey,data:{...data,articles:data.articles.map((a:Article)=>({...a,month:a.date.slice(0,7),hay:''}))},error:''});
   }catch(e){if(!abort.signal.aborted)setRemote({key:requestKey,data:null,error:e instanceof Error?e.message:'Netzwerkfehler.'});}
  },180);
  return()=>{clearTimeout(timer);abort.abort();};
 },[local.key,page,attempt,requestKey]);
 const loading=remote.key!==requestKey,data=loading?null:remote.data;
 return {...local,results:data?.articles??[],total:data?.total??0,areaCounts:data?.areaCounts??{},themaCounts:data?.themaCounts??{},monatCounts:data?.monatCounts??{},statusCounts:data?.statusCounts??{},statusTotal:Object.values(data?.statusCounts??{}).reduce((a,b)=>a+b,0),coverage:data?.coverage??[],loading,error:loading?'':remote.error,page,setPage:(p:number)=>setNavigation({key:local.key,page:p}),retry:()=>{revision.current={key:'',value:''};setNavigation({key:local.key,page:1});setAttempt(a=>a+1);}};
}
export function useSearchResults():SearchResults{return useSearch().derived;}
