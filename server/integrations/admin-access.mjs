// Fehler und Herkunftsprüfung der Administration; wer Admin ist, prüft server/services/session.ts (Rolle am Konto).
export class AdminError extends Error{constructor(status,message){super(message);this.status=status;}}
export function requireSameOrigin(request){
 if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')throw new AdminError(403,'Diese Aktion muss direkt in der Administration gestartet werden.');
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new AdminError(415,'JSON-Anfrage erforderlich.');
}
