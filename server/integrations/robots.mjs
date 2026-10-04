/**
 * robots.txt after RFC 9309, for the question whether a council system asks programs not to read a path.
 * - The group of the most specific matching product token applies, otherwise the group of "*".
 * - Of the rules of that group the longest matching path wins; on a tie Allow wins. "*" matches any characters,
 *   a trailing "$" the end of the path. An empty Disallow forbids nothing.
 * - Without robots.txt (HTTP 4xx) everything is allowed; an answer with 5xx or none at all means: not known.
 */
export function parseRobots(text){
 const groups=[];let group=null,agents=false;
 for(const raw of String(text||'').split(/\r?\n/)){
  const line=raw.replace(/#.*$/,'').trim();if(!line)continue;
  const m=line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);if(!m)continue;
  const key=m[1].toLowerCase(),value=m[2].trim();
  if(key==='user-agent'){if(!agents){group={agents:[],rules:[]};groups.push(group);}group.agents.push(value.toLowerCase());agents=true;continue;}
  agents=false;
  if(group&&(key==='allow'||key==='disallow')&&value)group.rules.push({allow:key==='allow',path:value});
 }
 return groups;
}
const pattern=path=>new RegExp('^'+path.replace(/[.+?^{}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\$$/,'$'));
/** tokens: product tokens of our programs in lower case, e.g. ['vorort-politicaltopics']. */
export function robotsAllow(groups,path,tokens){
 const own=groups.filter(g=>g.agents.some(a=>a!=='*'&&tokens.some(t=>t===a||t.startsWith(a))));
 const rules=(own.length?own:groups.filter(g=>g.agents.includes('*'))).flatMap(g=>g.rules);
 let best=null;
 for(const r of rules)if(pattern(r.path).test(path)&&(!best||r.path.length>best.path.length||(r.path.length===best.path.length&&r.allow)))best=r;
 return best?best.allow:true;
}
/** Verdict for one path from the answer to /robots.txt: 'erlaubt', 'verboten', 'keine' (no robots.txt) or 'unklar'. */
export function robotsVerdict(status,text,path,tokens){
 if(!status||status>=500)return 'unklar';
 if(status>=400)return 'keine';
 return robotsAllow(parseRobots(text),path,tokens)?'erlaubt':'verboten';
}
