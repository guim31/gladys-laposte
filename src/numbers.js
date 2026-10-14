// -----------------------------------------------------------------------------
// Tracking numbers. The API takes an identifier of 11 to 15 letters and digits
// (Colissimo 6A12345678901, international LA123456789FR, Chronopost
// XY123456789FR, tracked letters 1K…). Spaces, dots and dashes typed or copied
// from a mail are dropped. At least 8 digits: a word of the right length is not
// a tracking number.
// -----------------------------------------------------------------------------

const SHAPE = /^[A-Z0-9]{11,15}$/;

const isNumber = (value) => SHAPE.test(value) && (value.match(/\d/g) ?? []).length >= 8;

/** The tracking number typed by the user, normalized; null if invalid. */
export function normalizeNumber(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return null;
  }
  const value = String(raw)
    .toUpperCase()
    .replace(/[\s.-]/g, '');
  return isNumber(value) ? value : null;
}

/**
 * The first tracking number found in a text (the subject of a mail passed by a
 * scene, for example); null if there is none.
 */
export function extractNumber(text) {
  const whole = normalizeNumber(text);
  if (whole || typeof text !== 'string') {
    return whole;
  }
  return (
    text
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .find(isNumber) ?? null
  );
}
