'use strict';
importScripts('./i18n.js', './catalogs.js');

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let data = {};
    try { data = event.data.json(); } catch (_) { /* Always show a visible fallback. */ }
    if (!data || typeof data !== 'object') data = {};
    const i18n = SmokerI18n.create(PUSH_CATALOGS, null, [typeof data.locale === 'string' ? data.locale : 'en']);
    const valid = data.event === 'test' && typeof data.id === 'string' && /^[a-f0-9]{24}$/.test(data.id) &&
      Number.isFinite(data.sentAt) && Math.abs(data.sentAt) <= 8640000000000000;
    const title = i18n.t('notification.title');
    const body = valid ? i18n.t('notification.body', { id: data.id,
      time: new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'short', timeStyle: 'medium' }).format(data.sentAt) }) : i18n.t('notification.fallback');
    await self.registration.showNotification(title, { body,
      tag: valid ? data.id : 'invalid-test', icon: './icon-192.png' });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = self.registration.scope;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const existing = clients.find(client => client.url.startsWith(target));
    if (existing) return existing.focus();
    return self.clients.openWindow(target);
  }));
});
// No pushsubscriptionchange upload: re-open enrollment, export again and replace the private file.
