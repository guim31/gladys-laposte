// -----------------------------------------------------------------------------
// Scene actions and the dashboard widget: what a scene and a dashboard get,
// checked against the content validator of the SDK (the rules of the core).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { MAX_ITEMS } from '../src/widgets.js';
import { addParcel, createWorld, fixture, NUMBERS } from './helpers/world.js';

async function world(t, options) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

test('"Track a parcel" takes the number out of a mail subject', async (t) => {
  const w = await world(t);
  const ack = await w.fake.sceneAction('track_parcel', {
    number: `Votre colis ${NUMBERS.outForDelivery} arrive aujourd'hui`,
    name: 'Shoes',
  });
  assert.deepEqual(ack.data.outputs, {
    number: NUMBERS.outForDelivery,
    name: 'Shoes',
    status: 'En livraison',
    added: 1,
  });
  // The trigger of the first reading: a scene can chain on it.
  assert.deepEqual(
    w.fake.sceneEvents.map((event) => event.key),
    ['parcel_out_for_delivery'],
  );
  const again = await w.fake.sceneAction('track_parcel', { number: NUMBERS.outForDelivery });
  assert.equal(again.data.outputs.added, 0);
  assert.equal(again.data.outputs.name, 'Shoes');
  assert.equal(w.fake.sceneEvents.length, 1, 'no loop: same status, no new trigger');
});

test('"Track a parcel" without a number fails the action only', async (t) => {
  const w = await world(t);
  const ack = await w.fake.sceneAction('track_parcel', { number: 'Your order has shipped' });
  assert.equal(ack.success, false);
  assert.match(ack.error, /not a tracking number/);
});

test('"Read my parcels" gives a sentence and the counts, in the configured language', async (t) => {
  const w = await world(t, { config: { language: 'de' } });
  let ack = await w.fake.sceneAction('read_parcels', {});
  assert.deepEqual(ack.data.outputs, {
    text: 'Keine Sendung unterwegs.',
    in_progress: 0,
    out_for_delivery: 0,
    awaiting_pickup: 0,
  });
  await addParcel(w, NUMBERS.inTransit, 'Buch');
  await addParcel(w, NUMBERS.outForDelivery, 'Schuhe');
  await addParcel(w, NUMBERS.delivered, 'Lampe');
  ack = await w.fake.sceneAction('read_parcels', {});
  assert.deepEqual(ack.data.outputs, {
    text: 'Du hast 2 Sendungen unterwegs: Schuhe, in Zustellung; Buch, unterwegs.',
    in_progress: 2,
    out_for_delivery: 1,
    awaiting_pickup: 0,
  });
});

const content = async (w, language = 'en') =>
  (await w.fake.widgetGet('parcels', { language })).data.content;

test('the widget without parcel says how to add one', async (t) => {
  const w = await world(t);
  const c = await content(w, 'fr');
  assert.deepEqual(validateWidgetContent(c), []);
  assert.match(c.components[0].text, /^Aucun colis suivi/);
});

test('the widget lists the parcels, what needs the user first, with details and link', async (t) => {
  const w = await world(t);
  await addParcel(w, NUMBERS.inTransit, 'Book');
  await addParcel(w, NUMBERS.awaitingPickup, 'Lamp');
  await addParcel(w, NUMBERS.delivered, 'Shoes');
  const c = await content(w, 'en');
  assert.deepEqual(validateWidgetContent(c), []);
  const [list] = c.components;
  assert.equal(list.type, 'card-list');
  assert.deepEqual(
    list.items.map((item) => [item.title, item.badge.text, item.badge.color]),
    [
      ['Lamp', 'To pick up', 'warning'],
      ['Book', 'In transit', 'primary'],
      ['Shoes', 'Delivered', 'success'],
    ],
  );
  const [lamp, , shoes] = list.items;
  assert.equal(lamp.subtitle, 'Votre colis est disponible dans votre point de retrait.');
  assert.equal(lamp.date, '2026-10-14T09:20:00.000Z');
  assert.match(
    lamp.description,
    /^Colissimo · Number 6A12345678903\nPickup point: BUREAU DE POSTE EXEMPLE\n/,
  );
  assert.match(lamp.description, /History\n10\/14\/26, 11:20 AM — Votre colis est disponible/);
  assert.deepEqual(lamp.links, [
    {
      url: `https://www.laposte.fr/outils/suivre-vos-envois?code=${NUMBERS.awaitingPickup}`,
      label: 'Track on laposte.fr',
    },
  ]);
  assert.match(shoes.description, /Delivered on Wednesday, October 14/);
});

test('the widget shows 8 parcels, counts the others, and tells a refused key', async (t) => {
  const w = await world(t);
  for (let i = 0; i < MAX_ITEMS + 3; i += 1) {
    await addParcel(w, `6A${String(i).padStart(11, '0')}`);
  }
  w.api.failAll = { status: 401, body: fixture('error-401-okapi') };
  await w.fake.action('refresh');
  const c = await content(w, 'es');
  assert.deepEqual(validateWidgetContent(c), []);
  assert.equal(c.components[0].items.length, MAX_ITEMS);
  assert.deepEqual(
    c.components.slice(1).map((component) => component.text),
    ['+ 3 más', 'La Poste rechaza la clave de API: compruébela en la configuración.'],
  );
});

test('the widget without parcel still tells a missing key', async (t) => {
  const w = await world(t, { config: { api_key: '' } });
  const c = await content(w, 'en');
  assert.deepEqual(validateWidgetContent(c), []);
  assert.equal(c.components[1].text.slice(0, 30), 'Enter your La Poste API key (f');
});
