import { describe, it, expect } from 'vitest'
import {
  programsOf, looseDays, activeProgramOf, programOfDay,
  addProgram, renameProgram, setProgramDays, addDayToProgram, moveDayToProgram,
  activateProgram, removeProgram, duplicateProgram, placeCopyNextTo, programFromImport,
} from './programs.js'
import { queueOf } from './queue.js'
import { REST } from './rotation.js'

// A program is a training plan made of days. Each day is an ordinary routine (S.routines), so
// workouts, progression, the watch and the coach keep working on days exactly as before. The
// active program is the loop the app runs (S.rotation): its days come up one after another,
// with no weekday attached.

const TODAY = '2026-10-30'
const NOW = Date.parse(TODAY + 'T10:00:00')
const day = (id, name = id.toUpperCase()) => ({ id, name, emoji: 'barbell', ex: [] })
const base = (over = {}) => ({
  routines: [day('push'), day('pull'), day('legs'), day('fa'), day('fb')],
  workouts: [], week: {}, dayPlan: {}, queue: null, rotation: null, scheduleMode: null,
  ...over,
})
const withPrograms = (over = {}) => base({
  programs: [
    { id: 'ppl', name: 'PPL', emoji: 'barbell', days: ['push', 'pull', 'legs'] },
    { id: 'full', name: 'Full body', emoji: 'figureStrength', days: ['fa', 'fb'] },
  ],
  activeProgramId: null,
  ...over,
})
const names = list => list.map(p => p.name)

describe('programsOf: a profile from before programs', () => {
  it('turns a running loop into one active program, the other days left outside', () => {
    const S = base({ rotation: { id: 'r1', sequence: ['push', 'pull', 'legs'], label: '' }, scheduleMode: 'rotation' })
    const list = programsOf(S, 'My program')
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ name: 'My program', days: ['push', 'pull', 'legs'], active: true })
    expect(looseDays(S, 'My program')).toEqual(['fa', 'fb'])
  })

  it('without a loop puts every day in one program that is not running yet', () => {
    const list = programsOf(base(), 'My program')
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ days: ['push', 'pull', 'legs', 'fa', 'fb'], active: false })
    expect(looseDays(base(), 'My program')).toEqual([])
  })

  it('a profile with no days at all has no programs', () => {
    expect(programsOf(base({ routines: [] }), 'My program')).toEqual([])
  })
})

describe('programsOf: saved programs', () => {
  it('lists them in order, days that were deleted left out', () => {
    const S = withPrograms({ routines: [day('push'), day('legs'), day('fa'), day('fb')] })
    const list = programsOf(S)
    expect(names(list)).toEqual(['PPL', 'Full body'])
    expect(list[0].days).toEqual(['push', 'legs'])
  })

  it('the active program reads its days from the running loop, rest days included', () => {
    const S = withPrograms({
      activeProgramId: 'ppl',
      rotation: { id: 'r1', sequence: ['push', REST, 'pull', 'legs'], label: 'PPL' },
    })
    expect(activeProgramOf(S)).toMatchObject({ id: 'ppl', days: ['push', REST, 'pull', 'legs'], active: true })
  })

  it('a day in no program is loose', () => {
    const S = withPrograms({ routines: [...base().routines, day('extra')] })
    expect(looseDays(S)).toEqual(['extra'])
  })

  it('finds the program a day belongs to', () => {
    expect(programOfDay(withPrograms(), 'fb')?.id).toBe('full')
    expect(programOfDay(withPrograms(), 'nope')).toBeNull()
  })
})

describe('activating a program', () => {
  it('starts a fresh loop of its days, named after it, with no weekday', () => {
    const s = withPrograms()
    activateProgram(s, 'ppl', TODAY, NOW)
    expect(s.activeProgramId).toBe('ppl')
    expect(s.scheduleMode).toBe('rotation')
    expect(s.rotation).toMatchObject({ sequence: ['push', 'pull', 'legs'], label: 'PPL' })
    expect(queueOf(s)).toMatchObject({ ids: ['push', 'pull', 'legs'], label: 'PPL', startsOn: TODAY })
  })

  it('switching keeps the edits made to the program that was running', () => {
    const s = withPrograms()
    activateProgram(s, 'ppl', TODAY, NOW)
    // the loop editor in Schedule changed the order of the running program
    s.rotation = { ...s.rotation, sequence: ['legs', 'push', 'pull'] }
    activateProgram(s, 'full', TODAY, NOW)
    expect(s.programs.find(p => p.id === 'ppl').days).toEqual(['legs', 'push', 'pull'])
    expect(queueOf(s).ids).toEqual(['fa', 'fb'])
  })

  it('a program with no days yet is active but runs nothing', () => {
    const s = withPrograms({ programs: [{ id: 'empty', name: 'Empty', emoji: 'barbell', days: [] }] })
    activateProgram(s, 'empty', TODAY, NOW)
    expect(s.activeProgramId).toBe('empty')
    expect(s.queue).toBeNull()
  })

  it('writes the migrated program first when the profile had none saved', () => {
    const s = base({ rotation: { id: 'r1', sequence: ['push', 'pull'], label: '' }, scheduleMode: 'rotation' })
    const id = addProgram(s, { name: 'Full body' }, 'My program')
    expect(names(s.programs)).toEqual(['My program', 'Full body'])
    expect(s.activeProgramId).toBe(s.programs[0].id)
    expect(id).toBe(s.programs[1].id)
  })
})

