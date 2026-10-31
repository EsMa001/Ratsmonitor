declare namespace Cloudflare {interface Env{DB?:D1Database;BUCKET?:R2Bucket;AI_LOCAL_SOURCES?:(topic:unknown)=>Promise<unknown>;
 /* Dokumentindex der Dokumentsuche (server/node/doc-index.mjs, openDocReader): nur im Node-Betrieb */
 DOC_INDEX?:{ready():boolean;revision():string|null;all(sql:string,...args:unknown[]):Record<string,unknown>[];pages(sha:string):string[]|null};IMPORT_TOKEN?:string;ADMIN_SETUP_HASH?:string;
 /* Konten (requirements/konten-konzept.md): Kontendatei, Geheimnis, Zugang, Admin, Mailversand */
 ACCOUNTS?:D1Database;ACCOUNTS_HOOKS?:{logDeletion?:(entry:{userHash:string;emailHmac:string;at:string})=>Promise<void>;checkpoint?:()=>Promise<void>};ACCOUNTS_SECRET?:string;ACCOUNTS_IN_MAIN_DB?:string;ACCOUNTS_OPEN_SIGNUP?:string;
 RM_ACCESS?:string;SITE_URL?:string;ADMIN_HOSTS?:string;ADMIN_LEGACY_HEADER?:string;MAIL_TRANSPORT?:string;MAIL_API_URL?:string;MAIL_API_KEY?:string;MAIL_FROM?:string;MAIL_REPLY_TO?:string;OPERATOR_EMAIL?:string}}
