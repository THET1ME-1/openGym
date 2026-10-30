// @vitest-environment happy-dom
// Importing a one-routine plan file toasted "Added 1 routines to your plan" (QA copy): the
// sheet's summary line already picked the singular, the toast after the merge did not.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { planImportSheet } from './sheets.jsx'
import { parsePlan } from './lib/plan-share.js'
import { EXDB } from './lib/exercises.js'
import { activeProgramOf } from './lib/programs.js'

const clone = v => JSON.parse(JSON.stringify(v))
const ids = EXDB.filter(e => e.bp !== 'cardio').slice(0, 2).map(e => e.id)
const mounted = []

function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const buttonFor = (host, label) => [...host.querySelectorAll('button')].find(b => b.textContent === label)
const bundleOf = routines => parsePlan({ opengym_plan: 1, unit: 'kg', week: {}, routines, customEx: [] }, 'kg')
const routine = (id, name) => ({ id, name, emoji: null, ex: [{ id: ids[0], sets: 3, reps: 8, weight: 40 }] })

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  document.body.innerHTML = ''
  const S = clone(useStore.getState().S)
  S.routines = []
  S.week = {}
  useStore.setState({ S, user: null })
})
afterEach(() => { act(() => { mounted.splice(0).forEach(r => r.unmount()) }) })

describe('Plan import sheet — the toast counts what it added', () => {
  it('says "1 routine" for a single routine', () => {
    planImportSheet(bundleOf([routine('a', 'Push')]))
    const host = renderTop()
    act(() => { buttonFor(host, 'Add to my plan').click() })
    expect(useStore.getState().S.routines).toHaveLength(1)
    expect(useUI.getState().toastMsg).toBe('Added 1 routine to your plan')
  })

  it('keeps the plural for several', () => {
    planImportSheet(bundleOf([routine('a', 'Push'), routine('b', 'Pull')]))
    const host = renderTop()
    act(() => { buttonFor(host, 'Add to my plan').click() })
    expect(useUI.getState().toastMsg).toBe('Added 2 routines to your plan')
  })
})

// Fork change: a plan file is a program, its routines the program's days
describe('Plan import sheet — the file becomes a program', () => {
  const named = (name, routines) => ({ ...bundleOf(routines), name })
  const switchFor = host => host.querySelector('.switch, [role="switch"]')

  it('adds the days as a program named after the file and starts it when nothing runs', () => {
    planImportSheet(named('Shared PPL', [routine('a', 'Push'), routine('b', 'Pull')]))
    const host = renderTop()
    act(() => { buttonFor(host, 'Add to my plan').click() })
    const S = useStore.getState().S
    const program = activeProgramOf(S)
    expect(program.name).toBe('Shared PPL')
    expect(program.days.map(id => S.routines.find(r => r.id === id).name)).toEqual(['Push', 'Pull'])
    expect(S.queue.ids).toEqual(program.days)
  })

  it('keeps the running program when starting the new one is switched off', () => {
    useStore.setState(s => ({ S: { ...s.S, programs: [{ id: 'mine', name: 'Mine', emoji: 'barbell', days: [] }], activeProgramId: 'mine' } }))
    planImportSheet(named('Shared PPL', [routine('a', 'Push')]))
    const host = renderTop()
    act(() => { switchFor(host).click() })
    act(() => { buttonFor(host, 'Add to my plan').click() })
    const S = useStore.getState().S
    expect(S.activeProgramId).toBe('mine')
    expect(S.programs.map(p => p.name)).toEqual(['Mine', 'Shared PPL'])
  })
})
