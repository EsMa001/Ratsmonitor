import{env}from'cloudflare:workers';export async function GET(){return Response.json({publicKey:env.VAPID_PRIVATE_KEY?env.VAPID_PUBLIC_KEY||'':''},{headers:{'Cache-Control':'no-store'}})}
