// @vitest-environment happy-dom
// The chooser is where a starter plan can quietly do the wrong thing: overwrite a weekday
// without asking, ask when there was nothing to overwrite, or apply a plan the user cancelled.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { loadStarterPlan, starterPlanSheet } from './sheets.jsx'
import { activeProgramOf } from './lib/programs.js'

const mounted = []

const S = () => useStore.getState().S
const nameOf = id => S().routines.find(r => r.id === id)?.name

// Renders whatever sheet is on top and returns its host element.
function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}

const rowFor = (host, name) => [...host.querySelectorAll('.item')].find(el => el.querySelector('.tt')?.textContent === name)
const buttonFor = (host, label) => [...host.querySelectorAll('button')].find(b => b.textContent === label)

// Opens the chooser and taps one of its rows.
function choose(name) {
  starterPlanSheet()
  const host = renderTop()
  act(() => { rowFor(host, name).click() })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState(s => ({
    S: {
      ...s.S, routines: [{ id: 'mine', name: 'My routine', emoji: 'star', ex: [] }], week: {}, active: null,
      programs: [], activeProgramId: null, rotation: null, queue: null, scheduleMode: null, workouts: [], dayPlan: {},
    },
  }))
  document.body.innerHTML = ''
})

afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('starter plan chooser', () => {
  it('lists every plan with its day count', () => {
    starterPlanSheet()
    const host = renderTop()
    expect([...host.querySelectorAll('.item .tt')].map(el => el.textContent))
      .toEqual(['Push / Pull / Legs', 'Upper / Lower', 'Full Body', '5×5'])
    expect(rowFor(host, 'Upper / Lower').querySelector('.ss').textContent).toContain('4 days per week')
  })

  // Fork change: a starter plan is a program of days that starts running, with no weekdays.
  it('loads as a program of its own and starts it, without asking when nothing else runs', () => {
    useStore.setState(s => ({ S: { ...s.S, week: { 0: ['mine'], 6: ['mine'] } } }))
    choose('Upper / Lower')

    expect(useUI.getState().sheets).toHaveLength(0)   // no confirmation was raised
    const program = activeProgramOf(S())
    expect(program.name).toBe('Upper / Lower')
    expect(program.days.map(nameOf)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B'])
    expect(S().queue.ids).toEqual(program.days)
    expect(S().week).toEqual({ 0: ['mine'], 6: ['mine'] })   // the weekly plan is not touched
    expect(S().routines[0].name).toBe('My routine')           // and nothing is deleted
    expect(useUI.getState().toastMsg).toBe('Upper / Lower loaded')
  })

  it('loading the same plan twice reuses its days and its program instead of duplicating them', () => {
    expect(loadStarterPlan('upper-lower')).toBe(true)
    const ids = S().routines.map(r => r.id)
    const programs = structuredClone(S().programs)
    expect(loadStarterPlan('upper-lower')).toBe(true)
    expect(S().routines.map(r => r.id)).toEqual(ids)
    expect(S().routines.filter(r => r.name === 'Upper A')).toHaveLength(1)
    expect(S().programs.map(p => p.id)).toEqual(programs.map(p => p.id))
  })

  it('asks first when another program is running', () => {
    loadStarterPlan('ppl')
    const days = S().routines.length
    choose('Full Body')

    const confirm = renderTop()
    expect(confirm.querySelector('h3').textContent).toBe('Load Full Body?')
    expect(confirm.textContent).toContain('Push / Pull / Legs')
    expect(S().routines).toHaveLength(days)                  // nothing applied yet

    act(() => { buttonFor(confirm, 'Load plan').click() })
    expect(activeProgramOf(S()).days.map(nameOf)).toEqual(['Full Body A', 'Full Body B', 'Full Body C'])
    expect(S().programs.map(p => p.name)).toContain('Push / Pull / Legs')
  })

  it('leaves everything alone when the confirmation is cancelled', () => {
    loadStarterPlan('ppl')
    const before = structuredClone(S())
    useUI.setState({ toastMsg: '' })
    choose('5×5')

    const confirm = renderTop()
    act(() => { buttonFor(confirm, 'Cancel').click() })
    expect(S()).toEqual(before)
    expect(useUI.getState().toastMsg).toBe('')
  })
})

describe('starter plan chooser, fitted to equipment', () => {
  const home = { id: 'home', name: 'Home', equipment: ['dumbbell'] }
  const chip = (host, label) => [...host.querySelectorAll('.chip')].find(b => b.textContent === label)
  const exIds = () => S().routines.slice(1).flatMap(r => r.ex.map(e => e.id))

  it('points to Settings when there is no profile, and offers no chips', () => {
    starterPlanSheet()
    const host = renderTop()
    expect(host.querySelector('.chip')).toBeNull()
    expect(host.textContent).toContain('Add an equipment profile in Settings')
  })

  it('loads the plan as written unless a profile is picked', () => {
    useStore.setState(s => ({ S: { ...s.S, equipProfiles: [home], activeEquipId: 'home', equipFilterOn: false } }))
    starterPlanSheet()
    const host = renderTop()
    expect(chip(host, 'As written').className).toContain('on')
    act(() => { rowFor(host, 'Push / Pull / Legs').click() })
    expect(exIds()).toContain('0025')   // the barbell bench press
  })

  it('starts on the profile the library is filtered by, and fits the plan to it', () => {
    useStore.setState(s => ({ S: { ...s.S, equipProfiles: [home], activeEquipId: 'home', equipFilterOn: true } }))
    starterPlanSheet()
    const host = renderTop()
    expect(chip(host, 'Home').className).toContain('on')
    act(() => { rowFor(host, 'Push / Pull / Legs').click() })
    expect(exIds()).not.toContain('0025')
    expect(useUI.getState().toastMsg).toMatch(/^Push \/ Pull \/ Legs loaded, fitted to "Home": \d+ swapped, 0 dropped$/)
  })

  it('lets you pick a profile by hand', () => {
    useStore.setState(s => ({ S: { ...s.S, equipProfiles: [home], activeEquipId: '', equipFilterOn: false } }))
    starterPlanSheet()
    const host = renderTop()
    act(() => { chip(host, 'Home').click() })
    act(() => { rowFor(host, '5×5').click() })
    expect(exIds()).not.toContain('0043')   // no barbell squat on a dumbbell-only profile
  })

  it('adds a fitted plan beside a same-named routine with other exercises, instead of reusing it', () => {
    loadStarterPlan('ppl')
    loadStarterPlan('ppl', { id: 'home', name: 'Home', equipment: ['dumbbell'] })
    const pushes = S().routines.filter(r => r.name === 'Push Day')
    expect(pushes).toHaveLength(2)
    expect(pushes[0].ex.map(e => e.id)).not.toEqual(pushes[1].ex.map(e => e.id))
    expect(activeProgramOf(S()).days[0]).toBe(pushes[1].id)
  })

  it('still reuses the routines when the same fitted plan is loaded twice', () => {
    const home = { id: 'home', name: 'Home', equipment: ['dumbbell'] }
    loadStarterPlan('ppl', home)
    loadStarterPlan('ppl', home)
    expect(S().routines.filter(r => r.name === 'Push Day')).toHaveLength(1)
  })
})

describe('loadStarterPlan', () => {
  it('two different plans add independent routines', () => {
    loadStarterPlan('ppl')
    const first = S().routines.slice(1).map(r => r.id)
    loadStarterPlan('full-body')
    const second = S().routines.slice(4).map(r => r.id)
    expect(S().routines).toHaveLength(7)
    expect(new Set([...first, ...second]).size).toBe(6)
  })

  it('refuses a plan it does not know and changes nothing', () => {
    const before = structuredClone(S())
    expect(loadStarterPlan('nope')).toBe(false)
    expect(loadStarterPlan(undefined)).toBe(false)
    expect(S()).toEqual(before)
    expect(useUI.getState().toastMsg).toBe('')
  })
})
