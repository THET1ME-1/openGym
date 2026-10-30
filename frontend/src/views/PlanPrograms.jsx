import { t, tn } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'
import { glyphOf } from '../lib/glyphs.js'
import { REST } from '../lib/rotation.js'
import { queueView } from '../lib/queue.js'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { programsOf, looseDays, addProgram, activateProgram, moveDayToProgram } from '../lib/programs.js'
import { menuSheet, starterPlanSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import ProgramDayRow, { dayStates } from '../components/ProgramDayRow.jsx'
import { Button } from '../components/ui.jsx'

const trainingDays = days => days.filter(d => d !== REST).length

// Fork change: Plan → Programs. Every program as a card with its days under it in training
// order, the running one marked and its next day lit, the way Schedule lights the loop. The
// title opens the program (views/ProgramEdit.jsx), a day opens its exercises. Days that are in
// no program (the coach's, one saved from a workout) are gathered at the end to be moved in.
export default function Programs({ S, update, nav }) {
  const fallback = t('My program')
  const programs = programsOf(S, fallback)
  const loose = looseDays(S, fallback)
  const states = dayStates(queueView(S, todayISO()))
  const routineOf = id => S.routines.find(r => r.id === id)

  const newProgram = () => {
    let id = null
    update(s => { id = addProgram(s, { name: t('New program') }, fallback) })
    nav('/plan/p/' + id)
  }
  const start = id => update(s => activateProgram(s, id, todayISO(), Date.now(), fallback))
  const moveMenu = dayId => menuSheet({
    title: t('Move “{0}” to', routineOf(dayId)?.name ?? ''),
    items: programs.map(p => ({
      icon: glyphOf(p.emoji), label: p.name,
      onClick: () => update(s => moveDayToProgram(s, dayId, p.id, todayISO(), Date.now(), fallback)),
    })),
  })

  if (!programs.length && !loose.length) return <>
    <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('No programs yet.')}<br />{t('Make a program of your own, or grab the starter plan to get going.')}</div>
    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
      <Button variant="tinted" icon="plus" onClick={newProgram}>{t('New program')}</Button>
      <Button icon="clipboard" onClick={starterPlanSheet}>{t('Load starter plan')}</Button>
    </div>
  </>

  return <div className="plan-programs">
    <div className="row between plan-sec-h plan-routines-bar">
      <span className="small dim">{tn('{0} program', '{0} programs', programs.length)}</span>
      <Button size="sm" variant="tinted" icon="plus" onClick={newProgram}>{t('New program')}</Button>
    </div>

    {programs.map(p => <section key={p.id} className={'program-card' + (p.active ? ' is-active' : '')}>
      <div className="item program-hd" {...tappable(() => nav('/plan/p/' + p.id))}>
        <span className="lrow-i"><Icon name={glyphOf(p.emoji)} /></span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="tt">{p.name}</div>
          <div className="ss">{tn('{0} training day', '{0} training days', trainingDays(p.days))}</div>
        </div>
        {p.active
          ? <span className="tag acc">{t('Active')}</span>
          : <Button size="sm" variant="tinted" icon="play" aria-label={t('Start this program')} disabled={!trainingDays(p.days)}
            onClick={e => { e.stopPropagation(); start(p.id) }}>{t('Start')}</Button>}
        <Icon name="chevronRight" className="chev" />
      </div>
      {p.days.length
        ? <div className="list program-days">{p.days.map((d, i) => <ProgramDayRow key={i + ':' + d} id={d} index={i}
          routine={routineOf(d)} body={S.body} state={p.active ? states[d] : undefined} onOpen={() => nav('/plan/r/' + d)} />)}</div>
        : <div className="small dim program-none">{t('No days yet. Open the program to add them.')}</div>}
    </section>)}

    {loose.length > 0 && <section className="program-card program-loose">
      <h4 className="sec">{t('Outside programs')}</h4>
      <div className="list program-days">{loose.map(d => <ProgramDayRow key={d} id={d} routine={routineOf(d)} body={S.body}
        onOpen={() => nav('/plan/r/' + d)}
        accessory={programs.length > 0 && <button className="iconbtn program-move" aria-label={t('Move {0} to a program', routineOf(d)?.name ?? '')}
          onClick={e => { e.stopPropagation(); moveMenu(d) }}><Icon name="folder" /></button>} />)}</div>
      <p className="sect-f">{t('These days are in no program. Move them into one, or open them to delete.')}</p>
    </section>}

    <p className="sect-f">{t('Tap a program to change its days, a day to change its exercises.')}</p>
  </div>
}
