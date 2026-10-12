'use client';
import {AdminPageHead} from '@/components/admin-ui';
import {TodoPage} from '@/components/ratsmonitor/info/TodoPage';
/** Gemeinsame Aufgabenplanung: aktuelles Board und kategorisierter Backlog. */
export function AdminTodo(){
 return <>
  <AdminPageHead page="todo"/>
  <TodoPage embedded/>
 </>;
}
