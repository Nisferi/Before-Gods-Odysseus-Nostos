import { useGameStore } from '../store/gameStore'

export function RunEnd() {
  const { phase, odysseus, resources, crewTrust, athenaFavor, dcs, runNumber, resetGame, startGame } = useGameStore()
  const isVictory = phase === 'victory'

  return (
    <div className="end-screen">
      <h2 className={`end-title${isVictory ? '' : ' death'}`}>
        {isVictory ? 'Корабль отплыл' : 'Море взяло своё'}
      </h2>

      <p className="end-description">
        {isVictory
          ? 'Итака ждёт. Боги уходят — но ты ещё здесь. Путь продолжается. Каждое возвращение — это маленькая победа над забвением.'
          : 'Одиссей не добрался до берега. Но море помнит. В следующей попытке — другой маршрут, другие выборы, другая судьба.'}
      </p>

      <div className="end-stats">
        <div className="end-stat">🌾 {resources.food} провизии</div>
        <div className="end-stat">🪙 {resources.gold} золота</div>
        <div className="end-stat">👥 {crewTrust}% доверие</div>
        <div className="end-stat">⚡ {athenaFavor} Афина</div>
        <div className="end-stat">❤️ {odysseus.hp} HP</div>
        <div className="end-stat">📊 DCS {dcs}</div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={startGame}>
          Новый забег #{runNumber + 1}
        </button>
        <button className="btn btn-ghost" onClick={resetGame}>
          В главное меню
        </button>
      </div>
    </div>
  )
}
