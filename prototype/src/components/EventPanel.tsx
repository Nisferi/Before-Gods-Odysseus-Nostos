import { useGameStore } from '../store/gameStore'
import type { Choice } from '../types'

function isChoiceLocked(choice: Choice, metis: number, food: number, gold: number, flags: Record<string, boolean>): string | null {
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
  const { activeEvent, odysseus, resources, flags, makeChoice } = useGameStore()

  if (!activeEvent) return null

  return (
    <div className="event-screen">
      <p className="event-location-tag">Берег Трои · Акт I</p>
      <h2 className="event-title">{activeEvent.title}</h2>
      <p className="event-description">{activeEvent.description}</p>

      <div className="choices-grid">
        {activeEvent.choices.map(choice => {
          const locked = isChoiceLocked(choice, odysseus.metis, resources.food, resources.gold, flags)
          return (
            <button
              key={choice.id}
              className={`choice-card tone-${choice.tone ?? 'neutral'}`}
              disabled={!!locked}
              onClick={() => makeChoice(choice)}
            >
              <span className="choice-text">{choice.text}</span>
              {choice.subtext && <span className="choice-subtext">{choice.subtext}</span>}
              {locked && <span className="choice-locked">⚔ {locked}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
