'use client';
import {AdminPageHead} from '@/components/admin-ui';
import {TodoPage} from '@/components/ratsmonitor/info/TodoPage';
/** Admin page "To-do-Liste": alles, was vor dem Start noch zu tun ist (Daten docs/todo/todos.json, nur im lokalen Dev-Server speicherbar). */
export function AdminTodo(){
 return <>
  <AdminPageHead page="todo"/>
  <TodoPage embedded/>
 </>;
}
