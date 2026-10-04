import {NRW_SOURCES} from './source-catalog.mjs';
import {SOURCES} from './regions.mjs';
import recorded from './source-servers.json' with {type:'json'};
/**
 * Which sources share a server. Many council systems run under the municipality's own domain on one machine of the
 * vendor or of a municipal computing centre (ratsinfo.<town>.de), so the host name alone does not tell.
 *
 * Two hosts belong to the same server group if they share
 * - the registrable domain (one operator, e.g. *.sitzung-online.de, whatever its addresses), or
 * - the IP address recorded in source-servers.json (written by scripts/source-discovery/servers.mjs).
 * Groups are closed over both: a.example and b.example on one address and c.example on another address of b's operator
 * are one group. A host without a recorded address falls back to its registrable domain.
 */
export const MUENSTER={id:'muenster',system:'https://oparl.stadt-muenster.de/system'};
export const hostOf=source=>{try{return new URL(source.system||source.base).hostname;}catch{return null;}};
const domainOf=host=>host.split('.').slice(-2).join('.');
/**
 * hosts: host names; addresses: {host: IP or null}. Returns Map host → group name. A group of one operator is named
 * after its domain, a group of several domains after the address most of its hosts share.
 */
export function serverGroups(hosts,addresses){
 const parent=new Map(),find=x=>{while(parent.get(x)!==x){parent.set(x,parent.get(parent.get(x)));x=parent.get(x);}return x;};
 const join=(a,b)=>{for(const x of [a,b])if(!parent.has(x))parent.set(x,x);parent.set(find(a),find(b));};
 for(const host of hosts){join('host:'+host,'domain:'+domainOf(host));if(addresses[host])join('host:'+host,'ip:'+addresses[host]);}
 const members=new Map();for(const host of hosts){const root=find('host:'+host);members.set(root,[...(members.get(root)||[]),host]);}
 const groups=new Map();
 for(const list of members.values()){
  const domains=[...new Set(list.map(domainOf))].sort();
  let name=domains[0];
  if(domains.length>1){const count=new Map();for(const host of list)if(addresses[host])count.set(addresses[host],(count.get(addresses[host])||0)+1);name='ip:'+[...count].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0];}
  for(const host of list)groups.set(host,name);
 }
 return groups;
}
const known=[...new Set([...SOURCES,...NRW_SOURCES,MUENSTER].map(hostOf).filter(Boolean))];
const groups=serverGroups(known,recorded.hosts),byDomain=new Map(known.map(host=>[domainOf(host),groups.get(host)]));
/** Server group of an address; hosts outside the catalog share the group of their operator's domain. */
export function serverOf(url){
 let host;try{host=new URL(url).hostname;}catch{return null;}
 return groups.get(host)||byDomain.get(domainOf(host))||domainOf(host);
}