describe('editing the days of a program', () => {
  it('an inactive program just keeps the new list', () => {
    const s = withPrograms()
    setProgramDays(s, 'full', ['fb', 'fa'], TODAY, NOW)
    expect(s.programs.find(p => p.id === 'full').days).toEqual(['fb', 'fa'])
    expect(s.rotation).toBeNull()
  })

  it('the active program changes the running loop with it', () => {
    const s = withPrograms()
    activateProgram(s, 'ppl', TODAY, NOW)
    setProgramDays(s, 'ppl', ['push', 'legs'], TODAY, NOW)
    expect(s.rotation.sequence).toEqual(['push', 'legs'])
    expect(queueOf(s).ids).toEqual(['push', 'legs'])
  })

  it('emptying the active program stops its loop', () => {
    const s = withPrograms()
    activateProgram(s, 'ppl', TODAY, NOW)
    setProgramDays(s, 'ppl', [], TODAY, NOW)
    expect(s.queue).toBeNull()
    expect(activeProgramOf(s).days).toEqual([])
  })

  it('a new day goes to the end of its program', () => {
    const s = withPrograms()
    s.routines.push(day('arms'))
    addDayToProgram(s, 'ppl', 'arms', TODAY, NOW)
    expect(s.programs[0].days).toEqual(['push', 'pull', 'legs', 'arms'])
  })

  it('moving a day takes it out of the program it was in', () => {
    const s = withPrograms()
    moveDayToProgram(s, 'legs', 'full', TODAY, NOW)
    expect(s.programs[0].days).toEqual(['push', 'pull'])
    expect(s.programs[1].days).toEqual(['fa', 'fb', 'legs'])
  })

  it('a copied day lands right after its original, in the same program', () => {
    const s = withPrograms()
    s.routines.push(day('push2'))
    placeCopyNextTo(s, 'push', 'push2', TODAY, NOW)
    expect(s.programs[0].days).toEqual(['push', 'push2', 'pull', 'legs'])
  })
})

describe('programs themselves', () => {
  it('a new program is empty and not active', () => {
    const s = withPrograms()
    const id = addProgram(s, { name: 'Cut', emoji: 'flame' })
    expect(s.programs.at(-1)).toEqual({ id, name: 'Cut', emoji: 'flame', days: [] })
    expect(s.activeProgramId).toBeNull()
  })

  it('renaming the active program renames its loop too', () => {
    const s = withPrograms()
    activateProgram(s, 'ppl', TODAY, NOW)
    renameProgram(s, 'ppl', { name: 'Push Pull Legs' })
    expect(s.programs[0].name).toBe('Push Pull Legs')
    expect(s.rotation.label).toBe('Push Pull Legs')
    expect(s.queue.label).toBe('Push Pull Legs')
  })

  it('removing a program removes its days with it', () => {
    const s = withPrograms()
    removeProgram(s, 'full', TODAY)
    expect(names(s.programs)).toEqual(['PPL'])
    expect(s.routines.map(r => r.id)).toEqual(['push', 'pull', 'legs'])
  })

  it('removing the active program stops the loop and leaves none active', () => {
    const s = withPrograms()
    activateProgram(s, 'ppl', TODAY, NOW)
    removeProgram(s, 'ppl', TODAY)
    expect(s.activeProgramId).toBeNull()
    expect(s.queue).toBeNull()
    expect(s.rotation).toBeNull()
  })

  it('a copy of a program gets copies of its days, so editing one leaves the other alone', () => {
    const s = withPrograms()
    const id = duplicateProgram(s, 'full', 'Copy')
    const copy = s.programs.find(p => p.id === id)
    expect(copy.name).toBe('Full body (Copy)')
    expect(copy.days).toHaveLength(2)
    expect(copy.days.some(d => ['fa', 'fb'].includes(d))).toBe(false)
    expect(s.routines.filter(r => copy.days.includes(r.id)).map(r => r.name)).toEqual(['FA (Copy)', 'FB (Copy)'])
  })

  it('an imported plan becomes a program of its own', () => {
    const s = withPrograms()
    s.routines.push(day('i1'), day('i2'))
    const id = programFromImport(s, ['i1', 'i2'], 'Shared PPL')
    expect(s.programs.find(p => p.id === id)).toMatchObject({ name: 'Shared PPL', days: ['i1', 'i2'] })
  })
})
