// Membership cards (fork change): what a card says besides its code.
//
//   S.gymCards[] = { id, label, value, fmt, color?, from?, until? }
//
// `color` is one of the app's accents (lib/format.js ACCENTS); `from` and `until` are ISO dates
// of the membership. A visit is a day with a logged workout, so the card counts by itself: no
// tapping in at the turnstile, and two workouts on one day are one visit. How many visits the
// membership allows is not asked: the owner does not need it.

import { ACCENTS, isoOf } from './format.js'

export const CARD_COLORS = Object.keys(ACCENTS)

const DAY_MS = 86400000
const dayNumber = iso => Math.round(Date.parse(iso + 'T12:00:00') / DAY_MS)
const monthStart = today => today.slice(0, 8) + '01'

const visitDays = (workouts, from, until, today) => new Set((workouts || [])
  .map(w => w?.d)
  .filter(d => d && d >= from && d <= today && (!until || d <= until)))

/** Visits since the card's start, or this month without one. */
export function cardVisits(card, workouts, today) {
  const since = card?.from || monthStart(today)
  return { count: visitDays(workouts, since, card?.until || null, today).size, since }
}

/** Days left on the membership, today included; null without an end date. */
export function cardTerm(card, today) {
  if (!card?.until) return null
  const daysLeft = Math.max(0, dayNumber(card.until) - dayNumber(today) + 1)
  return { until: card.until, daysLeft, expired: card.until < today }
}

/** Every day of today's month: whether a workout was logged on it, and which one is today. */
export function monthStrip(workouts, today) {
  const trained = visitDays(workouts, monthStart(today), null, today)
  const [y, m] = today.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  return Array.from({ length: days }, (_, i) => {
    const d = isoOf(new Date(y, m - 1, i + 1))
    return { d, trained: trained.has(d), today: d === today, future: d > today }
  })
}
