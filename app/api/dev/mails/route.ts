// Nur im Dev-Server (sonst 404): mails.
import {accountRoute} from '@/server/services/session';
import {devMails} from '@/server/accounts/dev.mjs';
export const dynamic='force-dynamic';
export const GET=accountRoute(devMails);
