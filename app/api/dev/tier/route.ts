// Nur im Dev-Server (sonst 404): tier.
import {accountRoute} from '@/server/services/session';
import {devTier} from '@/server/accounts/dev.mjs';
export const dynamic='force-dynamic';
export const PATCH=accountRoute(devTier);
