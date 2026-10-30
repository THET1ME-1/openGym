import { describe, it, expect } from 'vitest'
import { cardVisits, cardTerm, monthStrip, CARD_COLORS } from './gym-card.js'

// A membership card (fork change) counts the gym visits by itself: one day with a logged
// workout is one visit. With a start date it counts from there, otherwise this month; with an
// end date it says how many days are left.

const TODAY = '2026-10-30'
const w = d => ({ id: 'w' + d + Math.random(), d, start: Date.parse(d + 'T18:00:00'), entries: [] })

describe('cardVisits', () => {
  it('without dates counts the days with a workout this month, two workouts on a day as one visit', () => {
    const v = cardVisits({}, [w('2026-09-30'), w('2026-10-02'), w('2026-10-02'), w('2026-10-15')], TODAY)
    expect(v).toEqual({ count: 2, since: '2026-10-01' })
  })

  it('with a start and an end counts only the days between them', () => {
    const card = { from: '2026-10-05', until: '2026-11-04' }
    const v = cardVisits(card, [w('2026-10-04'), w('2026-10-05'), w('2026-10-20'), w('2026-11-10')], TODAY)
    expect(v).toEqual({ count: 2, since: '2026-10-05' })
  })

  it('a workout dated in the future is not a visit yet', () => {
    expect(cardVisits({}, [w('2026-10-31')], TODAY).count).toBe(0)
  })
})

describe('cardTerm', () => {
  it('counts the days left to the end date, the last day included', () => {
    expect(cardTerm({ until: '2026-11-04' }, TODAY)).toEqual({ until: '2026-11-04', daysLeft: 6, expired: false })
    expect(cardTerm({ until: TODAY }, TODAY)).toMatchObject({ daysLeft: 1, expired: false })
  })

  it('an end date that has passed is expired', () => {
    expect(cardTerm({ until: '2026-10-29' }, TODAY)).toMatchObject({ daysLeft: 0, expired: true })
  })

  it('no end date, no term', () => {
    expect(cardTerm({}, TODAY)).toBeNull()
  })
})

describe('monthStrip', () => {
  it('has every day of the month, the trained ones and today marked', () => {
    const strip = monthStrip([w('2026-10-02'), w('2026-10-30'), w('2026-09-30')], TODAY)
    expect(strip).toHaveLength(31)
    expect(strip[0]).toEqual({ d: '2026-10-01', trained: false, today: false, future: false })
    expect(strip[1].trained).toBe(true)
    expect(strip[29]).toMatchObject({ trained: true, today: true })
    expect(strip[30]).toMatchObject({ future: true })
  })
})

describe('CARD_COLORS', () => {
  it('are the app’s own accents', () => {
    expect(CARD_COLORS).toEqual(['lime', 'sky', 'orange', 'violet', 'pink', 'red', 'teal', 'gold'])
  })
})
