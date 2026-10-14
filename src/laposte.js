// -----------------------------------------------------------------------------
// Client of the La Poste "Suivi" API v2 (Okapi portal, developer.laposte.fr):
// GET https://api.laposte.fr/suivi/v2/idships/{idShip}?lang=…, header
// X-Okapi-Key. One shipment per request.
//
// Errors are sorted into the few kinds the tracker acts on. Two body shapes
// exist: the API's own ({ returnCode, returnMessage }) and the Okapi
// gateway's ({ code, message }) for a missing or refused key and the quota.
// The key never leaves this module, and never appears in an error message.
// -----------------------------------------------------------------------------

export const API_URL = 'https://api.laposte.fr/suivi/v2/idships/';
export const TRACKING_PAGE = 'https://www.laposte.fr/outils/suivre-vos-envois?code=';

// Response languages the API accepts, by language of the integration.
export const API_LANGS = { en: 'en_GB', fr: 'fr_FR', de: 'de_DE', es: 'es_ES' };

export const TIMEOUT_MS = 15_000;

export const ERROR_KINDS = {
  INVALID_KEY: 'invalid_key',
  INVALID_NUMBER: 'invalid_number',
  NOT_FOUND: 'not_found',
  QUOTA: 'quota',
  UNAVAILABLE: 'unavailable',
};

export class LaPosteError extends Error {
  constructor(kind, { status = null, detail = '', retryAfterMs = null } = {}) {
    super(
      `La Poste API: ${kind}${status ? ` (HTTP ${status})` : ''}${detail ? `: ${detail}` : ''}`,
    );
    this.name = 'LaPosteError';
    this.kind = kind;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

const isoDate = (value) => {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const httpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

/** A shipment of the API, reduced to what the integration uses. */
export function parseShipment(shipment, number) {
  const idShip = typeof shipment.idShip === 'string' ? shipment.idShip : number;
  const events = (Array.isArray(shipment.event) ? shipment.event : [])
    .filter((event) => event && typeof event.code === 'string')
    .map((event) => ({
      code: event.code.toUpperCase(),
      label: typeof event.label === 'string' ? event.label.trim() : '',
      date: isoDate(event.date),
      order: Number.isFinite(event.order) ? event.order : 0,
    }))
    // Most recent first; the order breaks a tie between two events of the same
    // second (the API already sends them in this order).
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.order - a.order);
  const removalPoint = shipment.contextData?.removalPoint?.name;
  return {
    number: idShip,
    holder: Number.isInteger(shipment.holder) ? shipment.holder : null,
    product: typeof shipment.product === 'string' ? shipment.product : '',
    isFinal: shipment.isFinal === true,
    events,
    lastEvent: events[0] ?? null,
    estimatedDate: isoDate(shipment.estimDate),
    deliveryDate: isoDate(shipment.deliveryDate),
    url: httpsUrl(shipment.url) ?? `${TRACKING_PAGE}${encodeURIComponent(idShip)}`,
    removalPoint:
      typeof removalPoint === 'string' && removalPoint.trim() ? removalPoint.trim() : null,
  };
}

function retryAfter(response) {
  const seconds = Number(response.headers?.get?.('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

/**
 * Reads one shipment.
 * @param {string} number normalized tracking number
 * @param {object} options
 * @param {string} options.apiKey
 * @param {string} [options.language] en, fr, de or es
 * @param {Function} [options.fetch]
 * @returns {Promise<object>} see parseShipment
 * @throws {LaPosteError}
 */
export async function fetchShipment(
  number,
  { apiKey, language = 'fr', fetch = globalThis.fetch, timeoutMs = TIMEOUT_MS },
) {
  const url = `${API_URL}${encodeURIComponent(number)}?lang=${API_LANGS[language] ?? API_LANGS.fr}`;
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', 'X-Okapi-Key': apiKey },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new LaPosteError(ERROR_KINDS.UNAVAILABLE, { detail: err.cause?.code ?? err.name });
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    // An HTML error page of a proxy, or an empty body: the status decides.
  }
  const { status } = response;
  if (response.ok && body?.shipment && typeof body.shipment === 'object') {
    return parseShipment(body.shipment, number);
  }
  const detail = String(body?.returnMessage ?? body?.message ?? '').slice(0, 200);
  const returnCode = Number(body?.returnCode);
  if (status === 401 || status === 403) {
    throw new LaPosteError(ERROR_KINDS.INVALID_KEY, { status, detail });
  }
  if (status === 429) {
    throw new LaPosteError(ERROR_KINDS.QUOTA, {
      status,
      detail,
      retryAfterMs: retryAfter(response),
    });
  }
  if (status === 404 || returnCode === 104 || returnCode === 105) {
    throw new LaPosteError(ERROR_KINDS.NOT_FOUND, { status, detail });
  }
  if (status === 400) {
    throw new LaPosteError(ERROR_KINDS.INVALID_NUMBER, { status, detail });
  }
  throw new LaPosteError(ERROR_KINDS.UNAVAILABLE, { status, detail });
}
