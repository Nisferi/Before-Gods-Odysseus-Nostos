import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { loadMeta } from '../store/meta'

export function RunEnd() {
  const { phase, odysseus, resources, crewTrust, athenaFavor, dcs, runNumber, resetGame, startGame, commitRun } = useGameStore()
  const isVictory = phase === 'victory'

  // Persist the world exactly once when this screen appears.
  const committed = useRef(false)
  useEffect(() => {
    if (committed.current) return
    committed.current = true
    commitRun(isVictory ? 'victory' : 'death')
  }, [commitRun, isVictory])

  const meta = loadMeta()

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

      <div style={{ margin: '18px 0', padding: '14px 18px', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
        <p style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', fontFamily: 'Cinzel,serif', marginBottom: 8 }}>
          Мир помнит
        </p>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: 13 }}>
          <span>Путей пройдено: <b style={{ color: 'var(--gold)' }}>{meta.runs}</b></span>
          <span>Гибелей: <b style={{ color: 'var(--gold)' }}>{meta.deaths}</b></span>
          <span>Отплытий: <b style={{ color: 'var(--gold)' }}>{meta.victories}</b></span>
          <span>Лучший Ностос: <b style={{ color: 'var(--gold)' }}>{meta.bestNostos}</b></span>
          <span>DCS следующего пути: <b style={{ color: 'var(--gold)' }}>{meta.dcs}</b></span>
        </div>
        {Object.keys(meta.flags).length > 0 && (
          <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>
            Знание, унесённое из прошлых жизней: {Object.keys(meta.flags).length}
          </p>
        )}
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
