const CACHE = 'conta-plus-v2'
const PRECACHE = ['/', '/manifest.webmanifest']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return
  if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/icon')) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      })
      .catch(() => caches.match(e.request).then(cached => cached ?? new Response('Offline', { status: 503 })))
  )
})

// Notificações push (base para futuras notificações de boletos)
self.addEventListener('push', e => {
  const data = e.data?.json() ?? { title: 'Conta+', body: 'Nova notificação' }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/api/icon?s=192',
      badge: '/api/icon?s=192',
      tag: data.tag ?? 'conta-plus',
      data: data.url ? { url: data.url } : undefined,
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  if (e.notification.data?.url) {
    e.waitUntil(clients.openWindow(e.notification.data.url))
  }
})
