// Anwenden der gelernten Köpfe (requirements/modell-konzept.md): Kette Dokumentart → Haupt-/Ergebnisdokument → neun Fragen.
// Reine Funktionen über gespeicherte Gewichte (scripts/model/train.mjs schreibt sie); dieselbe Rechnung wie beim Lernen.
import {KIND,THEMES,STATUS,PROCESS,STEPS,SERVICE,APPLICANTS,DOCTYPES,pdfSparse,reportSparse,flags,cat} from './features.mjs';

/** Gewicht der Einbettungen gegenüber den Wortteilen (beim Lernen gleich) */
export const DENSE_SCALE=8;
/** Ab dieser Wahrscheinlichkeit gilt eine Einzelantwort als sicher */
export const SURE=0.7;

/** Ein gespeicherter Kopf: {classes,vocab:Map,V,DD,W,U,B} (Wortteile W[k*V+i], dicht U[k*DD+j], Versatz B[k]) */
export function headLogits(h,s,d){
 const K=h.classes.length,idx=[];const seen=new Set();
 if(h.V)for(const f of s){const i=h.vocab.get(f);if(i!==undefined&&!seen.has(i)){seen.add(i);idx.push(i);}}
 const out=new Float64Array(K);
 for(let k=0;k<K;k++){let z=h.B[k];const ow=k*h.V,ou=k*h.DD;for(const i of idx)z+=h.W[ow+i];for(let j=0;j<h.DD;j++)z+=h.U[ou+j]*d[j]*DENSE_SCALE;out[k]=z;}
 return out;
}
const sig=z=>1/(1+Math.exp(-z));
/** Zweistufiger Kopf: erst aus der Einbettung (a), dann die Wortteile als Korrektur (b) */
export function stackProb(st,s,d){
 const za=headLogits(st.a,[],d),zb=headLogits(st.b,s,new Float32Array(0)),out={};
 st.classes.forEach((c,k)=>{out[c]=sig(za[k]+zb[k]);});return out;
}
/** Ein gespeicherter Kopf: zweistufig (a, b) oder einfach (Wortteile und dicht zusammen; ohne dichte Gewichte nur Wortteile) */
export function headProb(h,s,d){
 if(h.a)return stackProb(h,s,d);
 const z=headLogits(h,s,h.DD?d:new Float32Array(0)),out={};h.classes.forEach((c,k)=>{out[c]=sig(z[k]);});return out;
}
const argmax=p=>{let b=null;for(const [c,q] of Object.entries(p))if(!b||q>b[1])b=[c,q];return b||[null,0];};

/**
 * Ordnet einen Bericht ein.
 * @param {ReturnType<import('./features.mjs').inputOf>} input
 * @param {(key:string)=>Float32Array|null} emb  Einbettung je Schlüssel aus encoderTexts (t, r, p.<i>), null wenn es den Text nicht gibt
 * @param {any} model  geladene Köpfe (loadHeads)
 * @param {string} today  Stichtag JJJJ-MM-TT
 */
export function classify(input,emb,model,today){
 const D=model.dim,ZERO=new Float32Array(D),E=k=>emb(k)||ZERO,P=model.heads,T=model.thresholds;
 // 1. Dokumentart je PDF, 2. Haupt- und Ergebnisdokument (bestes über 0,5)
 const doctypes=[],docProb=[];
 for(const p of input.pdfs){const s=pdfSparse(input,p),d=E(`p.${p.i}`),t=headProb(P.doctype,s,d);doctypes.push(argmax(t)[0]);
  docProb.push(headProb(P.document,s,cat(d,Float32Array.from(DOCTYPES.map(c=>t[c])))));}
 const pick=c=>{let best=null,bp=0.5;input.pdfs.forEach((p,j)=>{if(docProb[j][c]>bp){bp=docProb[j][c];best=p.i;}});return best;};
 const main=pick('main'),result=pick('result');
 // Merkmale des Berichts
 const s=reportSparse(input,main),d=cat(E('t'),main!=null?E(`p.${main}`):ZERO,result!=null?E(`p.${result}`):ZERO,E('r'),flags(input,main,result,today));
 const one=name=>{const p=headProb(P[name],s,d),[c,q]=argmax(p);return {value:c,p:q};};
 const kind=one('kind'),status=one('status');
 const out={main,result,doctypes,kind:kind.value,kindP:kind.p,status:status.value,statusP:status.p,
  themes:[],subs:[],subsubs:[],themeP:0,process:null,processP:0,project:null,projectP:0,step:null,stepP:0,service:null,serviceP:0,applicants:[]};
 if(kind.value!=='subject')return out;
 // Thema: das wahrscheinlichste ab der Schwelle, weitere ab 0,5; Unterthemen je Thema, Unter-Unterthemen je Unterthema
 const tp=headProb(P.themes,s,d),[top,topP]=argmax(tp);out.themeP=topP;
 if(topP>=T.theme)out.themes=[top,...Object.entries(tp).filter(([c,q])=>c!==top&&q>=Math.max(T.theme,0.5)).map(([c])=>c)];
 for(const th of out.themes)if(P.subs[th])for(const [c,q] of Object.entries(headProb(P.subs[th],s,d)))if(q>=T.sub)out.subs.push(c);
 for(const u of out.subs)if(P.subsubs[u])for(const [c,q] of Object.entries(headProb(P.subsubs[u],s,d)))if(q>=T.subsub)out.subsubs.push(c);
 const pr=one('process');out.process=pr.value;out.processP=pr.p;
 const pj=headProb(P.project,s,d).ja;out.project=pj>=0.5;out.projectP=pj>=0.5?pj:1-pj;
 if(pr.value==='planning'){const st=one('step');out.step=st.value;out.stepP=st.p;}
 if(pr.value==='build'){const sv=one('service');out.service=sv.value==='none'?null:sv.value;out.serviceP=sv.p;}
 if(pr.value==='political'){const ap=one('applicants');out.applicants=[ap.value];out.applicantP=ap.p;}
 return out;
}

/** Kataloge, die ein gespeichertes Modell haben muss (Prüfung beim Laden) */
export const CATALOGS={kind:KIND,status:STATUS,themes:THEMES,process:PROCESS,step:STEPS,service:SERVICE,applicants:APPLICANTS,doctype:DOCTYPES};

/** Köpfe aus dem gespeicherten Format: JSON (Aufbau) und ein Float32-Puffer (Gewichte, Versatz je Feld) */
export function loadHeads(json,buffer){
 const f32=new Float32Array(buffer.buffer,buffer.byteOffset,buffer.byteLength/4);
 const arr=o=>f32.subarray(o[0],o[0]+o[1]);
 const head=h=>({classes:h.classes,V:h.vocab.length,DD:h.DD,vocab:new Map(h.vocab.map((v,i)=>[v,i])),W:arr(h.W),U:arr(h.U),B:arr(h.B)});
 const stack=st=>st.a?{classes:st.classes,a:head(st.a),b:head(st.b)}:head(st);
 const map=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,stack(v)]));
 const H=json.heads;
 const heads={...Object.fromEntries(Object.entries(H).filter(([k])=>k!=='subs'&&k!=='subsubs').map(([k,v])=>[k,stack(v)])),subs:map(H.subs),subsubs:map(H.subsubs)};
 for(const [k,cls] of Object.entries(CATALOGS))if(JSON.stringify(heads[k]?.classes)!==JSON.stringify(cls))throw new Error(`Modell passt nicht zum Katalog: ${k}`);
 return {version:json.version,dim:json.dim,thresholds:json.thresholds,heads};
}
