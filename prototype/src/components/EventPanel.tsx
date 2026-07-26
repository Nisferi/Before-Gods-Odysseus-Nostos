import { useGameStore } from '../store/gameStore'
import type { Choice } from '../types'

function isChoiceLocked(
  choice: Choice,
  metis: number, food: number, gold: number,
  anger: number,
  flags: Record<string, boolean>
): string | null {
  if (anger >= 50 && (choice.tone === 'pious' || choice.tone === 'wise')) {
    return 'Гнев застилает глаза'
  }
  if (choice.requiresMetis !== undefined && metis < choice.requiresMetis) {
    return `Требует Метис ${choice.requiresMetis}`
  }
  if (choice.requiresFood !== undefined && food < choice.requiresFood) {
    return `Нужно ${choice.requiresFood} провизии`
  }
  if (choice.requiresGold !== undefined && gold < choice.requiresGold) {
    return `Нужно ${choice.requiresGold} золота`
  }
  if (choice.requiresFlag && !flags[choice.requiresFlag]) {
    return 'Недостаточно знаний'
  }
  if (choice.blockedByFlag && flags[choice.blockedByFlag]) {
    return 'Недоступно'
  }
  return null
}

export function EventPanel() {
  const { activeEvent, odysseus, resources, flags, athenaFavor, makeChoice } = useGameStore()

  if (!activeEvent) return null

  // Athena ≥ 40 marks the wisest available option with an owl feather
  const athenaHint = athenaFavor >= 40
    ? activeEvent.choices.find(c => c.tone === 'wise' || c.tone === 'pious')?.id
    : undefined

  return (
    <div className="event-screen">
      <p className="event-location-tag">Берег Трои · Акт I</p>
      <h2 className="event-title">{activeEvent.title}</h2>
      <p className="event-description">{activeEvent.description}</p>

      {odysseus.anger >= 50 && (
        <p style={{ color: '#c03020', fontStyle: 'italic', margin: '4px 0 12px' }}>
          ⚔ Кровь стучит в висках. Мирные слова не идут на язык.
        </p>
      )}
      {odysseus.shadow >= 20 && (
        <p style={{ color: '#8060a8', fontStyle: 'italic', margin: '4px 0 12px' }}>
          ☽ Краем глаза ты видишь тех, кого здесь нет. Они слушают твой выбор.
        </p>
      )}

      <div className="choices-grid">
        {activeEvent.choices.map(choice => {
          const locked = isChoiceLocked(choice, odysseus.metis, resources.food, resources.gold, odysseus.anger, flags)
          return (
            <button
              key={choice.id}
              className={`choice-card tone-${choice.tone ?? 'neutral'}`}
              disabled={!!locked}
              onClick={() => makeChoice(choice)}
            >
              <span className="choice-text">
                {athenaHint === choice.id && !locked ? '🪶 ' : ''}{choice.text}
              </span>
              {choice.subtext && <span className="choice-subtext">{choice.subtext}</span>}
              {locked && <span className="choice-locked">⚔ {locked}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
