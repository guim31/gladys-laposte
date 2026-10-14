// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `parcels`, "My parcels".
//
// A card list of the tracked parcels, what needs the user first (out for
// delivery, to pick up, problem), then the others: name, last event and its
// date, a status badge; a tap opens the details (carrier, number, expected
// date, pickup point, history) with a link to the La Poste tracking page.
// Budget: one card list of 8 parcels at most, and two captions at most (the
// parcels not shown, a problem with the key or the API).
// The device box already shows the counts: the widget shows the parcels.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { TRACKING_PAGE } from './laposte.js';
import { carrierOf } from './status.js';
import { CONNECTION, ERRORS, pick, STATUS_LABELS, WIDGET_TEXT } from './texts.js';
import { WIDGET_KEY } from './tracker.js';

export const MAX_ITEMS = 8;
export const TTL_SECONDS = 300;
const MAX_SUBTITLE = 60;
const MAX_HISTORY = 6;

export const BADGE_COLORS = {
  pending: WIDGET_COLORS.NEUTRAL,
  unknown: WIDGET_COLORS.NEUTRAL,
  announced: WIDGET_COLORS.NEUTRAL,
  in_transit: WIDGET_COLORS.PRIMARY,
  out_for_delivery: WIDGET_COLORS.INFO,
  awaiting_pickup: WIDGET_COLORS.WARNING,
  problem: WIDGET_COLORS.DANGER,
  delivered: WIDGET_COLORS.SUCCESS,
  returned: WIDGET_COLORS.DANGER,
};

const truncate = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/** A date of the API in the user's language and the time zone of Gladys (TZ). */
export function formatDate(iso, language, withTime = false) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const options = withTime
    ? { dateStyle: 'short', timeStyle: 'short' }
    : { weekday: 'long', day: 'numeric', month: 'long' };
  return new Intl.DateTimeFormat(language, options).format(date);
}

function description(parcel, language) {
  const lines = [
    `${carrierOf(parcel.holder)} · ${pick(WIDGET_TEXT.number, language)} ${parcel.number}`,
  ];
  if (parcel.status === 'delivered' && parcel.deliveryDate) {
    lines.push(
      `${pick(WIDGET_TEXT.delivered_on, language)} ${formatDate(parcel.deliveryDate, language)}`,
    );
  } else if (parcel.estimatedDate && parcel.finalAt === null) {
    lines.push(
      `${pick(WIDGET_TEXT.expected, language)} ${formatDate(parcel.estimatedDate, language)}`,
    );
  }
  if (parcel.removalPoint) {
    const colon = language === 'fr' ? ' : ' : ': ';
    lines.push(`${pick(WIDGET_TEXT.pickup, language)}${colon}${parcel.removalPoint}`);
  }
  const history = parcel.events.slice(0, MAX_HISTORY);
  if (history.length > 0) {
    lines.push('', pick(WIDGET_TEXT.history, language));
    for (const event of history) {
      const when = event.date ? `${formatDate(event.date, language, true)} — ` : '';
      lines.push(`${when}${event.label || event.code}`);
    }
  }
  return truncate(lines.join('\n'), 2000);
}

/** One card of the list. */
export function cardOf(parcel, language) {
  const labels = pick(STATUS_LABELS, language);
  const item = {
    title: truncate(parcel.name, 60),
    badge: { text: labels[parcel.status] ?? labels.in_transit, color: BADGE_COLORS[parcel.status] },
    description: description(parcel, language),
    links: [
      {
        url: parcel.url ?? `${TRACKING_PAGE}${encodeURIComponent(parcel.number)}`,
        label: pick(WIDGET_TEXT.link, language),
      },
    ],
  };
  if (parcel.lastEvent?.label) {
    item.subtitle = truncate(parcel.lastEvent.label, MAX_SUBTITLE);
  }
  if (parcel.lastEvent?.date) {
    item.date = parcel.lastEvent.date;
  }
  return item;
}

/** What keeps the parcels from being read, if anything (one caption). */
function warning(tracker, language) {
  if (!tracker.config.apiKey) {
    return pick(CONNECTION.noKey, language);
  }
  if (tracker.keyRejected) {
    return pick(ERRORS, language).invalid_key;
  }
  return tracker.apiProblem ? pick(ERRORS, language)[tracker.apiProblem] : null;
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    async get(tracker, { language = 'en' } = {}) {
      const parcels = tracker.sortedParcels();
      if (parcels.length === 0) {
        return {
          ttl_seconds: TTL_SECONDS,
          components: [{ type: 'text', variant: 'body', text: pick(WIDGET_TEXT.empty, language) }],
        };
      }
      const components = [
        {
          type: 'card-list',
          display: 'list',
          items: parcels.slice(0, MAX_ITEMS).map((parcel) => cardOf(parcel, language)),
        },
      ];
      if (parcels.length > MAX_ITEMS) {
        const text = pick(WIDGET_TEXT.more, language).replace(
          '{count}',
          parcels.length - MAX_ITEMS,
        );
        components.push({ type: 'text', variant: 'caption', text });
      }
      const problem = warning(tracker, language);
      if (problem) {
        components.push({ type: 'text', variant: 'caption', text: truncate(problem, 80) });
      }
      return { ttl_seconds: TTL_SECONDS, components };
    },
  },
};
