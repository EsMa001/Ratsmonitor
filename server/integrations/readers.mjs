// Readers of council systems besides OParl, SessionNet, SD.NET, ALLRIS 4 and More! Rubin, by the adapter name of a
// catalog entry. collect-region.mjs reads a source with them; scripts/source-discovery/verify.mjs recognises them.
// detect(url, html, {get}) gives the fields of a catalog entry (base and what the reader needs besides) or null. Only
// KIC asks one more address (its public webconfig.json); all others decide from the page alone. councilservice is
// recognised on the municipality's website page that embeds it, not on a page of the system itself.
import {collectAllris3,detectAllris3} from './allris3.mjs';
import {collectKic,detectKic,kicShell} from './kic.mjs';
import {collectTiGenerator,detectTiGenerator,extraPages} from './ti-generator.mjs';
import {collectSessionNet6,detectSessionNet6} from './sessionnet6.mjs';
import {collectCronRatsinfo,detectCronRatsinfo} from './cron-ratsinfo.mjs';
import {collectMuenchenRisi,detectMuenchenRisi} from './muenchen-risi.mjs';
import {collectPiwi,detectPiwi} from './piwi.mjs';
import {collectPio,detectPio} from './pio.mjs';
import {collectCouncilservice,detectCouncilservice} from './councilservice.mjs';
import {collectRisPortal,detectRisPortal} from './ris-portal.mjs';
import {collectKomfa,detectKomfa} from './komfa.mjs';
import {collectParlis,detectParlis} from './parlis.mjs';
import {collectSimHannover,detectSimHannover} from './sim-hannover.mjs';
import {collectRim4,detectRim4} from './sdnet-rim4.mjs';
import {collectTypo3Bi,detectTypo3Bi} from './typo3-bi.mjs';
import {collectMeetingMobile,detectMeetingMobile} from './meeting-mobile.mjs';
import {collectHwTypo3,detectHw} from './hw-typo3.mjs';
import {collectEcics,detectEcics} from './ecics-ris.mjs';
import {collectProvoxIip,detectProvoxIip} from './provox-iip.mjs';
import {collectRisNg,detectRisNg} from './ris-ng.mjs';
import {collectHhDocuments,detectHhDocuments} from './hhdocuments.mjs';
import {collectRioSys,detectRioSys} from './rio-sys.mjs';
import {collectHitcomRis,detectHitcomRis} from './hitcom-ris.mjs';
import {collectWebcontactRatsinfo,detectWebcontactRatsinfo} from './webcontact-ratsinfo.mjs';
import {collectWebsite,fetchSiteText,fetchSiteBytes,WEBSITE_READER_NAME} from './website.mjs';
import {collectHamburgTransparenz,collectOparlDistricts,collectBerlin} from './citystates.mjs';
import {collectCkan,detectCkan} from './ckan.mjs';
// collect-region.mjs hands every reader the council-system fetch (sessionnet fetchText, wrapped by the trace of a
// metadata import). The website reader needs its own: fetchSiteText/fetchSiteBytes follow redirects by hand (with
// ROBOTS_POLICY=obey every target is checked against robots.txt) and accept the origins of alsoFrom. With a trace both are recorded, documents included.
function collectSite(source,options={}){
 const own={...options};delete own.get;delete own.getBytes;
 if(options.trace){own.get=options.trace.wrap(fetchSiteText);own.getBytes=options.trace.wrap(fetchSiteBytes);}
 return collectWebsite(source,own);
}
const pick=(found,keys)=>found?Object.fromEntries(keys.filter(k=>found[k]!==undefined&&found[k]!==null&&found[k]!=='').map(k=>[k,found[k]])):null;
export const READERS={
 // ALLRIS 3 (…/si010_e.asp …). The reader asks the system's own OParl address first, like the ALLRIS 4 reader.
 allris3:{name:'ALLRIS 3 (öffentliche Seiten)',collect:collectAllris3,detect:async(url,html)=>pick(detectAllris3(url,html),['base','calendar']),oparlCheck:true},
 // KIC Software (React app with a public guest API): the app's webconfig.json names the API and the organisation. The
 // systems of komuna (ris.komuna.net/<name>/, interface risapi1.komuna.net) are this app as well.
 kic:{name:'KIC-RIS (öffentliche Gast-Schnittstelle)',collect:collectKic,detect:async(url,html,{get}={})=>kicShell(url,html)?pick(await detectKic(url,html,get?{get}:{}),['base','api','client']):null},
 'ti-generator':{name:'TI-Generator (öffentliche Seiten)',collect:collectTiGenerator,detect:async(url,html)=>{const found=detectTiGenerator(url,html);return found&&(found.invitationLists>0||extraPages(html,{base:found.base}).length)?pick(found,['base']):null;}},
 sessionnet6:{name:'SessionNet 6 (öffentliche Schnittstelle)',collect:collectSessionNet6,detect:async(url,html)=>pick(detectSessionNet6(url,html),['base'])},
 'cron-ratsinfo':{name:'cron Ratsinfo für TYPO3 (öffentliche Seiten)',collect:collectCronRatsinfo,detect:async(url,html)=>pick(detectCronRatsinfo(url,html),['base','start'])},
 'muenchen-risi':{name:'RIS München (öffentliche Seiten)',collect:collectMuenchenRisi,detect:async(url,html)=>pick(detectMuenchenRisi(url,html),['base'])},
 piwi:{name:'PIWi Wiesbaden (öffentliche Seiten)',collect:collectPiwi,detect:async(url,html)=>pick(detectPiwi(url,html),['base'])},
 pio:{name:'PIO Offenbach (öffentliche Seiten)',collect:collectPio,detect:async(url,html)=>pick(detectPio(url,html),['base'])},
 // PARLIS Frankfurt am Main (own development of the city): lists of minutes and current agendas, each document under
 // its permanent name; the non-public part (/PARLIS2S/) is never requested.
 parlis:{name:'PARLIS Frankfurt (öffentliche Niederschriften und Tagesordnungen)',collect:collectParlis,detect:async(url,html)=>pick(detectParlis(url,html),['base'])},
 // SIM Hannover (Sitzungsmanagement of the city, Domino): lists of meetings per body, agenda pages and the papers with
 // their "Beratungsverlauf"; pages of items and minutes (confidential items) are never requested.
 'sim-hannover':{name:'SIM Hannover (öffentliches Sitzungsmanagement)',collect:collectSimHannover,detect:async(url,html)=>pick(detectSimHannover(url,html),['base'])},
 // SD.NET RIM 4 (newer web interface of SD.NET, /termine /tops /vorgang) hosted by the municipality itself: the iCalendar
 // of the meetings, the agenda of each and the process of its items. The hosts of ratsinfomanagement.net are not served.
 // TYPO3 Bürgerinformationssystem (extension risportal, /bi with /api/meetings/): month lists and the public agenda of each meeting.
 'typo3-bi':{name:'TYPO3-Bürgerinformationssystem (öffentliche Seiten)',collect:collectTypo3Bi,detect:async(url,html)=>pick(detectTypo3Bi(url,html),['base'])},
 // Meeting Mobile / RIS Web (Lotus Domino XPages, meeting-mobile.de/mm/<ort>/ris_web.nsf): the list of meetings and the public
 // block of each meeting page; no form or session needed. The non-public block is never read.
 'meeting-mobile':{name:'Meeting Mobile / RIS Web (öffentliche Seiten)',collect:collectMeetingMobile,detect:async(url,html)=>pick(detectMeetingMobile(url,html),['base'])},
 // Provox IIP (Bürger- und Ratsinformationssystem, ASP.NET, <host>/ris/<client>/) hosted by the municipality: the JSON feed
 // of the month calendar, the agenda of each meeting and the paper of its items. Only the block "Öffentlich" is read.
 'provox-iip':{name:'Provox IIP (öffentliche Seiten)',collect:collectProvoxIip,detect:async(url,html)=>pick(detectProvoxIip(url,html),['base'])},
 'sdnet-rim4':{name:'SD.NET RIM 4 (öffentliche Seiten)',collect:collectRim4,detect:async(url,html)=>pick(detectRim4(url,html),['base'])},
 // Ratsinformationsmodul (hwratssystem) of Hirsch & Wölfl in municipal TYPO3 websites (Baden-Württemberg): the month data of
 // the meeting calendar page with the public items of each meeting; the non-public items are never read.
 'hw-typo3':{name:'Ratsinformationsmodul Hirsch & Wölfl (öffentliche Seiten)',collect:collectHwTypo3,detect:async(url,html)=>pick(detectHw(url,html),['base'])},
 // Ratsinformationssystem of the municipal website system ecics (/ris?action=show_sitzungsliste, show_sitzung): the list of
 // meetings, the public agenda of each with its papers (PDF) and, where published, the minutes of the items.
 'ecics-ris':{name:'Gemeinde-RIS ecics (öffentliche Seiten)',collect:collectEcics,detect:async(url,html)=>pick(detectEcics(url,html),['base'])},
 // Small systems of single municipalities (public pages only, one reader each): "ris" (ratsinformationssystem.<name>.de/ris,
 // Baden-Württemberg), hhdocuments (Sitzungsplanung/Dokumentenwesen of a TYPO3 website: the papers and their meetings),
 // rio-sys (<name>.rio-sys.de) and the Rats-Info-System of hitcom (cEasy websites).
 'ris-ng':{name:'ris (öffentliche Seiten)',collect:collectRisNg,detect:async(url,html)=>pick(detectRisNg(url,html),['base'])},
 'hhdocuments':{name:'Sitzungsplanung hhdocuments (öffentliche Seiten)',collect:collectHhDocuments,detect:async(url,html)=>pick(detectHhDocuments(url,html),['base'])},
 'rio-sys':{name:'rio-sys (öffentliche Seiten)',collect:collectRioSys,detect:async(url,html)=>pick(detectRioSys(url,html),['base'])},
 'hitcom-ris':{name:'Rats-Info-System hitcom (öffentliche Seiten)',collect:collectHitcomRis,detect:async(url,html)=>pick(detectHitcomRis(url,html),['base'])},
 // Ratsinfo of the municipal website system of webcontact (Nuxt, Stadt Burgbernheim): the public JSON interface of the site
 // lists the meetings with the public agenda (Sitzungsbericht or öffentliche Einladung); the area for members is not requested.
 'webcontact-ratsinfo':{name:'Ratsinfo webcontact (öffentliche Schnittstelle der Website)',collect:collectWebcontactRatsinfo,detect:async(url,html)=>pick(detectWebcontactRatsinfo(url,html),['base','path'])},
 // RIS-Portal of comundus regisafe (<name>.ris-portal.de, Liferay): the month lists of its meeting portlet and the public
 // part of each meeting page. A shared system needs organizations (the bodies of the area) in its entry.
 'ris-portal':{name:'RIS-Portal regisafe (öffentliche Seiten)',collect:collectRisPortal,detect:async(url,html)=>pick(detectRisPortal(url,html),['base'])},
 // KOMFA-RIS of kommunalfabrik (ris-<name>.komfa.de): the month views of its calendar and the public part of each
 // agenda page. A system of an Amt names each meeting with its municipality; a member needs organizations.
 komfa:{name:'KOMFA-RIS (öffentliche Seiten)',collect:collectKomfa,detect:async(url,html)=>pick(detectKomfa(url,html),['base'])},
 // Sitzungsdienst of mein-intra.net embedded in the municipality's website: recognised from the website page that
 // embeds it (export script and token); the entry names the system, the token and that page.
 councilservice:{name:'Sitzungsdienst mein-intra (councilservice, öffentlicher Export der Website)',collect:collectCouncilservice,detect:async(url,html)=>pick(detectCouncilservice(url,html),['base','token','page'])},
 // Website of a municipality without council system (notices, minutes, feeds of its CMS). No page of a council system
 // is one, so verify.mjs never recognises it; only the website search (scripts/source-discovery/website.mjs) assigns it.
 // CKAN portal of open data (ckan.mjs), like OParl a generic interface: recognised from a page of the portal, read by
 // the query profile of its entry (ckan: {queries, committee}). Without a profile it reads nothing, and the check names
 // the area "API verfügbar, Leser/Connector fehlt" (shared/source-access.mjs).
 ckan:{name:'CKAN-Portal (offene Schnittstelle)',collect:collectCkan,detect:async(url,html)=>detectCkan(url,html)},
 website:{name:WEBSITE_READER_NAME,collect:collectSite,detect:async()=>null},
 // City states (citystates.mjs, entries in citystate-sources.json). Neither is recognised from a page.
 'hamburg-transparenz':{name:'Transparenzportal Hamburg (Drucksachen und Sitzungen der Bezirksversammlungen, Mitteilungen des Senats)',collect:collectHamburgTransparenz,detect:async()=>null},
 'oparl-bezirke':{name:'OParl der Bezirksverordnetenversammlungen (nur mit Freigabe)',collect:collectOparlDistricts,detect:async()=>null},
 berlin:{name:'Abgeordnetenhaus Berlin (Parlamentsdokumentation, offene Daten) und Bezirke mit Freigabe',collect:collectBerlin,detect:async()=>null},
};
