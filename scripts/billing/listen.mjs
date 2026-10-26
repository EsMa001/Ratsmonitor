#!/usr/bin/env node
/**
 * Meldungen von Stripe an den lokalen Dev-Server weiterleiten (docs/betrieb/stripe-test.md). Nimmt den Schlüssel aus
 * .dev.vars, damit das Meldungsgeheimnis zu dem passt, das scripts/billing/setup-stripe.mjs eingetragen hat; ohne
 * `stripe login`. Läuft, bis es mit Strg+C beendet wird.
 *   node scripts/billing/listen.mjs [--port 5173]
 */
import {spawn} from 'node:child_process';
import {EVENTS} from '../../server/accounts/billing.mjs';
import {readVars,stripeCli} from './local.mjs';

const at=process.argv.indexOf('--port');
const port=at>0?process.argv[at+1]:'5173';
const key=readVars().STRIPE_SECRET_KEY;
if(!key){console.error('In .dev.vars fehlt STRIPE_SECRET_KEY. Zuerst: node scripts/billing/setup-stripe.mjs');process.exit(1);}
const cli=stripeCli();
if(!cli){console.error('Stripe CLI nicht gefunden. Installieren: winget install --id Stripe.StripeCli -e');process.exit(1);}
const target=`http://localhost:${port}/api/billing/webhook`;
console.log(`Meldungen von Stripe gehen an ${target}. Beenden mit Strg+C.`);
const child=spawn(cli,['listen','--forward-to',target,'--events',EVENTS.join(',')],{stdio:'inherit',env:{...process.env,STRIPE_API_KEY:key}});
child.on('exit',code=>process.exit(code??0));
