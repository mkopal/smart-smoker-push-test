/* Owner-approved dependency-free catalog adapter using browser Intl plural rules. */
(function (root) {
  'use strict';
  const lookup = (catalog, key) => key.split('.').reduce((value, part) => value && value[part], catalog);
  function select(catalogs, stored, languages) {
    if (Object.prototype.hasOwnProperty.call(catalogs, stored)) return stored;
    for (const language of languages || []) {
      let normalized;
      try { normalized = Intl.getCanonicalLocales(language)[0]; } catch (_) { continue; }
      for (const candidate of [normalized, normalized.split('-')[0]]) {
        if (Object.prototype.hasOwnProperty.call(catalogs, candidate)) return candidate;
      }
    }
    return 'en';
  }
  function create(catalogs, storage, languages) {
    let stored;
    try { stored = storage.getItem('smart-smoker-language'); } catch (_) { /* Session selection remains usable. */ }
    let locale = select(catalogs, stored, languages);
    function t(key, args = {}) {
      let message = lookup(catalogs[locale], key) || lookup(catalogs.en, key);
      if (message && typeof message === 'object') {
        const category = new Intl.PluralRules(locale).select(args.count);
        message = message[category] || message.other;
      }
      if (typeof message !== 'string') message = catalogs.en.status.unavailable;
      return message.replace(/{{(\w+)}}/g, (_, name) => String(args[name] === undefined ? '' : args[name]));
    }
    return {
      t, get locale() { return locale; },
      change(value) {
        if (!Object.prototype.hasOwnProperty.call(catalogs, value)) return false;
        locale = value;
        try { storage.setItem('smart-smoker-language', value); } catch (_) { /* No backend required. */ }
        return true;
      },
      number(value, options = {}) { return new Intl.NumberFormat(locale, options).format(value); },
      date(value, timezone) { return new Intl.DateTimeFormat(locale, { timeZone: timezone, dateStyle: 'short' }).format(value); },
      unit(value, unit) { return new Intl.NumberFormat(locale, { style: 'unit', unit }).format(value); }
    };
  }
  const api = { select, create };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SmokerI18n = api;
})(typeof globalThis === 'object' ? globalThis : this);
