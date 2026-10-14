// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Minutes between two readings of one parcel. 15 minutes is the floor: La Poste
// updates a parcel a few times a day, a faster pace only spends the quota.
export const CHECK_INTERVALS = ['15', '30', '60', '120', '240'];

// Days a delivered (or returned) parcel stays in the list before it is removed.
export const KEEP_DELIVERED_DAYS = ['1', '3', '7', '14', '30'];

export const DEFAULT_CONFIG = {
  api_key: '',
  check_interval: '30',
  keep_delivered: '7',
  language: 'fr',
};

const pick = (value, allowed, fallback) =>
  allowed.includes(String(value)) ? Number(value) : Number(fallback);

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    apiKey: typeof source.api_key === 'string' ? source.api_key.trim() : '',
    checkIntervalMs:
      pick(source.check_interval, CHECK_INTERVALS, DEFAULT_CONFIG.check_interval) * 60_000,
    keepDeliveredDays: pick(
      source.keep_delivered,
      KEEP_DELIVERED_DAYS,
      DEFAULT_CONFIG.keep_delivered,
    ),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
