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
/**
 * Whether a rule of robots.txt covers a path: the rule is a prefix with '*' for any run of characters and a final '$'
 * for the end of the path. Matched position by position (the table of the classic wildcard match), never with a
 * regular expression: several stars in a foreign rule would make that exponential.
 */
export function robotsPathMatches(rule,text){
 // Rule and path both by code points, so characters beyond the BMP compare as one.
 const anchored=rule.endsWith('$'),p=anchored?rule.slice(0,-1):rule,path=Array.from(text);
 // reach[j]: the rule up to here can cover the first j characters of the path.
 let reach=new Uint8Array(path.length+1);reach[0]=1;
 for(const ch of p){
  const next=new Uint8Array(path.length+1);
  if(ch==='*'){let any=0;for(let j=0;j<=path.length;j++){any=any||reach[j];next[j]=any?1:0;}}
  else for(let j=1;j<=path.length;j++)next[j]=reach[j-1]&&path[j-1]===ch?1:0;
  reach=next;
 }
 return anchored?reach[path.length]===1:reach.some(v=>v===1);
}
/** tokens: product tokens of our programs in lower case, e.g. ['vorort-politicaltopics']. */
export function robotsAllow(groups,path,tokens){
 const own=groups.filter(g=>g.agents.some(a=>a!=='*'&&tokens.some(t=>t===a||t.startsWith(a))));
 const rules=(own.length?own:groups.filter(g=>g.agents.includes('*'))).flatMap(g=>g.rules);
 let best=null;
 for(const r of rules)if(robotsPathMatches(r.path,path)&&(!best||r.path.length>best.path.length||(r.path.length===best.path.length&&r.allow)))best=r;
 return best?best.allow:true;
}
/** Verdict for one path from the answer to /robots.txt: 'erlaubt', 'verboten', 'keine' (no robots.txt) or 'unklar'. */
export function robotsVerdict(status,text,path,tokens){
 if(!status||status>=500)return 'unklar';
 if(status>=400)return 'keine';
 return robotsAllow(parseRobots(text),path,tokens)?'erlaubt':'verboten';
}
