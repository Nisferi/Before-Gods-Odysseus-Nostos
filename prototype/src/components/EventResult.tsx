import { useGameStore } from '../store/gameStore'

export function EventResult() {
  const { choiceResult, continueAfterChoice } = useGameStore()
  if (!choiceResult) return null

  return (
    <div className="result-panel">
      <p className="result-chosen">Ты выбрал: «{choiceResult.choiceText}»</p>
      <p className="result-text">{choiceResult.resultText}</p>

      {choiceResult.effectSummary.length > 0 && (
        <div className="result-effects">
          {choiceResult.effectSummary.map((e, i) => (
            <span key={i} className={`effect-tag${e.startsWith('-') || e.startsWith('−') ? ' negative' : ''}`}>
              {e}
            </span>
          ))}
        </div>
      )}

      <div>
        <button className="btn btn-primary" onClick={continueAfterChoice}>
          Продолжить
        </button>
      </div>
    </div>
  )
}
