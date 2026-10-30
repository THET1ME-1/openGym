// @vitest-environment happy-dom
//
// A program's own page (fork change): its name and icon, whether it is the one running, its days
// in training order, and copying or deleting it.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import ProgramEdit from './ProgramEdit.jsx'
import { REST } from '../lib/rotation.js'

const nav = vi.fn()
const params = { id: 'p1' }
vi.mock('react-router-dom', () => ({ useNavigate: () => nav, useParams: () => params }))
vi.mock('../sheets.jsx', () => ({ confirmSheet: vi.fn(), menuSheet: vi.fn(), glyphPicker: vi.fn() }))

import { confirmSheet, menuSheet } from '../sheets.jsx'

const day = (id, name) => ({ id, name, emoji: 'barbell', ex: [{ id: '0025' }] })
let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  nav.mockClear(); confirmSheet.mockClear(); menuSheet.mockClear()
  params.id = 'p1'
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  useStore.setState(s => ({ S: {
    ...s.S,
    routines: [day('push', 'Push'), day('pull', 'Pull'), day('legs', 'Legs'), day('fa', 'Full A')],
    week: {}, dayPlan: {}, workouts: [], queue: null, rotation: null, scheduleMode: null,
    programs: [{ id: 'p1', name: 'PPL', emoji: 'barbell', days: ['push', 'pull', 'legs'] }, { id: 'p2', name: 'Full', emoji: 'barbell', days: ['fa'] }],
    activeProgramId: null,
  }, user: null }))
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const mount = () => act(() => root.render(<ProgramEdit />))
const S = () => useStore.getState().S
const dayNames = () => [...host.querySelectorAll('.program-day .tt')].map(e => e.textContent)
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const click = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
const menuItem = label => menuSheet.mock.calls.at(-1)[0].sections.flatMap(g => g.items).find(i => i && i.label === label)

describe('a program page', () => {
  it('shows the name and the days in training order', () => {
    mount()
    expect(host.querySelector('.hdr input').value).toBe('PPL')
    expect(dayNames()).toEqual(['Push', 'Pull', 'Legs'])
  })

  it('renaming the running program renames its loop', () => {
    useStore.setState(s => ({ S: { ...s.S, activeProgramId: 'p1', rotation: { id: 'r', sequence: ['push', 'pull', 'legs'], label: 'PPL' }, scheduleMode: 'rotation' } }))
    mount()
    const input = host.querySelector('.hdr input')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Push Pull Legs')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(S().programs[0].name).toBe('Push Pull Legs')
    expect(S().rotation.label).toBe('Push Pull Legs')
  })

  it('starts the program from its page', () => {
    mount()
    click(button('Start this program'))
    expect(S().activeProgramId).toBe('p1')
    expect(S().queue.ids).toEqual(['push', 'pull', 'legs'])
    expect(button('Start this program')).toBeFalsy()
  })

  it('a new day joins the program and opens for its exercises', () => {
    mount()
    click(button('Add'))
    act(() => menuItem('New day').onClick())
    const created = S().routines.at(-1)
    expect(S().programs[0].days).toEqual(['push', 'pull', 'legs', created.id])
    expect(nav).toHaveBeenCalledWith('/plan/r/' + created.id)
  })

  it('a rest day goes in between training days', () => {
    mount()
    click(button('Add'))
    act(() => menuItem('Rest day').onClick())
    expect(S().programs[0].days).toEqual(['push', 'pull', 'legs', REST])
    expect(dayNames()).toEqual(['Push', 'Pull', 'Legs', 'Rest day'])
  })

  it('a day from another program can be moved in', () => {
    mount()
    click(button('Add'))
    act(() => menuItem('Full A').onClick())
    expect(S().programs[0].days).toEqual(['push', 'pull', 'legs', 'fa'])
    expect(S().programs[1].days).toEqual([])
  })

  it('a day opens for its exercises', () => {
    mount()
    click(host.querySelectorAll('.program-day')[2])
    expect(nav).toHaveBeenCalledWith('/plan/r/legs')
  })

  it('copying makes a new program with its own days and opens it', () => {
    mount()
    click(button('Copy program'))
    const copy = S().programs[1]
    expect(copy.name).toBe('PPL (Copy)')
    expect(copy.days).toHaveLength(3)
    expect(nav).toHaveBeenCalledWith('/plan/p/' + copy.id)
  })

  it('deleting asks first, then removes the program and its days', () => {
    mount()
    click(button('Delete program'))
    const opts = confirmSheet.mock.calls.at(-1)[0]
    expect(opts.danger).toBe(true)
    expect(S().programs).toHaveLength(2)
    act(() => opts.onConfirm())
    expect(S().programs.map(p => p.id)).toEqual(['p2'])
    expect(S().routines.map(r => r.id)).toEqual(['fa'])
    expect(nav).toHaveBeenCalledWith('/plan')
  })

  it('a program that is gone says so', () => {
    params.id = 'nope'
    mount()
    expect(host.textContent).toContain('This program is gone.')
  })
})
