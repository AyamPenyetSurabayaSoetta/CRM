const CACHE_NAME = 'database-aps-soetta-v1.3';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwMEmykWQdLjTOEvqwRpbNcoK9fXHrE6reNIBMrP27JajZ7A_X9Yj3mAsO0Fm5EiCBW/exec';
const URLS_TO_CACHE = [
  '/',
  'index.html', // Sesuaikan jika nama file HTML Anda berbeda, misal: index.html

  // File dari folder 'favicon'
  'favicon/site.webmanifest',
  'favicon/favicon.ico',
  'favicon/favicon.svg',
  'favicon/apple-touch-icon.png',
  'favicon/favicon-96x96.png',
  'favicon/web-app-manifest-192x192.png',
  'favicon/web-app-manifest-512x512.png',

  // File eksternal (CDN) yang digunakan aplikasi Anda
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache dibuka, menambahkan file inti aplikasi');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  if (requestUrl.href.startsWith(SCRIPT_URL)) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }


  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
