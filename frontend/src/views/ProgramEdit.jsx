import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { todayISO, uid } from '../lib/format.js'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { REST } from '../lib/rotation.js'
import { queueView } from '../lib/queue.js'
import { copyRoutine, deleteRoutine } from '../lib/routines.js'
import { workoutControls } from '../lib/workout-controls.js'
import { useListReorder, moved } from '../lib/use-list-reorder.js'
import {
  programsOf, looseDays, setProgramDays, addDayToProgram, moveDayToProgram, placeCopyNextTo,
  activateProgram, renameProgram, removeProgram, duplicateProgram,
} from '../lib/programs.js'
import { confirmSheet, menuSheet, glyphPicker } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import SwipeRow from '../components/SwipeRow.jsx'
import ProgramDayRow, { dayStates } from '../components/ProgramDayRow.jsx'
import { Button, Row, Section } from '../components/ui.jsx'
import { deleteRoutineWithUndo } from './Plan.jsx'

// Fork change: a program's own page, the way a day has RoutineEdit. Its name and icon, whether
// it is the one the app runs, its days in training order (rest days between them), and copying
// or deleting the whole program. A day opens RoutineEdit for its exercises.
export default function ProgramEdit() {
  const { id } = useParams()
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [edit, setEdit] = useState(false)
  const fallback = t('My program')
  const programs = programsOf(S, fallback)
  const program = programs.find(p => p.id === id)
  const days = program?.days || []
  const reorder = useListReorder(days.length, (from, to) => setDays(moved(days, from, to)))

  if (!program) return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" data-back="/plan" onClick={() => nav('/plan')} aria-label={t('Plan')}><Icon name="chevronLeft" /></button>
    </div>
    <div className="empty">{t('This program is gone.')}</div>
  </div>

  const today = todayISO()
  const setDays = next => update(s => setProgramDays(s, id, next, todayISO(), Date.now(), fallback))
  const routineOf = dayId => S.routines.find(r => r.id === dayId)
  const states = program.active ? dayStates(queueView(S, today)) : {}
  const swipe = workoutControls(S).swipeSets

  const rename = name => update(s => renameProgram(s, id, { name: name.trim() || t('Program') }, fallback))
  const start = () => update(s => activateProgram(s, id, todayISO(), Date.now(), fallback))

  const newDay = () => {
    const routine = { id: uid(), name: t('Day {0}', days.filter(d => d !== REST).length + 1), emoji: program.emoji || DEFAULT_GLYPH, ex: [] }
    update(s => {
      s.routines.push(routine)
      addDayToProgram(s, id, routine.id, todayISO(), Date.now(), fallback)
    })
    nav('/plan/r/' + routine.id)
  }
  // Days from the other programs and the ones outside any, to move into this one
  const elsewhere = [
    ...programs.filter(p => p.id !== id).flatMap(p => p.days.filter(d => d !== REST).map(d => ({ dayId: d, from: p.name }))),
    ...looseDays(S, fallback).map(d => ({ dayId: d, from: null })),
  ]
  const addMenu = () => menuSheet({
    title: t('Add to “{0}”', program.name),
    sections: [
      { items: [
        { icon: 'plus', label: t('New day'), sub: t('Empty, ready for its exercises'), onClick: newDay },
        days.some(d => d !== REST) && { icon: 'moon', label: t('Rest day'), sub: t('A day off before the next one'), onClick: () => setDays([...days, REST]) },
      ] },
      { title: t('Move a day here'), items: elsewhere.map(({ dayId, from }) => ({
        icon: glyphOf(routineOf(dayId)?.emoji), label: routineOf(dayId)?.name ?? dayId,
        sub: from ? t('From “{0}”', from) : t('Outside programs'),
        onClick: () => update(s => moveDayToProgram(s, dayId, id, todayISO(), Date.now(), fallback)),
      })) },
    ],
  })

  // A rest day is just a place in the list; a training day is deleted with an Undo, like on Plan
  const removeAt = i => days[i] === REST ? setDays(days.filter((_, k) => k !== i)) : deleteRoutineWithUndo(days[i])
  const duplicate = dayId => {
    const copy = copyRoutine(routineOf(dayId), t('Copy'))
    update(s => {
      s.routines.push(copy)
      placeCopyNextTo(s, dayId, copy.id, todayISO(), Date.now(), fallback)
    })
    // With its own Undo, as on Plan before programs: the newest swipe can be taken back
    useUI.getState().toast(t('Copied as “{0}”.', copy.name), { action: t('Undo'), onAction: () => {
      update(s => { if (s.routines.some(x => x.id === copy.id)) deleteRoutine(s, copy.id) })
    } })
  }

  const copyProgram = () => {
    let copyId = null
    update(s => { copyId = duplicateProgram(s, id, t('Copy'), fallback) })
    if (copyId) nav('/plan/p/' + copyId)
  }
  const deleteProgram = () => confirmSheet({
    title: t('Delete program?'),
    message: t('“{0}” and its days will be removed. Logged workouts stay in your history.', program.name),
    confirmText: t('Delete'),
    danger: true,
    onConfirm: () => {
      update(s => removeProgram(s, id, todayISO(), fallback))
      nav('/plan')
    },
  })

  return <div className="narrow plan program-page">
    <div className="hdr">
      <button className="iconbtn" data-back="/plan" onClick={() => nav('/plan')} aria-label={t('Plan')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, margin: '0 12px' }}>
        <input className="input" defaultValue={program.name} aria-label={t('Program name')}
          style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-.021em' }}
          onChange={e => rename(e.target.value)} />
      </div>
      <button className="iconbtn" aria-label={t('Pick an icon')}
        onClick={() => glyphPicker(program.emoji, g => update(s => renameProgram(s, id, { emoji: g }, fallback)))}>
        <Icon name={glyphOf(program.emoji)} />
      </button>
    </div>

    <Section className="program-status" footer={program.active
      ? t('The app suggests its days one after another, whatever the weekday. The next one stays next until you train it.')
      : t('Start it and the app suggests its days one after another, whatever the weekday.')}>
      {program.active
        ? <Row icon="repeat" iconTint="var(--acc)" title={t('Running now')}>
          <span className="tag acc">{t('Active')}</span>
        </Row>
        : <Row icon="play" iconTint="var(--label-2)" title={t('Not running')} />}
    </Section>
    {/* Full width under the status: a long name of the button never pushes past a phone's edge */}
    {!program.active && <Button className="program-start" variant="tinted" icon="play"
      disabled={!days.some(d => d !== REST)} onClick={start}>{t('Start this program')}</Button>}

    <div className="row between plan-sec-h">
      <h4 className="sec">{t('Days')}</h4>
      <div className="row plan-sec-acts" style={{ gap: 6 }}>
        {days.length > 0 && <button className="plan-textbtn" aria-pressed={edit} onClick={() => setEdit(e => !e)}>{edit ? t('Done') : t('Edit')}</button>}
        <Button size="sm" variant="tinted" icon="plus" onClick={addMenu}>{t('Add')}</Button>
      </div>
    </div>
    {days.length ? <div className="list routine-list program-days" ref={reorder.listRef}>
      {days.map((dayId, i) => {
        const key = i + ':' + dayId
        const reorderProps = { 'data-reorder-row': '', style: reorder.rowStyle(i) }
        const useSwipe = swipe && !edit && dayId !== REST
        const row = <ProgramDayRow key={useSwipe ? undefined : key} id={dayId} index={i} routine={routineOf(dayId)} body={S.body}
          state={states[dayId]} editing={edit} onOpen={() => nav('/plan/r/' + dayId)}
          onRemove={() => removeAt(i)} handle={days.length > 1 ? reorder.handle(i) : null}
          rowProps={useSwipe ? {} : reorderProps} />
        return useSwipe
          ? <SwipeRow key={key} {...reorderProps} className="swrow-item" copyLabel={t('Duplicate')}
            onDelete={() => removeAt(i)} onCopy={() => duplicate(dayId)}>{row}</SwipeRow>
          : row
      })}
    </div> : <div className="empty">{t('No days yet. Add the first one and give it its exercises.')}</div>}
    {days.length > 0 && <p className="sect-f">{edit ? t('Drag to reorder. Tap the minus to delete.') : t('Tap a day to edit its exercises.')}</p>}

    <div style={{ height: 14 }} />
    <Button icon="copy" onClick={copyProgram}>{t('Copy program')}</Button>
    <div style={{ height: 10 }} />
    <Button variant="danger" onClick={deleteProgram}>{t('Delete program')}</Button>
  </div>
}
