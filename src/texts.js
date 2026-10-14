// -----------------------------------------------------------------------------
// Every text the container produces, in the four languages of the Gladys
// interface (German says "du", Spanish "usted"). An integration of type device
// does not receive the user's language: the `language` of the configuration
// decides, except for the widget, which receives it.
// test/i18n.test.js checks that every table has the four languages and the
// same keys.
// -----------------------------------------------------------------------------

// Device and feature names, frozen at creation in Gladys.
export const NAMES = {
  en: {
    device: 'La Poste parcels',
    in_progress: 'Parcels on the way',
    out_for_delivery: 'Out for delivery',
    awaiting_pickup: 'To pick up',
    problems: 'Problems',
    delivered: 'Recently delivered',
    summary: 'Summary',
  },
  fr: {
    device: 'Colis La Poste',
    in_progress: 'Colis en cours',
    out_for_delivery: 'En cours de livraison',
    awaiting_pickup: 'À retirer',
    problems: 'Problèmes',
    delivered: 'Livrés récemment',
    summary: 'Résumé',
  },
  de: {
    device: 'La Poste Sendungen',
    in_progress: 'Sendungen unterwegs',
    out_for_delivery: 'In Zustellung',
    awaiting_pickup: 'Abholbereit',
    problems: 'Probleme',
    delivered: 'Kürzlich zugestellt',
    summary: 'Übersicht',
  },
  es: {
    device: 'Paquetes La Poste',
    in_progress: 'Paquetes en curso',
    out_for_delivery: 'En reparto',
    awaiting_pickup: 'Para recoger',
    problems: 'Problemas',
    delivered: 'Entregados recientemente',
    summary: 'Resumen',
  },
};

// Short status labels: widget badges (16 characters at most).
export const STATUS_LABELS = {
  en: {
    pending: 'Not read yet',
    unknown: 'Not found yet',
    announced: 'Announced',
    in_transit: 'In transit',
    out_for_delivery: 'Out for delivery',
    awaiting_pickup: 'To pick up',
    problem: 'Problem',
    delivered: 'Delivered',
    returned: 'Returned',
  },
  fr: {
    pending: 'Pas encore lu',
    unknown: 'Pas encore connu',
    announced: 'Annoncé',
    in_transit: 'En transit',
    out_for_delivery: 'En livraison',
    awaiting_pickup: 'À retirer',
    problem: 'Problème',
    delivered: 'Livré',
    returned: 'Retourné',
  },
  de: {
    pending: 'Nicht gelesen',
    unknown: 'Noch unbekannt',
    announced: 'Angekündigt',
    in_transit: 'Unterwegs',
    out_for_delivery: 'In Zustellung',
    awaiting_pickup: 'Abholbereit',
    problem: 'Problem',
    delivered: 'Zugestellt',
    returned: 'Zurückgesandt',
  },
  es: {
    pending: 'Aún sin leer',
    unknown: 'Aún desconocido',
    announced: 'Anunciado',
    in_transit: 'En tránsito',
    out_for_delivery: 'En reparto',
    awaiting_pickup: 'Para recoger',
    problem: 'Problema',
    delivered: 'Entregado',
    returned: 'Devuelto',
  },
};

// Status inside a sentence ("Shoes, out for delivery").
export const PHRASES = {
  en: {
    pending: 'not read yet',
    unknown: 'not known by La Poste yet',
    announced: 'announced by the sender',
    in_transit: 'in transit',
    out_for_delivery: 'out for delivery',
    awaiting_pickup: 'waiting to be picked up',
    problem: 'delayed by a problem',
    delivered: 'delivered',
    returned: 'returned to the sender',
  },
  fr: {
    pending: 'pas encore lu',
    unknown: 'pas encore connu de La Poste',
    announced: "annoncé par l'expéditeur",
    in_transit: 'en transit',
    out_for_delivery: 'en cours de livraison',
    awaiting_pickup: 'à retirer',
    problem: 'retardé par un problème',
    delivered: 'livré',
    returned: "retourné à l'expéditeur",
  },
  de: {
    pending: 'noch nicht gelesen',
    unknown: 'La Poste noch unbekannt',
    announced: 'vom Absender angekündigt',
    in_transit: 'unterwegs',
    out_for_delivery: 'in Zustellung',
    awaiting_pickup: 'abholbereit',
    problem: 'durch ein Problem verzögert',
    delivered: 'zugestellt',
    returned: 'an den Absender zurückgesandt',
  },
  es: {
    pending: 'aún sin leer',
    unknown: 'aún desconocido para La Poste',
    announced: 'anunciado por el remitente',
    in_transit: 'en tránsito',
    out_for_delivery: 'en reparto',
    awaiting_pickup: 'pendiente de recogida',
    problem: 'retrasado por un problema',
    delivered: 'entregado',
    returned: 'devuelto al remitente',
  },
};

