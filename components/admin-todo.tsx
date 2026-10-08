'use client';
import {AdminHeader} from '@/components/admin-chrome';
import {TodoPage} from '@/components/ratsmonitor/info/TodoPage';
/** Admin page "To-do-Liste": alles, was vor dem Start noch zu tun ist (Daten docs/todo/todos.json, nur im lokalen Dev-Server speicherbar). */
export function AdminTodo({displayName,signOutPath}:{displayName:string;signOutPath:string}){
 return <div className="admin-app"><AdminHeader page="todo" displayName={displayName} signOutPath={signOutPath}/><main id="inhalt" className="admin-shell admin-workspace">
  <div className="admin-heading"><div><p className="eyebrow">INTERN</p><h1>To-do-Liste.</h1><p>Alles, was vor dem Start noch zu tun ist. Abhaken, Termin eintragen und speichern; erledigte Einträge bleiben in der Liste.</p></div></div>
  <TodoPage embedded/>
 </main></div>;
}
