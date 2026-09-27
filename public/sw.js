self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>event.waitUntil((async()=>{let d;try{const r=await fetch('/api/push/latest',{credentials:'include',cache:'no-store'});if(r.ok)d=await r.json()}catch{}await self.registration.showNotification(d?.title||'Neue Beschlüsse in Münster',{body:d?.shortSummary||'Es gibt eine neue Entscheidung. Öffne vor Ort, um mehr zu erfahren.',icon:'/favicon.svg',tag:d?.id||'new-decision',data:{url:d?.id?'/thema/'+encodeURIComponent(d.id):'/'}})})()));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.openWindow(new URL(event.notification.data?.url||'/',self.location.origin).href))});
