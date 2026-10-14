// -----------------------------------------------------------------------------
// The La Poste API client and the tracking numbers, on the fixtures (see
// fixtures/laposte/README.md): parsing, status of each event code, every
// documented error, and the key that never shows in an error.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ERROR_KINDS, fetchShipment, LaPosteError, parseShipment } from '../src/laposte.js';
import { extractNumber, normalizeNumber } from '../src/numbers.js';
import { carrierOf, statusOf } from '../src/status.js';
import { createApi, fixture, KEY, NUMBERS } from './helpers/world.js';

const read = (number, options = {}) =>
  fetchShipment(number, { apiKey: KEY, fetch: createApi().fetch, ...options });

test('a shipment is parsed: events most recent first, dates in ISO, link', () => {
  const shipment = parseShipment(fixture('in-transit').shipment, NUMBERS.inTransit);
  assert.equal(shipment.number, NUMBERS.inTransit);
  assert.equal(shipment.holder, 4);
  assert.equal(shipment.isFinal, false);
  assert.deepEqual(
    shipment.events.map((event) => event.code),
    ['ET1', 'DR1'],
  );
  assert.equal(shipment.lastEvent.date, '2020-07-03T23:25:12.000Z');
  assert.equal(shipment.estimatedDate, '2023-01-26T23:00:00.000Z');
  assert.equal(
    shipment.url,
    `https://www.laposte.fr/outils/suivre-vos-envois?code=${NUMBERS.inTransit}`,
  );
  assert.equal(carrierOf(shipment.holder), 'Colissimo');
});

test('events in any order are sorted by date', () => {
  const raw = structuredClone(fixture('out-for-delivery').shipment);
  raw.event.reverse();
  assert.equal(parseShipment(raw, 'x').lastEvent.code, 'MD2');
});

test('each fixture has its status', async () => {
  const expected = {
    [NUMBERS.inTransit]: 'in_transit',
    [NUMBERS.outForDelivery]: 'out_for_delivery',
    [NUMBERS.awaitingPickup]: 'awaiting_pickup',
    [NUMBERS.delivered]: 'delivered',
    [NUMBERS.problem]: 'problem',
    [NUMBERS.chronopost]: 'delivered',
  };
  for (const [number, status] of Object.entries(expected)) {
    assert.equal(statusOf(await read(number)), status, number);
  }
  const pickup = await read(NUMBERS.awaitingPickup);
  assert.equal(pickup.removalPoint, 'BUREAU DE POSTE EXEMPLE');
  const delivered = await read(NUMBERS.delivered);
  assert.equal(delivered.isFinal, true);
  assert.equal(delivered.deliveryDate, '2026-10-14T10:31:09.000Z');
  assert.equal(carrierOf((await read(NUMBERS.chronopost)).holder), 'Chronopost');
});

test('the event codes of the documentation map to their status', () => {
  const status = (code, isFinal = false) =>
    statusOf({ lastEvent: code ? { code } : null, isFinal });
  assert.equal(status('DR1'), 'announced');
  for (const code of [
    'PC1',
    'PC2',
    'ET1',
    'ET2',
    'ET3',
    'ET4',
    'EP1',
    'DO1',
    'DO2',
    'PB2',
    'XX9',
  ]) {
    assert.equal(status(code), 'in_transit', code);
  }
  assert.equal(status('MD2'), 'out_for_delivery');
  assert.equal(status('AG1'), 'awaiting_pickup');
  for (const code of ['PB1', 'ND1', 'RE1', 'DO3']) {
    assert.equal(status(code), 'problem', code);
  }
  assert.equal(status('DI1'), 'delivered');
  assert.equal(status('DI3'), 'delivered');
  assert.equal(status('DI2'), 'returned');
  assert.equal(status('XX9', true), 'delivered');
  assert.equal(status(null), 'unknown');
});

test('the request: URL, language, key header', async () => {
  const api = createApi();
  await fetchShipment(NUMBERS.inTransit, { apiKey: KEY, language: 'de', fetch: api.fetch });
  const [request] = api.requests;
  assert.equal(
    request.url,
    `https://api.laposte.fr/suivi/v2/idships/${NUMBERS.inTransit}?lang=de_DE`,
  );
  assert.equal(request.headers['X-Okapi-Key'], KEY);
  assert.equal(request.headers.Accept, 'application/json');
});

test('every documented error has its kind, and never carries the key', async () => {
  const cases = [
    ['error-400', 400, ERROR_KINDS.INVALID_NUMBER],
    ['error-401-api', 401, ERROR_KINDS.INVALID_KEY],
    ['error-401-okapi', 401, ERROR_KINDS.INVALID_KEY],
    ['error-404', 404, ERROR_KINDS.NOT_FOUND],
    ['error-429', 429, ERROR_KINDS.QUOTA],
    ['error-500', 500, ERROR_KINDS.UNAVAILABLE],
    ['error-503', 503, ERROR_KINDS.UNAVAILABLE],
    ['error-504', 504, ERROR_KINDS.UNAVAILABLE],
  ];
  for (const [name, status, kind] of cases) {
    const api = createApi();
    api.failAll = { status, body: fixture(name) };
    await assert.rejects(read(NUMBERS.inTransit, { fetch: api.fetch }), (err) => {
      assert.ok(err instanceof LaPosteError, name);
      assert.equal(err.kind, kind, name);
      assert.equal(err.status, status, name);
      assert.doesNotMatch(err.message, new RegExp(KEY), name);
      return true;
    });
  }
});

test('a 429 honors Retry-After; an HTML page or a network error is "unavailable"', async () => {
  const api = createApi();
  api.failAll = { status: 429, body: fixture('error-429'), headers: { 'Retry-After': '120' } };
  await assert.rejects(read(NUMBERS.inTransit, { fetch: api.fetch }), { retryAfterMs: 120_000 });
  api.failAll = { status: 502 };
  await assert.rejects(read(NUMBERS.inTransit, { fetch: api.fetch }), { kind: 'unavailable' });
  api.failAll = null;
  api.throwAll = new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
  await assert.rejects(read(NUMBERS.inTransit, { fetch: api.fetch }), (err) => {
    assert.equal(err.kind, 'unavailable');
    assert.match(err.message, /ENOTFOUND/);
    return true;
  });
});

test('tracking numbers: normalized, validated, found in a text', () => {
  assert.equal(normalizeNumber(' 6a 1234 5678 901 '), '6A12345678901');
  assert.equal(normalizeNumber('la-123.456.789-fr'), 'LA123456789FR');
  assert.equal(normalizeNumber('XY123456789FR'), 'XY123456789FR');
  for (const bad of [
    '',
    'abc',
    '6A1234',
    '6A1234567890123456',
    'ABCDEFGHIJKLM',
    '6A12345678901!',
    null,
    {},
  ]) {
    assert.equal(normalizeNumber(bad), null, String(bad));
  }
  assert.equal(
    extractNumber('Votre colis 6A12345678901 est en cours de livraison'),
    '6A12345678901',
  );
  assert.equal(extractNumber('Suivi : LA123456789FR (lettre suivie)'), 'LA123456789FR');
  assert.equal(extractNumber('6A 1234 5678 901'), '6A12345678901');
  assert.equal(extractNumber('Commande 2026-10-14 expédiée'), null);
  assert.equal(extractNumber(undefined), null);
});
