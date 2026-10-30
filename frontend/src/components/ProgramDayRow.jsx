import Icon from './Icon.jsx'
import MiniBodyMap from './MiniBodyMap.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { exCount } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { REST } from '../lib/rotation.js'

// Fork change: one day of a program, on Plan's program cards and on the program's own page.
// Its place in the program (the running program marks the next day and the ones done this
// round), its icon, name and exercises, and the muscles it works. A rest day is a quiet row.
// In edit mode the row shows the page's minus and drag handle instead of opening the day.
export default function ProgramDayRow({ id, index, routine, body, state, onOpen, editing, onRemove, handle, rowProps, accessory }) {
  const rest = id === REST
  const name = rest ? t('Rest day') : routine?.name ?? ''
  const open = !editing && !rest && onOpen ? tappable(onOpen) : {}
  return <div {...rowProps} {...open}
    className={'item program-day' + (rest ? ' is-rest' : '') + (state === 'done' ? ' is-done' : '')}>
    {/* A training day is deleted (with an Undo), a rest day is only taken out of the order */}
    {editing && onRemove && <button className="plan-minus" aria-label={rest ? t('Remove {0}', name) : t('Delete {0}', name)}
      title={rest ? t('Remove') : t('Delete routine')} onClick={onRemove}><Icon name="minus" /></button>}
    {index != null && <span className={'plan-order' + (state === 'next' ? ' next' : '')}>{state === 'done' ? <Icon name="check" /> : index + 1}</span>}
    <span className={'lrow-i' + (rest ? ' rest' : '')}><Icon name={rest ? 'moon' : glyphOf(routine?.emoji)} /></span>
    <div className="grow" style={{ minWidth: 0 }}>
      <div className="tt">{name}</div>
      <div className="ss">{rest ? t('A day off before the next one') : state === 'next' ? t('Up next') : exCount(routine?.ex?.length || 0)}</div>
    </div>
    {!rest && !editing && routine && <MiniBodyMap routines={[routine]} body={body} />}
    {accessory}
    {!rest && !editing && onOpen && <Icon name="chevronRight" className="chev" />}
    {editing && handle && <button className="plan-handle" aria-label={t('Move {0}', name)} title={t('Drag to reorder')}
      {...handle}><Icon name="chevronsUpDown" /></button>}
  </div>
}

// The running round's state of each day id: 'done', 'next' or 'later' (lib/queue.js queueView)
export function dayStates(view) {
  const states = {}
  for (const item of view?.items || []) if (!(item.id in states)) states[item.id] = item.state
  return states
}
