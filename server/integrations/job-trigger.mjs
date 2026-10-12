/*
 * Auslöser für die Server-Jobs (Admin-Reiter PDF-Import, Speicher & Sicherungen, Jobs & Zeitpläne): Ein Knopfdruck legt seinen
 * Wunsch in system_state ab und schreibt zusätzlich die Datei <Auslöserordner>/<Job>. Auf dem Server beobachtet je Job eine
 * systemd-Einheit diese Datei (deploy/node/ratsmonitor-*.path) und startet den Job sofort; scripts/schedule.mjs sieht den
 * offenen Wunsch und führt ihn aus. Ohne Auslöser (lokal, Worker) bleibt es beim 10-Minuten-Takt der Timer.
 * Ordner: RM_TRIGGER_DIR, sonst „trigger“ neben der Datenbank (DATABASE_FILE); ohne beides kein Auslöser.
 */
export const TRIGGER_JOBS=['import-nightly','backup','search-words','pdf-nightly','import','pdf-job'];

export function triggerDir(env=globalThis.process?.env||{}){
 if(env.RM_TRIGGER_DIR)return env.RM_TRIGGER_DIR;
 const db=env.DATABASE_FILE;
 return db&&db.includes('/')?db.slice(0,db.lastIndexOf('/')+1)+'trigger':'';
}

/** Laufenden Job sofort anhalten (Datei stop-<job>, ratsmonitor-stop-<job>.path hält den Dienst an) */
export const triggerStop=(id,env)=>triggerJob(id,env,'stop-');
/** Job sofort anstoßen; true, wenn die Auslöser-Datei geschrieben wurde. Fehler (kein Ordner, keine Rechte) zählen nicht:
    der Wunsch steht schon in der Datenbank, der Timer holt ihn spätestens nach 10 Minuten. */
export async function triggerJob(id,env,prefix=''){
 if(!TRIGGER_JOBS.includes(id))return false;
 const dir=triggerDir(env);
 if(!dir)return false;
 try{
  const fs=await import(/* @vite-ignore */ 'node:fs/promises');
  await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(`${dir}/${prefix}${id}`,new Date().toISOString()+'\n');
  return true;
 }catch{return false;}
}
