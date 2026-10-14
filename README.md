# La Poste parcels for Gladys Assistant

Track your **La Poste** parcels in [Gladys Assistant](https://gladysassistant.com): Colissimo, Chronopost and
tracked letters, through the official La Poste tracking API ("Suivi" v2, free key on
[developer.laposte.fr](https://developer.laposte.fr/products/suivi/latest)).

> **Developed without the hardware: feedback welcome.** Here, without an API key: the answers of the API were
> simulated from its documentation (see [`test/fixtures/laposte`](test/fixtures/laposte/README.md)). Please report
> on the [Gladys forum](https://community.gladysassistant.com/) or in the issues.

## What you get

- **Parcels added by number** (and an optional name), from the Configuration screen or from a scene. The scene action
  also finds the number in a whole text, such as the subject of a mail.
- **One device, "La Poste parcels"**: counters of parcels on the way, out for delivery, to pick up, with a problem,
  recently delivered, and a summary sentence.
- **Widget "My parcels"**: the parcels with a status badge, last event and date; a tap shows the details and the
  link to laposte.fr.
- **Scene triggers**: a parcel is out for delivery, delivered, awaits pickup, has a problem (with the parcel name,
  number, status, carrier, pickup point as variables).
- **Scene actions**: track a parcel; read my parcels (a sentence for a message or a speaker).
- Each parcel is read every 30 minutes (adjustable, 15 minutes at least), never again once delivered, and leaves the
  list 7 days after delivery (adjustable).

Requires **Gladys 5.1.0** or later and Internet access to `api.laposte.fr`.

## Installation

1. Create a free account on [developer.laposte.fr](https://developer.laposte.fr/), subscribe to the free plan of
   the **Suivi** API, and copy its key.
2. In Gladys, open **Integrations → Install from GitHub** and enter `https://github.com/guim31/gladys-laposte` (or
   install it from the catalog once it is listed).
3. In **Configuration**, paste the API key, then run **Add a parcel** for each parcel.
4. Open the **Discover** tab and press **Add to Gladys** for the "La Poste parcels" device.

The user guide is in [`docs/en.md`](docs/en.md) ([français](docs/fr.md), [Deutsch](docs/de.md),
[español](docs/es.md)); Gladys links it from the Configuration screen.

## How it works

```
Integration container ──HTTPS GET /suivi/v2/idships/{number} (X-Okapi-Key)──▶ api.laposte.fr
      │ SDK (WebSocket + host API)
      ▼
Gladys core
```

- One device for all the parcels: parcels live a few days, Gladys never deletes a device by itself, and one device
  per parcel would leave a dead device behind every delivery. The details of each parcel are in the widget, the
  trigger variables and the "Read my parcels" action.
- The device is published with `should_poll: false`: the container ticks every minute and reads only the parcels
  due, one second apart. A refused key stops the readings until it changes; a quota reached (429) pauses them for
  the `Retry-After` time (one hour otherwise), an outage for 10 minutes.
- Only the changed states are published, and all of them again every 12 hours.
- The parcels are kept in `/data/parcels.json`, with their last status, so a restart neither forgets them nor
  fires their triggers again.

## Limitations

- **Developed without the hardware**: see above. The event codes and the error answers follow the documentation.
- 50 parcels at most; La Poste parcels only (no DHL, UPS, Mondial Relay…).
- The free plan has a quota (10 requests per second as listed on developer.laposte.fr when written); the use of the
  API follows its terms of use.
- A number La Poste does not know after 30 days is removed.

## Development

Node.js 22+, ESM, no build step. The only runtime dependency is
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

```bash
npm install
npm test              # node --test: the SDK's fake Gladys and a simulated La Poste API
npm run lint
npm run format:check
npx github:GladysAssistant/integration-store --skip-image-check .   # store validator
```

```
index.js              SDK wiring (src/app.js registers the handlers)
src/app.js            handlers → tracker, configuration actions
src/tracker.js        parcels, reading pace, states, triggers, actions
src/laposte.js        La Poste API client (errors sorted by kind)
src/status.js         status of a parcel from its event codes, triggers
src/numbers.js        tracking number validation and extraction from a text
src/device.js         the Gladys device (features, names)
src/scenes.js         scene actions
src/widgets.js        dashboard widget
src/texts.js          texts sent from the container, four languages
src/store.js          /data persistence
src/config.js         configuration defaults and normalization
```

## Credits

- [debuss/LaPosteSuivi](https://github.com/debuss/LaPosteSuivi) (MIT): the mock answers of the API used as test
  fixtures.
- [e-amzallag/laposte-suivi-api](https://github.com/e-amzallag/laposte-suivi-api) (Apache 2.0): the list of the
  event codes and of the carriers.
- The Gladys 3 module [Florian56/gladys-colissimo](https://github.com/Florian56/gladys-colissimo) (2018) tracked
  Colissimo parcels before; nothing was reused from it.

## License

Apache 2.0, see [LICENSE](LICENSE). Not affiliated with La Poste. La Poste, Colissimo and Chronopost are trademarks
of their owners.