// Sentences: the summary feature and the "Read my parcels" scene action.
export const SENTENCES = {
  en: {
    none: 'No parcel on the way.',
    intro: ({ count }) =>
      count === 1 ? 'You have 1 parcel on the way: ' : `You have ${count} parcels on the way: `,
    item: ({ name, phrase }) => `${name}, ${phrase}`,
    separator: '; ',
    end: '.',
  },
  fr: {
    none: 'Aucun colis en cours.',
    intro: ({ count }) =>
      count === 1 ? 'Vous avez 1 colis en cours : ' : `Vous avez ${count} colis en cours : `,
    item: ({ name, phrase }) => `${name}, ${phrase}`,
    separator: ' ; ',
    end: '.',
  },
  de: {
    none: 'Keine Sendung unterwegs.',
    intro: ({ count }) =>
      count === 1 ? 'Du hast 1 Sendung unterwegs: ' : `Du hast ${count} Sendungen unterwegs: `,
    item: ({ name, phrase }) => `${name}, ${phrase}`,
    separator: '; ',
    end: '.',
  },
  es: {
    none: 'Ningún paquete en curso.',
    intro: ({ count }) =>
      count === 1 ? 'Tiene 1 paquete en curso: ' : `Tiene ${count} paquetes en curso: `,
    item: ({ name, phrase }) => `${name}, ${phrase}`,
    separator: '; ',
    end: '.',
  },
};

// Answers of the configuration actions.
export const MESSAGES = {
  en: {
    added: ({ name, status }) => `${name} is now tracked (${status}).`,
    renamed: ({ name }) => `Already tracked: its name is now ${name}.`,
    invalidNumber: ({ value }) =>
      `"${value}" is not a tracking number: 11 to 15 letters and digits, e.g. 6A12345678901.`,
    tooMany: ({ max }) => `${max} parcels are tracked already: remove one first.`,
    removed: ({ name }) => `${name} is no longer tracked.`,
    notTracked: ({ value }) => `No tracked parcel is named "${value}" or has this number.`,
    noKey: 'Enter your La Poste API key in the configuration first.',
    refreshed: ({ count }) =>
      count === 1 ? '1 parcel read again.' : `${count} parcels read again.`,
    nothingToRefresh: 'No parcel on the way to read again.',
  },
  fr: {
    added: ({ name, status }) => `${name} est maintenant suivi (${status}).`,
    renamed: ({ name }) => `Déjà suivi : son nom est maintenant ${name}.`,
    invalidNumber: ({ value }) =>
      `« ${value} » n'est pas un numéro de suivi : 11 à 15 lettres et chiffres, ex. 6A12345678901.`,
    tooMany: ({ max }) => `${max} colis sont déjà suivis : retirez-en un d'abord.`,
    removed: ({ name }) => `${name} n'est plus suivi.`,
    notTracked: ({ value }) => `Aucun colis suivi ne s'appelle « ${value} » ni n'a ce numéro.`,
    noKey: "Saisissez d'abord votre clé d'API La Poste dans la configuration.",
    refreshed: ({ count }) => (count === 1 ? '1 colis relu.' : `${count} colis relus.`),
    nothingToRefresh: 'Aucun colis en cours à relire.',
  },
  de: {
    added: ({ name, status }) => `${name} wird jetzt verfolgt (${status}).`,
    renamed: ({ name }) => `Wird schon verfolgt: Der Name ist jetzt ${name}.`,
    invalidNumber: ({ value }) =>
      `„${value}“ ist keine Sendungsnummer: 11 bis 15 Buchstaben und Ziffern, z. B. 6A12345678901.`,
    tooMany: ({ max }) => `Es werden schon ${max} Sendungen verfolgt: Entferne zuerst eine.`,
    removed: ({ name }) => `${name} wird nicht mehr verfolgt.`,
    notTracked: ({ value }) => `Keine verfolgte Sendung heißt „${value}“ oder hat diese Nummer.`,
    noKey: 'Gib zuerst deinen La Poste API-Schlüssel in der Konfiguration ein.',
    refreshed: ({ count }) =>
      count === 1 ? '1 Sendung neu gelesen.' : `${count} Sendungen neu gelesen.`,
    nothingToRefresh: 'Keine Sendung unterwegs, die neu gelesen werden muss.',
  },
  es: {
    added: ({ name, status }) => `${name} ya está en seguimiento (${status}).`,
    renamed: ({ name }) => `Ya estaba en seguimiento: ahora se llama ${name}.`,
    invalidNumber: ({ value }) =>
      `«${value}» no es un número de seguimiento: de 11 a 15 letras y cifras, p. ej. 6A12345678901.`,
    tooMany: ({ max }) => `Ya se siguen ${max} paquetes: quite uno primero.`,
    removed: ({ name }) => `${name} ya no está en seguimiento.`,
    notTracked: ({ value }) =>
      `Ningún paquete en seguimiento se llama «${value}» ni tiene este número.`,
    noKey: 'Introduzca primero su clave de API de La Poste en la configuración.',
    refreshed: ({ count }) =>
      count === 1 ? '1 paquete leído de nuevo.' : `${count} paquetes leídos de nuevo.`,
    nothingToRefresh: 'Ningún paquete en curso que leer de nuevo.',
  },
};

