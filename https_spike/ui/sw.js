/* No fetch interception, cache, subscription, push handling or outbound traffic. */
self.addEventListener('install', () => self.skipWaiting());
