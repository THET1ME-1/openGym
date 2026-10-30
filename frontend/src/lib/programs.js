// Programs (fork change): a training plan made of days.
//
//   S.programs = [{ id, name, emoji, days: string[] }]   S.activeProgramId = id | null
//
// A day is an ordinary routine from S.routines, so workouts, progression, the watch, the coach
// and the plan file keep working on days exactly as they did on routines. `days` holds routine
// ids in training order and may hold REST, the loop's day off (lib/rotation.js).
//
// The active program IS the loop the app runs (S.rotation and its pass S.queue): its days come
// up one after another whatever the weekday. While it is active its days are read from
// S.rotation.sequence, so an edit made in Schedule's loop editor is the program's edit too;
// switching to another program writes them back to `days` first.
//
// A profile from before programs has no S.programs: programsOf shows it as one program (its
// running loop, or all of its days), and the first change through here writes that down.

import { todayISO, uid } from './format.js'
import { DEFAULT_GLYPH } from './glyphs.js'
import { copyRoutine, deleteRoutine } from './routines.js'
import { REST, saveRotation, scheduleModeOf, startPass, stopPass } from './rotation.js'
import { queueOf } from './queue.js'

const MIGRATED_ID = 'main'

const routineIds = S => (Array.isArray(S?.routines) ? S.routines.map(r => r.id) : [])
const hasSession = days => days.some(id => id !== REST)

// Days that still exist, rest days kept
function existingDays(S, days) {
  const ids = new Set(routineIds(S))
  return (Array.isArray(days) ? days : []).filter(id => id === REST || ids.has(id))
}

// The one program a profile from before programs is shown as
function migratedPrograms(S, fallbackName) {
  if (!routineIds(S).length) return { list: [], activeId: null }
  const loop = existingDays(S, S.rotation?.sequence)
  if (hasSession(loop)) {
    const active = scheduleModeOf(S) === 'rotation'
    return {
      list: [{ id: MIGRATED_ID, name: fallbackName, emoji: DEFAULT_GLYPH, days: loop }],
      activeId: active ? MIGRATED_ID : null,
    }
  }
  return { list: [{ id: MIGRATED_ID, name: fallbackName, emoji: DEFAULT_GLYPH, days: routineIds(S) }], activeId: null }
}

function savedOrMigrated(S, fallbackName) {
  if (Array.isArray(S?.programs)) return { list: S.programs, activeId: S.activeProgramId ?? null }
  return migratedPrograms(S, fallbackName)
}

/** Every program with the days it has now and whether it is the one running. */
export function programsOf(S, fallbackName = '') {
  const { list, activeId } = savedOrMigrated(S, fallbackName)
  return list.map(p => {
    const active = p.id === activeId
    const days = active && S.rotation ? S.rotation.sequence : p.days
    return { id: p.id, name: p.name, emoji: p.emoji || DEFAULT_GLYPH, days: existingDays(S, days), active }
  })
}

export const activeProgramOf = (S, fallbackName = '') => programsOf(S, fallbackName).find(p => p.active) || null

export const programOfDay = (S, dayId, fallbackName = '') =>
  programsOf(S, fallbackName).find(p => p.days.includes(dayId)) || null

/** Days that are in no program: made by the coach, from a workout, or moved out of one. */
export function looseDays(S, fallbackName = '') {
  const inPrograms = new Set(programsOf(S, fallbackName).flatMap(p => p.days))
  return routineIds(S).filter(id => !inPrograms.has(id))
}

// Writes the programs down before the first change, the active one's days taken from the loop
function ensurePrograms(s, fallbackName) {
  if (!Array.isArray(s.programs)) {
    const { list, activeId } = migratedPrograms(s, fallbackName)
    s.programs = list.map(p => ({ ...p, days: [...p.days] }))
    s.activeProgramId = activeId
  }
  return s.programs
}

const find = (s, id) => s.programs.find(p => p.id === id) || null

// The running program's days as the loop has them now, written back into the program
function keepActiveDays(s) {
  const active = find(s, s.activeProgramId)
  if (active && s.rotation) active.days = existingDays(s, s.rotation.sequence)
}

/** Makes `id` the program the app runs: a fresh loop of its days, starting today. */
export function activateProgram(s, id, today = todayISO(), now = Date.now(), fallbackName = '') {
  ensurePrograms(s, fallbackName)
  const program = find(s, id)
  if (!program) return
  keepActiveDays(s)
  stopPass(s, today)
  const days = existingDays(s, program.days)
  program.days = days
  s.activeProgramId = id
  s.scheduleMode = 'rotation'
  // A new loop id: the pass of the program before is not this one's to continue
  s.rotation = { id: uid(), sequence: days, label: program.name }
  if (hasSession(days)) startPass(s, today, now)
}

