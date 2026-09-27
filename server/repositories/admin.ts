import 'server-only';
import {env} from 'cloudflare:workers';
import {loadAdminData,adminReview} from '../integrations/admin-data.mjs';
import type {AdminDashboard} from '@/shared/admin-types';
export async function getAdminDashboard():Promise<AdminDashboard>{
 if(!env.DB)throw Error('Datenbank fehlt');
 return await loadAdminData(env.DB,{aiConfigured:!!env.OPENAI_API_KEY,pushConfigured:!!env.VAPID_PRIVATE_KEY&&!!env.VAPID_PUBLIC_KEY}) as unknown as AdminDashboard;
}
export async function getAdminReview(issue:string,region:string){if(!env.DB)throw Error('Datenbank fehlt');return adminReview(env.DB,issue,region);}
