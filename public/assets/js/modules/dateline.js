/**
 * The masthead dateline and the copyright year.
 *
 * The issue number is the count of numbered sections actually printed on the
 * page, so it cannot drift out of step with the contents.
 */

const ROMAN = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function toRoman(value) {
  let remaining = Math.max(0, Math.floor(value));
  let out = '';

  for (const [amount, symbol] of ROMAN) {
    while (remaining >= amount) {
      out += symbol;
      remaining -= amount;
    }
  }

  return out || '—';
}

export function initDateline() {
  const today = new Date();

  const date = document.getElementById('dateline-date');
  if (date) {
    date.dateTime = today.toISOString().slice(0, 10);
    date.textContent = today.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  const issue = document.getElementById('dateline-issue');
  if (issue) issue.textContent = toRoman(document.querySelectorAll('.section[id]').length);

  const year = document.getElementById('year');
  if (year) year.textContent = String(today.getFullYear());
}
