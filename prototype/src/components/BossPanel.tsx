import { useGameStore } from '../store/gameStore'
import type { Choice } from '../types'

function isChoiceLocked(choice: Choice, metis: number, food: number, gold: number): string | null {
  if (choice.requiresMetis !== undefined && metis < choice.requiresMetis) {
    return `Требует Метис ${choice.requiresMetis}`
  }
  if (choice.requiresFood !== undefined && food < choice.requiresFood) {
    return `Нужно ${choice.requiresFood} провизии`
  }
  if (choice.requiresGold !== undefined && gold < choice.requiresGold) {
    return `Нужно ${choice.requiresGold} золота`
  }
  return null
}

export function BossPanel() {
  const { activeBossPhase, activeBoss, odysseus, resources, choiceResult, makeBossChoice, continueBossPhase } = useGameStore()

  if (!activeBossPhase || !activeBoss) return null

  if (choiceResult) {
    return (
      <div className="boss-screen">
        <p className="boss-tag">⚔ Столкновение</p>
        <p className="result-chosen">Ты выбрал: «{choiceResult.choiceText}»</p>
        <p className="result-text" style={{ marginBottom: 20 }}>{choiceResult.resultText}</p>

        {choiceResult.effectSummary.length > 0 && (
          <div className="result-effects" style={{ marginBottom: 20 }}>
            {choiceResult.effectSummary.map((e, i) => (
              <span key={i} className={`effect-tag${e.startsWith('-') ? ' negative' : ''}`}>
                {e}
              </span>
            ))}
          </div>
        )}

        <button className="btn btn-primary" onClick={continueBossPhase}>
          Продолжить
        </button>
      </div>
    )
  }

  return (
    <div className="boss-screen">
      <p className="boss-tag">⚔ {activeBoss.name}</p>
      <h2 className="boss-title">{activeBossPhase.title}</h2>
      <p className="boss-description">{activeBossPhase.description}</p>

      <div className="choices-grid" style={{ marginTop: 8 }}>
        {activeBossPhase.choices.map(choice => {
          const locked = isChoiceLocked(choice, odysseus.metis, resources.food, resources.gold)
          return (
            <button
              key={choice.id}
              className={`choice-card tone-${choice.tone ?? 'neutral'}`}
              disabled={!!locked}
              onClick={() => makeBossChoice(choice)}
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
