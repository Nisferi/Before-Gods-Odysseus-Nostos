import { useGameStore } from '../store/gameStore'

const dcsStatus = (dcs: number) => {
  if (dcs >= 80) return 'Боги ещё слышат молитвы'
  if (dcs >= 50) return 'Храмы спорят, боги молчат'
  if (dcs >= 25) return 'Люди больше не верят дворцам'
  if (dcs >= 1)  return 'Все требуют еду, железо, людей'
  return 'Старый мир умер'
}

export function ShipHub() {
  const { crew, crewTrust, resources, dcs, odysseus, log, goToLocation, bossDefeated } = useGameStore()

  return (
    <div className="ship-screen">
      <h2 className="ship-title">Чёрный корабль</h2>

      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '16px 20px' }}>
        <p className="dcs-title">Божественный стандарт (DCS)</p>
        <div className="dcs-bar-wrap">
          <div className="dcs-bar-fill" style={{ width: `${dcs}%` }} />
        </div>
        <p className="dcs-status">{dcs} · {dcsStatus(dcs)}</p>
      </div>

      <div className="ship-grid">
        <div className="ship-section">
          <h3>Команда · Доверие {crewTrust}%</h3>
          <div className="crew-list">
            {crew.filter(m => m.alive).map(member => (
              <div key={member.id} className="crew-member">
                <div>
                  <div className="crew-name">{member.name}</div>
                  <div className="crew-role">{member.role}</div>
                </div>
                <div className="crew-trust-bar">
                  <div className="crew-trust-fill" style={{ width: `${member.trust}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ship-section">
          <h3>Трюм</h3>
          <div className="resource-list">
            <div className="resource-row">
              <span className="resource-name">🌾 Провизия</span>
              <span className={`resource-value${resources.food < 3 ? ' critical' : ''}`}>
                {resources.food} {resources.food < 3 && '⚠'}
              </span>
            </div>
            <div className="resource-row">
              <span className="resource-name">🪙 Золото</span>
              <span className="resource-value">{resources.gold}</span>
            </div>
            <div className="resource-row">
              <span className="resource-name">🔩 Бронза</span>
              <span className="resource-value">{resources.bronze}</span>
            </div>
            <div className="resource-row">
              <span className="resource-name">⚔️ Железо</span>
              <span className="resource-value">{resources.iron}</span>
            </div>
            <div className="resource-row">
              <span className="resource-name">🔮 Метис</span>
              <span className="resource-value">{odysseus.metis}/5</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ship-section">
        <h3>Параметры Одиссея</h3>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Ностос', value: odysseus.nostos },
            { label: 'Слава', value: odysseus.glory },
            { label: 'Гнев', value: odysseus.anger },
            { label: 'Благочестие', value: odysseus.piety },
            { label: 'Тень', value: odysseus.shadow },
          ].map(stat => (
            <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Cinzel,serif', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {stat.label}
              </span>
              <span style={{ fontSize: 18, fontFamily: 'Cinzel,serif', color: 'var(--gold)' }}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {log.length > 0 && (
        <div className="ship-section">
          <h3>Хроника</h3>
          <div className="game-log">
            {[...log].reverse().map((entry, i) => (
              <p key={i} className={`log-entry ${entry.type}`}>{entry.text}</p>
            ))}
          </div>
        </div>
      )}

      <div className="ship-actions">
        <button className="btn btn-primary" onClick={goToLocation}>
          {bossDefeated ? 'К финальному выбору' : 'Выйти на берег'}
        </button>
      </div>
    </div>
  )
}
