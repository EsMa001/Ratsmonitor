import {PROCESS_STEPS,processStage} from '@/shared/process';
import type {TopicCard,TopicEvent} from '@/shared/types';
export function ProcessProgress({topic,compact=false}:{topic:TopicCard & {events?:TopicEvent[]};compact?:boolean}){
 const stage=processStage(topic);const label=stage<0?'Verfahrensstand nicht belegt':PROCESS_STEPS[stage];
 if(compact)return <span className="steps" role="img" aria-label={'Zuletzt belegter Schritt: '+label}>{PROCESS_STEPS.map((s,i)=><span key={s} className={'steps__bar'+(i<=stage?' steps__bar--done':'')}/>)}</span>;
 return <><ol className="process" aria-label={'Zuletzt belegter Schritt: '+label}>{PROCESS_STEPS.map((s,i)=><li key={s} className={'process__step'+(i>stage?' process__step--open':'')} aria-current={i===stage?'step':undefined}><span className="process__bar"/><span className="process__label">{s==='Tagesordnung'?'Tages\u00adordnung':s}</span></li>)}</ol><p className="process-note">{stage<0?'Der Verfahrensstand ist noch nicht belegt.':'Markiert ist der zuletzt belegte Schritt. Nicht jedes Thema durchläuft alle Schritte.'}</p></>;
}
