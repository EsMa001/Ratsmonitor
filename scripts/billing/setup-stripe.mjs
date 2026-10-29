#!/usr/bin/env node
/**
 * Stripe im Testmodus lokal einrichten (docs/betrieb/stripe-test.md). Nur den Geheimschlüssel (sk_test_…) einfügen; das
 * Skript prüft ihn, legt bei Stripe die Produkte „Plenara Plus“ (2,99 € im Monat) und „Plenara Pro“ (19,99 € im Monat) und die
 * Einstellungen des Kundenportals an (Wechsel zwischen Plus und Pro), falls es sie noch nicht gibt, holt das Meldungsgeheimnis
 * von der Stripe CLI (bietet die Installation per winget an) und schreibt alles in .dev.vars (nicht in Git). Mehrfach
 * ausführbar: Vorhandenes bei Stripe wird wiederverwendet, das Kundenportal auf den Stand gebracht.
 *   node scripts/billing/setup-stripe.mjs
 * Nur Testschlüssel. Der Schlüssel erscheint nie vollständig in der Ausgabe.
 */
import readline from 'node:readline';
import {spawnSync} from 'node:child_process';
import {stripeApi} from '../../server/accounts/billing.mjs';
import {readVars,writeVars,stripeCli,mask} from './local.mjs';

/** Stufen zu buchen (shared/plans.mjs): fester Suchschlüssel des Preises bei Stripe, damit ein zweiter Lauf ihn wiederfindet */
const PLANS=[
 {tier:'plus',env:'STRIPE_PRICE_PLUS',lookup:'plenara_plus_monthly',name:'Plenara Plus',cents:299,nickname:'Plus monatlich',
  description:'Alle Treffer, plenara.X, 10 gespeicherte Suchen und Artikel, Wochenbericht, Kalender mit 5 Gebieten. Monatlich kündbar.'},
 {tier:'pro',env:'STRIPE_PRICE_PRO',lookup:'plenara_pro_monthly',name:'Plenara Pro',cents:1999,nickname:'Pro monatlich',
  description:'Alles unbegrenzt, Benachrichtigungen je Suche bis täglich. Monatlich kündbar.'},
];
const euro=cents=>(cents/100).toFixed(2).replace('.',',');

/** Frage im Terminal; hidden zeigt statt der Eingabe Sternchen */
function ask(question,{hidden=false}={}){
 return new Promise(resolve=>{
  const rl=readline.createInterface({input:process.stdin,output:process.stdout,terminal:!!process.stdin.isTTY});
  rl.question(question,answer=>{rl.close();if(hidden&&process.stdin.isTTY)process.stdout.write('\n');resolve(answer.trim());});
  if(hidden&&process.stdin.isTTY)rl._writeToOutput=text=>{if(!/^[\r\n]+$/.test(text))rl.output.write('*');};
 });
}
/** Abbruch mit Meldung; ohne process.exit, das unter Windows nach einem fetch mit einem Fehler von libuv endet */
class Stop extends Error{}
const fail=message=>{throw new Stop(message);};

