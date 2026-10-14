'use strict';
(async function () {
  const byId = id => document.getElementById(id);
  let storage;
  try { storage = localStorage; } catch (_) { storage = null; }
  const i18n = SmokerI18n.create(PUSH_CATALOGS, storage, navigator.languages);
  let status = 'status.starting';
  function render() {
    document.documentElement.lang = i18n.locale;
    document.title = i18n.t('app.title');
    document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = i18n.t(node.dataset.i18n); });
    byId('status').textContent = i18n.t(status);
  }
  for (const locale of Object.keys(PUSH_CATALOGS)) {
    const option = document.createElement('option');
    option.value = locale;
    option.textContent = new Intl.DisplayNames([locale], { type: 'language' }).of(locale);
    byId('language').append(option);
  }
  byId('language').value = i18n.locale;
  byId('language').onchange = () => { i18n.change(byId('language').value); byId('output').value = ''; render(); };
  render();
  if (!isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    status = 'status.unsupported'; render(); return;
  }
  let registration;
  function update(subscription) {
    byId('export').disabled = !subscription;
    byId('unsubscribe').disabled = !subscription;
    byId('subscribe').disabled = !!subscription;
    byId('output').value = '';
  }
  try {
    await navigator.serviceWorker.register('./sw.js');
    registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    update(existing);
    status = existing ? 'status.existing' : 'status.ready';
  } catch (_) { status = 'status.failed'; render(); return; }
  render();
  byId('subscribe').onclick = async () => {
    byId('subscribe').disabled = true;
    try {
      const value = byId('key').value.trim();
      if (!/^[A-Za-z0-9_-]{87}$/.test(value)) throw new Error('Invalid public key');
      const key = Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='), char => char.charCodeAt(0));
      if (key[0] !== 4) throw new Error('Invalid public key');
      // Permission must be requested directly from this user gesture, before unrelated awaits.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { status = 'status.denied'; byId('subscribe').disabled = false; render(); return; }
      update(await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
      status = 'status.registered';
    } catch (_) { status = 'status.failed'; byId('subscribe').disabled = false; }
    render();
  };
  byId('export').onclick = async () => {
    try {
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription || !subscription.options.applicationServerKey) throw new Error('No subscription');
      const publicKey = btoa(String.fromCharCode(...new Uint8Array(subscription.options.applicationServerKey)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      byId('output').value = JSON.stringify({ version: 1, publicKey, locale: i18n.locale, subscription: subscription.toJSON() }, null, 2);
      status = 'status.exported';
    } catch (_) { status = 'status.failed'; }
    render();
  };
  byId('unsubscribe').onclick = async () => {
    try {
      const sub = await registration.pushManager.getSubscription();
      if (sub && !await sub.unsubscribe()) throw new Error('Unsubscribe failed');
      update(null); status = 'status.removed';
    } catch (_) { status = 'status.failed'; }
    render();
  };
})();
