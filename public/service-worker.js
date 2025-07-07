// service-worker.js

// اسم الكاش وإصداره. قم بتغيير الرقم عند تحديث أي من ملفات التطبيق الرئيسية لفرض التحديث.
const CACHE_NAME = 'sport-center-cache-v2';

// قائمة بالملفات الأساسية للتطبيق (App Shell) التي سيتم تخزينها
const APP_SHELL_URLS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/capacitor.js',
    '/manifest.json', // الملف الجديد الذي سنضيفه
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap',
    'https://cdn.tailwindcss.com'
];

const SUPABASE_API_HOST = 'uxtxavurcgdeueeemmdi.supabase.co';

// 1. عند تثبيت الـ Service Worker
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install');
    // انتظر حتى يتم تخزين كل ملفات App Shell
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching App Shell and key assets');
            // استخدام addAll يضمن أن العملية لن تكتمل إلا إذا نجح تحميل كل الموارد
            return cache.addAll(APP_SHELL_URLS).catch(error => {
                console.error('Failed to cache App Shell:', error);
            });
        })
    );
});

// 2. عند تفعيل الـ Service Worker (لتنظيف الكاش القديم)
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activate');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // إذا كان اسم الكاش لا يطابق الاسم الجديد، قم بحذفه
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// 3. عند اعتراض أي طلب شبكة (Fetch)
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // تجاهل طلبات غير GET تماماً
    if (event.request.method !== 'GET') {
        return;
    }

    // استراتيجية خاصة بطلبات Supabase API (Stale-While-Revalidate)
    // نعرض البيانات من الكاش فوراً، ثم نحدثها من الشبكة في الخلفية
    if (url.hostname === SUPABASE_API_HOST) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        // إذا نجح الطلب من الشبكة، نحدث الكاش
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    }).catch(err => {
                        // في حال فشل الشبكة، وكان هناك رد من الكاش، لا تفعل شيئاً
                        // هذا يمنع ظهور خطأ في الكونسول إذا كان المستخدم أوفلاين بالفعل
                        if (cachedResponse) return; 
                        console.error('[Service Worker] Fetch failed, no cache available:', err);
                    });
                    
                    // إذا وجدنا نسخة في الكاش، نرجعها فوراً، وإلا ننتظر الشبكة
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // استراتيجية للملفات الأخرى (Cache First)
    // نبحث في الكاش أولاً، إذا لم نجد الملف، نطلبه من الشبكة
    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) {
                return response; // إرجاع من الكاش
            }
            // إذا لم يكن في الكاش، اطلبه من الشبكة
            return fetch(event.request);
        })
    );
});
