import 'server-only';
import {env} from 'cloudflare:workers';
import {loadAdminData,adminReview} from '../integrations/admin-data.mjs';
import {adminTimeline} from '../integrations/admin-timeline.mjs';
import {adminEstimate} from '../integrations/admin-estimate.mjs';
import {adminKeywords} from '../integrations/admin-keywords.mjs';
import {readDebug} from '../integrations/import-trace.mjs';
import type {AdminDashboard} from '@/shared/admin-types';
// review:false leaves out the review list of page 2 (a scan of its own); its total is still reported.
export async function getAdminDashboard({review=true}:{review?:boolean}={}):Promise<AdminDashboard>{
 if(!env.DB)throw Error('Datenbank fehlt');
 return await loadAdminData(env.DB,{aiConfigured:!!env.OPENAI_API_KEY,pushConfigured:!!env.VAPID_PRIVATE_KEY&&!!env.VAPID_PUBLIC_KEY,review}) as unknown as AdminDashboard;
}
export async function getAdminReview(issue:string,region:string){if(!env.DB)throw Error('Datenbank fehlt');return adminReview(env.DB,issue,region);}
export async function getAdminTimeline(basis:string){if(!env.DB)throw Error('Datenbank fehlt');return adminTimeline(env.DB,{basis});}
export async function getAdminEstimate(){if(!env.DB)throw Error('Datenbank fehlt');return adminEstimate(env.DB);}
export async function getAdminKeywords(){if(!env.DB)throw Error('Datenbank fehlt');return adminKeywords(env.DB);}
export async function getRunDebug(region:string){if(!env.DB)throw Error('Datenbank fehlt');return readDebug(env.DB,region);}