// Why La Poste could not answer (configuration messages and widget).
export const ERRORS = {
  en: {
    invalid_key: 'La Poste refuses the API key: check it in the configuration.',
    quota: 'La Poste quota reached: the parcels will be read again later.',
    unavailable: 'La Poste does not answer for now: the parcels will be read again later.',
  },
  fr: {
    invalid_key: "La Poste refuse la clé d'API : vérifiez-la dans la configuration.",
    quota: 'Quota La Poste atteint : les colis seront relus plus tard.',
    unavailable: 'La Poste ne répond pas pour le moment : les colis seront relus plus tard.',
  },
  de: {
    invalid_key: 'La Poste lehnt den API-Schlüssel ab: Prüfe ihn in der Konfiguration.',
    quota: 'La Poste-Kontingent erreicht: Die Sendungen werden später neu gelesen.',
    unavailable: 'La Poste antwortet gerade nicht: Die Sendungen werden später neu gelesen.',
  },
  es: {
    invalid_key: 'La Poste rechaza la clave de API: compruébela en la configuración.',
    quota: 'Cuota de La Poste alcanzada: los paquetes se leerán de nuevo más tarde.',
    unavailable: 'La Poste no responde por ahora: los paquetes se leerán de nuevo más tarde.',
  },
};

// Connection status of the Configuration screen.
export const CONNECTION = {
  noKey: {
    en: 'Enter your La Poste API key (free, on developer.laposte.fr).',
    fr: "Saisissez votre clé d'API La Poste (gratuite, sur developer.laposte.fr).",
    de: 'Gib deinen La Poste API-Schlüssel ein (kostenlos, auf developer.laposte.fr).',
    es: 'Introduzca su clave de API de La Poste (gratuita, en developer.laposte.fr).',
  },
  invalidKey: {
    en: 'La Poste refuses the API key: check it, or create a new one on developer.laposte.fr.',
    fr: "La Poste refuse la clé d'API : vérifiez-la, ou créez-en une sur developer.laposte.fr.",
    de: 'La Poste lehnt den API-Schlüssel ab: Prüfe ihn oder erstelle einen neuen auf developer.laposte.fr.',
    es: 'La Poste rechaza la clave de API: compruébela o cree una nueva en developer.laposte.fr.',
  },
  initFailed: {
    en: 'The integration could not start: see its logs.',
    fr: "L'intégration n'a pas pu démarrer : consultez ses journaux.",
    de: 'Die Integration konnte nicht starten: Sieh dir ihre Protokolle an.',
    es: 'La integración no pudo iniciarse: consulte sus registros.',
  },
};

// Dashboard widget.
export const WIDGET_TEXT = {
  empty: {
    en: 'No parcel tracked: add one in the configuration of the La Poste integration, or from a scene.',
    fr: "Aucun colis suivi : ajoutez-en un dans la configuration de l'intégration La Poste, ou depuis une scène.",
    de: 'Keine Sendung verfolgt: Füge eine in der Konfiguration der Integration La Poste oder über eine Szene hinzu.',
    es: 'Ningún paquete en seguimiento: añada uno en la configuración de la integración La Poste o desde una escena.',
  },
  more: {
    en: '+ {count} more',
    fr: '+ {count} autres',
    de: '+ {count} weitere',
    es: '+ {count} más',
  },
  expected: {
    en: 'Expected on',
    fr: 'Livraison prévue le',
    de: 'Erwartet am',
    es: 'Entrega prevista el',
  },
  delivered_on: {
    en: 'Delivered on',
    fr: 'Livré le',
    de: 'Zugestellt am',
    es: 'Entregado el',
  },
  number: { en: 'Number', fr: 'Numéro', de: 'Nummer', es: 'Número' },
  pickup: {
    en: 'Pickup point',
    fr: 'Point de retrait',
    de: 'Abholstelle',
    es: 'Punto de recogida',
  },
  history: { en: 'History', fr: 'Historique', de: 'Verlauf', es: 'Historial' },
  link: {
    en: 'Track on laposte.fr',
    fr: 'Suivre sur laposte.fr',
    de: 'Auf laposte.fr verfolgen',
    es: 'Seguir en laposte.fr',
  },
};

/** The text of a multi-language object or table in one language (English fallback). */
export const pick = (table, language) => table[language] ?? table.en;
