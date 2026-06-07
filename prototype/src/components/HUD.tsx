import { useGameStore } from '../store/gameStore'

export function HUD() {
  const { odysseus, resources, crewTrust, athenaFavor, dcs, phase } = useGameStore()
  if (phase === 'menu') return null

  return (
    <div className="hud">
      <div className="hud-stat">
        <span className="hud-label">Здоровье</span>
        <span className="hud-value">{odysseus.hp}/{odysseus.maxHp}</span>
        <div className="bar-wrap">
          <div className="bar-fill bar-hp" style={{ width: `${(odysseus.hp / odysseus.maxHp) * 100}%` }} />
        </div>
      </div>

      <div className="hud-stat">
        <span className="hud-label">Метис</span>
        <div className="metis-pips">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`metis-pip${i < odysseus.metis ? ' filled' : ''}`} />
          ))}
        </div>
      </div>

      <div className="hud-stat">
        <span className="hud-label">Команда</span>
        <span className="hud-value">{crewTrust}%</span>
        <div className="bar-wrap">
          <div className="bar-fill bar-trust" style={{ width: `${crewTrust}%` }} />
        </div>
      </div>

      <div className="hud-stat">
        <span className="hud-label">Афина</span>
        <span className="hud-value">{athenaFavor}</span>
        <div className="bar-wrap">
          <div className="bar-fill bar-athena" style={{ width: `${athenaFavor}%` }} />
        </div>
      </div>

      <div className="hud-stat" style={{ minWidth: 90 }}>
        <span className="hud-label">DCS</span>
        <span className="hud-value">{dcs}</span>
        <div className="bar-wrap" style={{ width: 80 }}>
          <div className="bar-fill bar-dcs" style={{ width: `${dcs}%` }} />
        </div>
      </div>

      <div className="hud-resources">
        <div className={`res-item${resources.food < 3 ? ' low' : ''}`}>
          <span className="res-icon">🌾</span>
          <span className="res-count">{resources.food}</span>
        </div>
        <div className="res-item">
          <span className="res-icon">🪙</span>
          <span className="res-count">{resources.gold}</span>
        </div>
        {resources.iron > 0 && (
          <div className="res-item">
            <span className="res-icon">⚔️</span>
            <span className="res-count">{resources.iron}</span>
          </div>
        )}
        {resources.bronze > 0 && (
          <div className="res-item">
            <span className="res-icon">🔩</span>
            <span className="res-count">{resources.bronze}</span>
          </div>
        )}
      </div>
    </div>
  )
}
