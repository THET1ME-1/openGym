// @vitest-environment happy-dom
//
// Plan → Programs (fork change): every program with its days under it, the running one marked,
// and the days that belong to no program gathered at the end.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import Plan from './Plan.jsx'

const nav = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav }))
vi.mock('../sheets.jsx', () => ({
  dayAssignSheet: vi.fn(), starterPlanSheet: vi.fn(), confirmSheet: vi.fn(), menuSheet: vi.fn(),
  planHasRoutines: () => true, exportPlanFile: vi.fn(), printWholePlan: vi.fn(), importPlanFile: vi.fn(),
}))

import { menuSheet, starterPlanSheet } from '../sheets.jsx'

const day = (id, name) => ({ id, name, emoji: 'barbell', ex: [{ id: '0025' }] })
const base = {
  routines: [day('push', 'Push'), day('pull', 'Pull'), day('legs', 'Legs'), day('arms', 'Arms')],
  week: {}, dayPlan: {}, workouts: [], queue: null, rotation: null, scheduleMode: null,
}
let host, root
const setS = over => useStore.setState(s => ({ S: { ...s.S, ...base, programs: undefined, activeProgramId: undefined, ...over }, user: null }))
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.setItem('gym_plan_view', 'routines')
  nav.mockClear(); menuSheet.mockClear(); starterPlanSheet.mockClear()
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  setS({})
})
afterEach(() => { act(() => root.unmount()); host.remove(); localStorage.removeItem('gym_plan_view') })

const mount = () => act(() => root.render(<Plan />))
const S = () => useStore.getState().S
const cards = () => [...host.querySelectorAll('.program-card:not(.program-loose)')]
const titleOf = card => card.querySelector('.program-hd .tt').textContent
const dayNames = card => [...card.querySelectorAll('.program-day .tt')].map(e => e.textContent)
const button = (text, scope = host) => [...scope.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const click = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

describe('Plan → Programs', () => {
  it('shows a running loop from before programs as one active program, the other days outside', () => {
    setS({ rotation: { id: 'r1', sequence: ['push', 'pull', 'legs'], label: '' }, scheduleMode: 'rotation' })
    mount()
    expect(cards()).toHaveLength(1)
    expect(titleOf(cards()[0])).toBe('My program')
    expect(cards()[0].querySelector('.tag.acc').textContent).toBe('Active')
    expect(dayNames(cards()[0])).toEqual(['Push', 'Pull', 'Legs'])
    expect(dayNames(host.querySelector('.program-loose'))).toEqual(['Arms'])
  })

  it('lists saved programs in order with their own days', () => {
    setS({
      programs: [{ id: 'p1', name: 'PPL', emoji: 'barbell', days: ['push', 'pull', 'legs'] }, { id: 'p2', name: 'Arms day', emoji: 'arm', days: ['arms'] }],
      activeProgramId: null,
    })
    mount()
    expect(cards().map(titleOf)).toEqual(['PPL', 'Arms day'])
    expect(dayNames(cards()[1])).toEqual(['Arms'])
    expect(host.querySelector('.program-loose')).toBe(null)
  })

  it('starts a program that is not running', () => {
    setS({ programs: [{ id: 'p1', name: 'PPL', emoji: 'barbell', days: ['push', 'pull', 'legs'] }], activeProgramId: null })
    mount()
    click(button('Start', cards()[0]))
    expect(S().activeProgramId).toBe('p1')
    expect(S().queue.ids).toEqual(['push', 'pull', 'legs'])
    expect(cards()[0].querySelector('.tag.acc')).toBeTruthy()
  })

  it('a new program opens its own page', () => {
    mount()
    click(button('New program'))
    const created = S().programs.at(-1)
    expect(created.name).toBe('New program')
    expect(nav).toHaveBeenCalledWith('/plan/p/' + created.id)
  })

  it('the program title opens the program, a day opens the day', () => {
    setS({ programs: [{ id: 'p1', name: 'PPL', emoji: 'barbell', days: ['push', 'pull'] }], activeProgramId: null })
    mount()
    click(cards()[0].querySelector('.program-hd'))
    expect(nav).toHaveBeenLastCalledWith('/plan/p/p1')
    click(cards()[0].querySelectorAll('.program-day')[1])
    expect(nav).toHaveBeenLastCalledWith('/plan/r/pull')
  })

  it('a day outside programs can be moved into one', () => {
    setS({ programs: [{ id: 'p1', name: 'PPL', emoji: 'barbell', days: ['push', 'pull', 'legs'] }], activeProgramId: null })
    mount()
    click(host.querySelector('.program-loose button[aria-label="Move Arms to a program"]'))
    const { items } = menuSheet.mock.calls.at(-1)[0]
    act(() => items.find(i => i.label === 'PPL').onClick())
    expect(S().programs[0].days).toEqual(['push', 'pull', 'legs', 'arms'])
  })

  it('with no days at all says how to begin', () => {
    setS({ routines: [] })
    mount()
    expect(host.textContent).toContain('No programs yet.')
    click(button('Load starter plan'))
    expect(starterPlanSheet).toHaveBeenCalled()
  })
})
