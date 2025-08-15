/**
 * Service Worker for AI Code Editor
 * Provides offline support, caching, and performance optimizations
 */

const CACHE_NAME = 'ai-code-editor-v1.0.0';
const STATIC_CACHE = 'ai-code-editor-static-v1.0.0';
const RUNTIME_CACHE = 'ai-code-editor-runtime-v1.0.0';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png'
];

// API endpoints to cache with network-first strategy
const API_CACHE_PATTERNS = [
  /\/api\/performance/,
  /\/system\/status/,
  /\/health/
];

// Assets to cache with cache-first strategy
const ASSET_CACHE_PATTERNS = [
  /\.(?:js|css|woff|woff2|eot|ttf|otf)$/,
  /\/static\//
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== STATIC_CACHE && 
                     cacheName !== RUNTIME_CACHE &&
                     cacheName.startsWith('ai-code-editor-');
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Old caches cleaned up');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle different caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip requests from different origins (except API calls)
  if (url.origin !== location.origin && !url.pathname.startsWith('/api')) {
    return;
  }
  
  // Handle different types of requests
  if (API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    // API requests - Network first, cache fallback
    event.respondWith(networkFirstStrategy(request));
  } else if (ASSET_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    // Static assets - Cache first, network fallback
    event.respondWith(cacheFirstStrategy(request));
  } else if (url.pathname.startsWith('/api/')) {
    // Other API requests - Network only (no caching for sensitive data)
    event.respondWith(networkOnlyStrategy(request));
  } else {
    // HTML and other resources - Stale while revalidate
    event.respondWith(staleWhileRevalidateStrategy(request));
  }
});

// Network first strategy (for API calls that should be fresh)
async function networkFirstStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  try {
    // Try network first
    const networkResponse = await fetch(request.clone());
    
    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request.clone(), networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    // Fall back to cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for HTML requests
    if (request.headers.get('accept').includes('text/html')) {
      return new Response(`
        <html>
          <head><title>Offline</title></head>
          <body>
            <h1>You're offline</h1>
            <p>Please check your internet connection and try again.</p>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    // Return error response for other requests
    return new Response('Network error', {
      status: 408,
      statusText: 'Network timeout'
    });
  }
}

// Cache first strategy (for static assets that rarely change)
async function cacheFirstStrategy(request) {
  const cache = await caches.open(STATIC_CACHE);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Fall back to network
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Failed to fetch asset:', request.url, error);
    return new Response('Asset not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Network only strategy (for sensitive API calls)
async function networkOnlyStrategy(request) {
  try {
    return await fetch(request);
  } catch (error) {
    console.error('[SW] Network request failed:', request.url, error);
    return new Response('Network error', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Stale while revalidate strategy (for HTML and frequently changing content)
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  // Get cached response
  const cachedResponse = cache.match(request);
  
  // Fetch from network (in parallel)
  const networkResponsePromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((error) => {
      console.log('[SW] Network fetch failed:', request.url, error);
      return null;
    });
  
  // Return cached version immediately, or wait for network
  const cached = await cachedResponse;
  if (cached) {
    // Return cached version, network update happens in background
    networkResponsePromise.catch(() => {}); // Prevent unhandled rejection
    return cached;
  }
  
  // No cached version, wait for network
  const networkResponse = await networkResponsePromise;
  if (networkResponse) {
    return networkResponse;
  }
  
  // Both cache and network failed
  return new Response('Content not available', {
    status: 503,
    statusText: 'Service Unavailable'
  });
}

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Implement background sync logic here
  // For example, sync offline code changes, cache updates, etc.
  console.log('[SW] Performing background sync operations');
}

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    console.log('[SW] Push notification received:', data);
    
    const options = {
      body: data.body || 'New notification from AI Code Editor',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'ai-code-editor',
      data: data.data || {},
      actions: data.actions || []
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'AI Code Editor', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification);
  
  event.notification.close();
  
  // Handle notification action or open app
  const action = event.action;
  const data = event.notification.data;
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

console.log('[SW] Service Worker loaded and ready');