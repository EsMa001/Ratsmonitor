// Kundenprofile des Kunden-MCP über das Netz (docs/betrieb/claude-mcp-einbindung.md). Rechte kommen nur aus dieser
// Betreiberdatei (MCP_CUSTOMERS_FILE), nie aus einer Anfrage, einem Werkzeugaufruf oder der Kontendatei: Gebiete,
// Mengengrenze, Schlüssel (nur als SHA-256) und die Konten (nur IDs), die sich per OAuth für den Kunden anmelden dürfen.
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {CATALOG} from '../../shared/catalog.mjs';

const REGION_IDS=new Set(CATALOG.map(region=>region.id));
export const IDENTITY_RE=/^[a-z0-9][a-z0-9_.-]{1,62}$/;
export const USER_ID_RE=/^u_[A-Za-z0-9_-]{8,64}$/;
export const KEY_PREFIX='plk_';

const key=z.object({id:z.string().regex(/^k_[A-Za-z0-9_-]{6,40}$/),sha256:z.string().regex(/^[a-f0-9]{64}$/),
 created:z.string().max(40),note:z.string().max(200).optional()}).strict();
const customer=z.object({
 identity:z.string().regex(IDENTITY_RE),
 name:z.string().trim().min(1).max(120),
 allowedRegionIds:z.array(z.string().min(1).max(200)).min(1).max(2000),
 requestsPerMinute:z.number().int().min(1).max(300).default(60),
 accounts:z.array(z.string().regex(USER_ID_RE)).max(200).default([]),
 keys:z.array(key).max(20).default([]),
 disabled:z.boolean().default(false),
}).strict();
const fileSchema=z.object({version:z.literal(1),customers:z.array(customer).max(500)}).strict();

export class CustomersError extends Error {}

/** SHA-256 eines Schlüssels (hex); gespeichert wird nur dieser Wert */
export const keyHash=value=>createHash('sha256').update(String(value)).digest('hex');

/** Prüft den Inhalt der Datei; unbekannte Gebiete, doppelte Kennungen oder Schlüssel lehnen das Ganze ab */
export function parseCustomers(value){
 const checked=fileSchema.safeParse(value);
 if(!checked.success)throw new CustomersError('Die Kundendatei des MCP ist ungültig (Schema).');
 const seen=new Set(),hashes=new Set();
 for(const c of checked.data.customers){
  if(seen.has(c.identity))throw new CustomersError(`Kunde ${c.identity} steht doppelt in der Kundendatei.`);
  seen.add(c.identity);
  const unknown=c.allowedRegionIds.find(id=>!REGION_IDS.has(id));
  if(unknown)throw new CustomersError(`Kunde ${c.identity}: unbekanntes Gebiet ${unknown}.`);
  for(const k of c.keys){if(hashes.has(k.sha256))throw new CustomersError('Ein Schlüssel steht doppelt in der Kundendatei.');hashes.add(k.sha256);}
  c.allowedRegionIds=[...new Set(c.allowedRegionIds)];
  c.accounts=[...new Set(c.accounts)];
 }
 return checked.data;
}

/** Leere Datei für den Anfang */
export const emptyCustomers=()=>({version:1,customers:[]});

/**
 * Liest die Datei und liest sie neu, sobald sie sich ändert (Größe oder Zeit): Sperren, Entfernen und neue Gebiete gelten
 * ohne Neustart. Eine kaputte Datei sperrt alle Zugänge, statt auf einen alten Stand zurückzufallen.
 */
export function customerStore(file,{readFile=readFileSync,stat=statSync}={}){
 if(!file)throw new CustomersError('MCP_CUSTOMERS_FILE ist nicht gesetzt.');
 let stamp=null,data=null,error=null,byHash=new Map(),byIdentity=new Map();
 function current(){
  let s;
  try{s=stat(file);}catch{stamp=null;data=null;error=new CustomersError('Die Kundendatei des MCP fehlt.');return null;}
  const next=s.size+':'+s.mtimeMs;
  if(next===stamp)return error?null:data;
  stamp=next;
  try{
   if(s.size>1024*1024)throw new CustomersError('Die Kundendatei des MCP ist zu groß.');
   data=parseCustomers(JSON.parse(String(readFile(file,'utf8')).replace(/^﻿/,'')));
   byHash=new Map(data.customers.flatMap(c=>c.keys.map(k=>[k.sha256,{customer:c,keyId:k.id}])));
   byIdentity=new Map(data.customers.map(c=>[c.identity,c]));
   error=null;
  }catch(e){data=null;byHash=new Map();byIdentity=new Map();error=e instanceof CustomersError?e:new CustomersError('Die Kundendatei des MCP ist kein gültiges JSON.');}
  return error?null:data;
 }
 return {
  /** Fehler der Datei (für Protokoll und Gesundheitsweg), sonst null */
  problem(){current();return error?.message||null;},
  /** Kunde zu einem Schlüssel; gesperrte Kunden nie */
  byKey(value){if(!current())return null;const hit=byHash.get(keyHash(value));return hit&&!hit.customer.disabled?hit:null;},
  byIdentity(identity){if(!current())return null;const c=byIdentity.get(identity);return c&&!c.disabled?c:null;},
  /** Kunden, für die sich dieses Konto per OAuth anmelden darf */
  forAccount(userId){if(!current())return [];return data.customers.filter(c=>!c.disabled&&c.accounts.includes(userId));},
 };
}
