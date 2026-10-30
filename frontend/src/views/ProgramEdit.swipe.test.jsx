// @vitest-environment happy-dom
// The days of a program (fork change, moved here from Plan's old routines list): toward the start
// deletes a day with an Undo (no confirm), toward the end duplicates it right below in the same
// program. Edit mode has the same delete behind a minus and a handle to change the order. The
// rows stay keyboard buttons.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { closeOpenRow } from '../lib/use-swipe-row.js'
import { deleteRoutineWithUndo } from './Plan.jsx'
import ProgramEdit from './ProgramEdit.jsx'

const nav = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav, useParams: () => ({ id: 'p1' }) }))
vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
const confirmSheet = vi.hoisted(() => vi.fn())
vi.mock('../sheets.jsx', () => ({
  dayAssignSheet: vi.fn(), starterPlanSheet: vi.fn(), menuSheet: vi.fn(), confirmSheet, glyphPicker: vi.fn(),
  planHasRoutines: () => true, exportPlanFile: vi.fn(), printWholePlan: vi.fn(), importPlanFile: vi.fn(),
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
const routine = (id, name) => ({ id, name, emoji: null, ex: [{ id: '0025' }] })
let host, root, widthSpy

function mount(extra = {}) {
  const S = clone(DEF)
  Object.assign(S, {
    routines: [routine('a', 'Push A'), routine('b', 'Pull A'), routine('c', 'Legs')],
    week: {}, dayPlan: { '2099-01-01': 'b' },
    programs: [{ id: 'p1', name: 'PPL', emoji: 'barbell', days: ['a', 'b', 'c'] }], activeProgramId: null,
  }, extra)
  useStore.setState({ S, user: null })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  act(() => root.render(<ProgramEdit />))
}
const S = () => useStore.getState().S
const days = () => S().programs[0].days
const swrows = () => [...host.querySelectorAll('.swrow')]
const rowOf = name => swrows().find(r => r.querySelector('.tt')?.textContent === name)
function pointer(target, type, x, y = 300) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y })
  act(() => { target.dispatchEvent(event) })
}
const click = target => act(() => { target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })) })
function swipe(target, x0, x1) {
  pointer(target, 'pointerdown', x0)
  pointer(target, 'pointermove', (x0 + x1) / 2)
  pointer(target, 'pointermove', x1)
  pointer(target, 'pointerup', x1)
  click(target)
  act(() => vi.advanceTimersByTime(800))
}
const undo = () => act(() => useUI.getState().runToastAction())
const edit = () => click([...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Edit'))
const handles = () => [...host.querySelectorAll('[data-reorder-handle]')]

// happy-dom 20.12+ runs Element.animate on its own clock, which fake timers do not move, so the
// row's collapse never finished: end each animation on the faked clock instead.
const fakeAnimate = () => vi.spyOn(Element.prototype, 'animate').mockImplementation(function (_, o) {
  const a = { onfinish: null, cancel: () => clearTimeout(t) }
  const t = setTimeout(() => a.onfinish?.(), o?.duration || 0)
  return a
})

beforeEach(() => {
  vi.useFakeTimers()
  fakeAnimate()
  nav.mockClear(); confirmSheet.mockClear()
  document.documentElement.dir = 'ltr'
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  widthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(360)
})
afterEach(() => {
  closeOpenRow(true)
  act(() => root.unmount()); host.remove()
  widthSpy.mockRestore()
  vi.clearAllTimers(); vi.useRealTimers()
  vi.mocked(Element.prototype.animate).mockRestore?.()
})

describe('the days of a program', () => {
  it('rows stay keyboard buttons that open the day, with both panes out of reach while shut', () => {
    mount()
    expect(swrows()).toHaveLength(3)
    const r = rowOf('Pull A').querySelector('.item')
    expect(r.getAttribute('role')).toBe('button')
    expect(r.tabIndex).toBe(0)
    act(() => { r.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
    expect(nav).toHaveBeenLastCalledWith('/plan/r/b')
    const panes = rowOf('Push A').querySelectorAll('.swpane')
    expect(panes).toHaveLength(2)
    for (const pane of panes) expect(pane.getAttribute('aria-hidden')).toBe('true')
    expect(rowOf('Push A').querySelector('.swpane.cp').textContent).toBe('Duplicate')
  })

  it('a long swipe toward the start deletes without a confirm, and Undo puts the day back in its place', () => {
    mount()
    const before = clone(S())
    swipe(rowOf('Pull A'), 330, 60)
    expect(confirmSheet).not.toHaveBeenCalled()
    expect(S().routines.map(r => r.id)).toEqual(['a', 'c'])
    expect(S().dayPlan).toEqual({})
    expect([...host.querySelectorAll('.program-day .tt')].map(e => e.textContent)).toEqual(['Push A', 'Legs'])
    expect(useUI.getState().toastMsg).toBe('“Pull A” gone.')

    undo()
    expect(S().routines).toEqual(before.routines)
    expect(S().dayPlan).toEqual(before.dayPlan)
    expect([...host.querySelectorAll('.program-day .tt')].map(e => e.textContent)).toEqual(['Push A', 'Pull A', 'Legs'])
  })

  it('a long swipe toward the end duplicates right below, in the same program', () => {
    mount()
    swipe(rowOf('Push A'), 100, 330)
    const copy = S().routines.find(r => r.name === 'Push A (Copy)')
    expect(copy.ex).toEqual(S().routines[0].ex)
    expect(days()).toEqual(['a', copy.id, 'b', 'c'])
    expect(useUI.getState().toastMsg).toBe('Copied as “Push A (Copy)”.')
    expect(nav).not.toHaveBeenCalled()
  })

  it('the duplicate’s toast has its own Undo, which takes the copy away again', () => {
    mount()
    swipe(rowOf('Push A'), 100, 330)
    expect(S().routines).toHaveLength(4)
    undo()
    expect(S().routines.map(r => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('an Undo that finds the day already back says so instead of nothing', () => {
    mount()
    act(() => { deleteRoutineWithUndo('b') })
    const pending = useUI.getState().toastAction
    act(() => useStore.getState().update(s => { s.routines.splice(1, 0, routine('b', 'Pull A')) }))   // a sync brought it back
    act(() => pending.run())
    expect(useUI.getState().toastMsg).toBe('It’s already back.')
  })

  it('Edit’s minus deletes the same way, with the Undo in place of the confirm', () => {
    mount()
    edit()
    click(host.querySelector('button[aria-label="Delete Legs"]'))
    expect(confirmSheet).not.toHaveBeenCalled()
    expect(S().routines.map(r => r.id)).toEqual(['a', 'b'])
    undo()
    expect(S().routines.map(r => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('Edit moves a day with the arrow keys on its handle, and the program order follows', () => {
    mount()
    edit()
    expect(handles().map(b => b.getAttribute('aria-label'))).toEqual(['Move Push A', 'Move Pull A', 'Move Legs'])
    act(() => { handles()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })) })
    expect(days()).toEqual(['b', 'a', 'c'])
    click(host.querySelectorAll('.program-day')[0])
    expect(nav).not.toHaveBeenCalled()   // in Edit a row opens nothing
  })

  it('is a plain list with the setting off', () => {
    mount({ wc: { ...DEF.wc, swipeSets: false } })
    expect(swrows()).toHaveLength(0)
    expect(host.querySelectorAll('.item.program-day')).toHaveLength(3)
  })
})