/** The program's days in a new order or with some taken out; the running loop follows. */
export function setProgramDays(s, id, days, today = todayISO(), now = Date.now(), fallbackName = '') {
  ensurePrograms(s, fallbackName)
  const program = find(s, id)
  if (!program) return
  program.days = [...days]
  if (s.activeProgramId !== id) return
  const running = scheduleModeOf(s) === 'rotation'
  if (running && hasSession(days)) {
    saveRotation(s, days, program.name, today, now)
    return
  }
  // Nothing left to train, or Fixed Week chosen: the loop is kept for the next start only
  if (!hasSession(days) && queueOf(s)) stopPass(s, today)
  s.rotation = { id: s.rotation?.id ?? uid(), sequence: [...days], label: program.name }
}

export function addDayToProgram(s, programId, dayId, today = todayISO(), now = Date.now(), fallbackName = '') {
  ensurePrograms(s, fallbackName)
  const program = programsOf(s).find(p => p.id === programId)
  if (!program) return
  setProgramDays(s, programId, [...program.days, dayId], today, now)
}

/** Moves a day out of the program it is in (if any) to the end of another. */
export function moveDayToProgram(s, dayId, programId, today = todayISO(), now = Date.now(), fallbackName = '') {
  ensurePrograms(s, fallbackName)
  const from = programOfDay(s, dayId)
  if (from?.id === programId) return
  if (from) setProgramDays(s, from.id, from.days.filter(id => id !== dayId), today, now)
  addDayToProgram(s, programId, dayId, today, now)
}

/** A copied day goes right after the day it was copied from, in that day's program. */
export function placeCopyNextTo(s, originalId, copyId, today = todayISO(), now = Date.now(), fallbackName = '') {
  ensurePrograms(s, fallbackName)
  const program = programOfDay(s, originalId)
  if (!program) return
  const days = [...program.days]
  days.splice(days.indexOf(originalId) + 1, 0, copyId)
  setProgramDays(s, program.id, days, today, now)
}

/** A new, empty program; it does not start until it is made active. Returns its id. */
export function addProgram(s, { name, emoji }, fallbackName = '') {
  ensurePrograms(s, fallbackName)
  const id = uid()
  s.programs.push({ id, name, emoji: emoji || DEFAULT_GLYPH, days: [] })
  return id
}

export function renameProgram(s, id, { name, emoji }, fallbackName = '') {
  ensurePrograms(s, fallbackName)
  const program = find(s, id)
  if (!program) return
  if (name != null) program.name = name
  if (emoji != null) program.emoji = emoji
  if (s.activeProgramId !== id || !s.rotation) return
  s.rotation = { ...s.rotation, label: program.name }
  const q = queueOf(s)
  if (q && q.rotationId === s.rotation.id) s.queue = { ...s.queue, label: program.name }
}

/** Removes the program and its days; the active one's loop stops with it. */
export function removeProgram(s, id, today = todayISO(), fallbackName = '') {
  ensurePrograms(s, fallbackName)
  const program = programsOf(s).find(p => p.id === id)
  if (!program) return
  if (s.activeProgramId === id) {
    stopPass(s, today)
    s.rotation = null
    s.activeProgramId = null
  }
  s.programs = s.programs.filter(p => p.id !== id)
  const elsewhere = new Set(programsOf(s).flatMap(p => p.days))
  program.days.filter(d => d !== REST && !elsewhere.has(d)).forEach(d => deleteRoutine(s, d))
}

/** A copy of the program right after it, with copies of its days. Returns the copy's id. */
export function duplicateProgram(s, id, suffix = 'Copy', fallbackName = '') {
  ensurePrograms(s, fallbackName)
  const program = programsOf(s).find(p => p.id === id)
  if (!program) return null
  const days = program.days.map(d => {
    if (d === REST) return REST
    const copy = copyRoutine(s.routines.find(r => r.id === d), suffix)
    s.routines.push(copy)
    return copy.id
  })
  const copyId = uid()
  const name = copyRoutine({ name: program.name }, suffix).name
  const at = s.programs.findIndex(p => p.id === id)
  s.programs.splice(at + 1, 0, { id: copyId, name, emoji: program.emoji, days })
  return copyId
}

/** The days a plan file or a starter plan just added, as a program of their own. */
export function programFromImport(s, dayIds, name, fallbackName = '') {
  ensurePrograms(s, fallbackName)
  const id = uid()
  const first = s.routines.find(r => r.id === dayIds[0])
  s.programs.push({ id, name, emoji: first?.emoji || DEFAULT_GLYPH, days: [...dayIds] })
  return id
}