async function main(){
 const vars=readVars();
 console.log('Stripe im Testmodus einrichten. Die Werte landen in .dev.vars (nicht in Git).\n');
 let key=process.env.STRIPE_SECRET_KEY||await ask(`Geheimschlüssel aus dem Stripe-Dashboard einfügen (sk_test_…)${vars.STRIPE_SECRET_KEY?`, Enter = vorhandenen behalten (${mask(vars.STRIPE_SECRET_KEY)})`:''}: `,{hidden:true});
 key=(key||vars.STRIPE_SECRET_KEY||'').trim();
 if(/^(sk|rk)_live_/.test(key))fail('Das ist ein Live-Schlüssel. Hier bitte nur den Testschlüssel (sk_test_…) einfügen.');
 if(!/^(sk|rk)_test_[A-Za-z0-9]+$/.test(key))fail('Kein gültiger Testschlüssel: Er beginnt mit sk_test_ (Stripe-Dashboard, Entwickler → API-Schlüssel).');
 const api=(method,path,params)=>stripeApi({billing:{secretKey:key}},method,path,params);

 // 1. Schlüssel prüfen
 let account;
 try{account=await api('GET','account');}catch(error){fail('Stripe lehnt den Schlüssel ab: '+error.message);}
 console.log(`✓ Schlüssel gilt für ${account.settings?.dashboard?.display_name||account.business_profile?.name||account.id} (Testmodus)`);

 // 2. Produkte und Preise je Stufe (monatlich, Endpreis mit Umsatzsteuer)
 const prices={};
 for(const plan of PLANS){
  let price=(await api('GET','prices',{lookup_keys:[plan.lookup],active:true,limit:1})).data?.[0];
  if(price)console.log(`✓ Preis ${plan.name} vorhanden: ${euro(price.unit_amount)} € je ${price.recurring?.interval==='month'?'Monat':price.recurring?.interval} (${price.id})`);
  else{
   const product=await api('POST','products',{name:plan.name,description:plan.description,metadata:{plenara:plan.tier}});
   price=await api('POST','prices',{product:product.id,currency:'eur',unit_amount:plan.cents,recurring:{interval:'month'},tax_behavior:'inclusive',lookup_key:plan.lookup,nickname:plan.nickname});
   await api('POST','products/'+product.id,{default_price:price.id});
   console.log(`✓ Produkt „${plan.name}“ mit Preis ${euro(plan.cents)} € im Monat angelegt (${price.id})`);
  }
  prices[plan.tier]=price;
 }

 // 3. Kundenportal: zwischen Plus und Pro wechseln (nach oben sofort mit Rechnung über den Unterschied, nach unten zum
 //    Periodenende), kündigen zum Periodenende, Zahlart ändern, Rechnungen, Name, Anschrift und Steuernummer
 const settings={
  business_profile:{headline:'Plenara-Abo verwalten'},
  features:{subscription_cancel:{enabled:true,mode:'at_period_end'},payment_method_update:{enabled:true},invoice_history:{enabled:true},
   customer_update:{enabled:true,allowed_updates:['name','address','tax_id']},
   subscription_update:{enabled:true,default_allowed_updates:['price'],proration_behavior:'always_invoice',
    products:PLANS.map(plan=>({product:typeof prices[plan.tier].product==='string'?prices[plan.tier].product:prices[plan.tier].product.id,prices:[prices[plan.tier].id]})),
    schedule_at_period_end:{conditions:[{type:'decreasing_item_amount'}]}}},
 };
 const configs=(await api('GET','billing_portal/configurations',{active:true,limit:100})).data||[];
 let portal=configs.find(c=>c.metadata?.plenara==='portal');
 if(portal){
  portal=await api('POST','billing_portal/configurations/'+portal.id,settings);
  console.log(`✓ Kundenportal auf den Stand gebracht: Plus und Pro wechseln, kündigen zum Periodenende, Zahlart, Rechnungen (${portal.id})`);
 }else{
  portal=await api('POST','billing_portal/configurations',{...settings,metadata:{plenara:'portal'}});
  console.log(`✓ Kundenportal eingerichtet: Plus und Pro wechseln, kündigen zum Periodenende, Zahlart, Rechnungen (${portal.id})`);
 }

 // 4. Meldungsgeheimnis von der Stripe CLI (mit diesem Schlüssel, wie später scripts/billing/listen.mjs)
 let cli=stripeCli();
 if(!cli&&process.platform==='win32'){
  const install=(await ask('Die Stripe CLI fehlt (sie leitet die Meldungen an den Dev-Server weiter). Jetzt per winget installieren? [j/N] ')).toLowerCase().startsWith('j');
  if(install&&spawnSync('winget',['install','--id','Stripe.StripeCli','-e','--accept-source-agreements','--accept-package-agreements'],{stdio:'inherit'}).status===0)cli=stripeCli();
 }
 let secret=null;
 if(cli){
  const run=spawnSync(cli,['listen','--print-secret'],{encoding:'utf8',timeout:60000,env:{...process.env,STRIPE_API_KEY:key}});
  secret=`${run.stdout||''}${run.stderr||''}`.match(/whsec_[A-Za-z0-9]+/)?.[0]??null;
  if(secret)console.log('✓ Meldungsgeheimnis von der Stripe CLI übernommen');
  else console.log('Die Stripe CLI hat kein Meldungsgeheimnis geliefert:',String(run.stderr||run.stdout||run.error?.message||'').trim().slice(0,200));
 }
 if(!secret){
  const typed=await ask(`Meldungsgeheimnis (whsec_…) einfügen${vars.STRIPE_WEBHOOK_SECRET?', Enter = vorhandenes behalten':', Enter = später'}: `,{hidden:true});
  secret=typed||vars.STRIPE_WEBHOOK_SECRET||null;
  if(secret&&!/^whsec_[A-Za-z0-9]+$/.test(secret))fail('Kein gültiges Meldungsgeheimnis: Es beginnt mit whsec_.');
 }

 writeVars({STRIPE_SECRET_KEY:key,STRIPE_PRICE_PLUS:prices.plus.id,STRIPE_PRICE_PRO:prices.pro.id,STRIPE_PORTAL_CONFIG:portal.id,STRIPE_LIVE:null,...(secret?{STRIPE_WEBHOOK_SECRET:secret}:{})});
 console.log(`\nIn .dev.vars eingetragen: STRIPE_SECRET_KEY=${mask(key)}, STRIPE_PRICE_PLUS=${prices.plus.id}, STRIPE_PRICE_PRO=${prices.pro.id}, STRIPE_PORTAL_CONFIG=${portal.id}${secret?', STRIPE_WEBHOOK_SECRET=whsec_…':''}`);
 console.log('\nWeiter:');
 console.log('1. Meldungen weiterleiten, in einem eigenen Terminal, das offen bleibt: node scripts/billing/listen.mjs');
 console.log('2. Dev-Server neu starten, damit er .dev.vars liest.');
 console.log('3. Als basic@plenara.test anmelden, /konto/buchen öffnen, Plus oder Pro buchen, Testkarte 4242 4242 4242 4242.');
 console.log('   Wechsel zwischen Plus und Pro danach unter /konto/profil, „Abo verwalten“.');
 if(!secret)console.log('\nOhne Meldungsgeheimnis bleibt die Bezahlung aus: Stripe CLI installieren und dieses Skript erneut starten.');
}

main().catch(error=>{
 console.error('\n'+(error instanceof Stop?error.message:'Abgebrochen: '+error.message));
 process.exitCode=1;
});
