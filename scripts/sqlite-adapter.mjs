/** D1-artiger Zugriff auf eine node:sqlite-Datenbank (Skripte und Tests). bind gibt wie D1 eine neue Anweisung zurück;
 *  dieselbe vorbereitete Anweisung lässt sich also mehrfach mit verschiedenen Werten binden. */
export function sqliteAdapter(sql){
 const statement=(query,args)=>({
  bind:(...values)=>statement(query,values),
  async first(){return sql.prepare(query).get(...args)||null;},
  async all(){return {results:sql.prepare(query).all(...args)};},
  async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};},
  execute(){const prepared=sql.prepare(query);return prepared.columns().length?{results:prepared.all(...args)}:{meta:{changes:Number(prepared.run(...args).changes)}};}
 });
 return {
  prepare:query=>statement(query,[]),
  async batch(statements){sql.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>s.execute());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}
 };
}
