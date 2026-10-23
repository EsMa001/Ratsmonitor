// Messung der Köpfe auf Prüfberichten (gemeinsam für scripts/model/train.mjs und scripts/model/measure.mjs): je Frage Anteil richtig,
// bei Listen (Unterthemen) Genauigkeit und Abdeckung, bei Art, Status und Vorgangsart zusätzlich der Anteil sicherer Antworten.
import {SURE,classify} from '../../shared/model/heads.mjs';
import {applicantKind} from '../../shared/model/features.mjs';

// Schritt (Begriffsbuch 4b): neues Feld step, sonst Planschritt und Schritt der Wärmeplanung übersetzt
const PLANMAP={aufstellung:'start',fruehzeitig:'frueh',entwurf:'entwurf',abwaegung:'abwaegung',satzung:'beschluss',aufhebung:'aufhebung',sonst:'sonst'},HEATMAP={start:'start',analyse:'frueh',entwurf:'entwurf',beschluss:'beschluss',umsetzung:'umsetzung'};
export const stepOf=r=>r.gold.step||PLANMAP[r.gold.planstep]||HEATMAP[r.gold.heatstep]||null;
export const listEval=(rs,predict,goldOf)=>{let given=0,right=0,want=0,hit=0;for(const r of rs){const g=goldOf(r)||[],got=predict(r);
 given+=got.length;right+=got.filter(x=>g.includes(x)).length;if(g.length){want++;if(got.some(x=>g.includes(x)))hit++;}}
 const a=given?right/given:0,c=want?hit/want:0;return {acc:a,cov:c,score:a+c?2*a*c/(a+c):0};};

/** @returns {{Q:object,out:Map}} */
export function measure(test,model,EK,today){
 const isS=r=>r.gold.kind==='subject';
 const out=new Map(test.map(r=>[r.i,classify(r,k=>EK(r,k),model,today)]));
 const pc=(a,b)=>b?Math.round(100*a/b):null,Q={};
 const acc=(name,rs,pred,gold,n0)=>{let n=0,ok=0;for(const r of rs){n++;if(pred(out.get(r.i))===gold(r))ok++;}Q[name]={acc:pc(ok,n),n:n0??n};};
 acc('kind',test,o=>o.kind,r=>r.gold.kind);
 acc('status',test,o=>o.status,r=>r.gold.status);
 acc('process',test.filter(isS),o=>o.process,r=>r.gold.process);
 acc('project',test.filter(isS),o=>o.project,r=>!!r.gold.project);
 acc('step',test.filter(r=>isS(r)&&stepOf(r)),o=>o.step,stepOf);
 acc('service',test.filter(r=>isS(r)&&r.gold.process==='build'),o=>o.service||'none',r=>r.gold.service||'none');
 acc('main',test.filter(r=>r.pdfs.length),o=>o.main,r=>r.gold.main??null);
 acc('result',test.filter(r=>r.pdfs.length),o=>o.result,r=>r.gold.result_doc??null);
 {let n=0,ok=0;for(const r of test)r.pdfs.forEach((p,j)=>{n++;if(out.get(r.i).doctypes[j]===r.gold.doctypes?.[p.i])ok++;});Q.doctype={acc:pc(ok,n),n};}
 const lst=(name,rs,got,gold)=>{const v=listEval(rs,r=>got(out.get(r.i)),gold);Q[name]={acc:Math.round(v.acc*100),cov:Math.round(v.cov*100),n:rs.length};};
 {let given=0,right=0,want=0,hit=0;for(const r of test.filter(isS)){const o=out.get(r.i),g=r.gold.themes||[],th=o.themes[0];if(th){given++;if(g.includes(th))right++;}if(!g.includes('offen')&&g.length){want++;if(th&&g.includes(th))hit++;}}
  Q.theme={acc:pc(right,given),cov:pc(hit,want),n:test.filter(isS).length};}
 lst('sub',test.filter(isS),o=>o.subs,r=>r.gold.subs);
 lst('subsub',test.filter(r=>isS(r)&&(r.gold.subs||[]).length),o=>o.subsubs,r=>r.gold.subsubs);
 acc('applicants',test.filter(r=>isS(r)&&r.gold.process==='political'&&!!applicantKind(r.gold.applicants)),o=>o.applicants[0]||null,r=>applicantKind(r.gold.applicants));
 for(const [name,key,rs,gold] of [['kind','kindP',test,r=>r.gold.kind],['status','statusP',test,r=>r.gold.status],['process','processP',test.filter(isS),r=>r.gold.process]]){
  let n=0,ok=0;for(const r of rs){const o=out.get(r.i);if(o[key]>=SURE){n++;if(o[name]===gold(r))ok++;}}Q[name].sureAcc=pc(ok,n);Q[name].sureShare=pc(n,rs.length);}
 return {Q,out};
}
