import { useGameStore } from '../store/gameStore'

const dcsStatus = (dcs: number) => {
  if (dcs >= 80) return 'Боги ещё слышат молитвы'
  if (dcs >= 50) return 'Храмы спорят, боги молчат'
  if (dcs >= 25) return 'Люди больше не верят дворцам'
  if (dcs >= 1)  return 'Все требуют еду, медь, людей'
  return 'Старый мир умер'
}

interface CrewAction {
  label: string
  detail: string
  /** null when available, otherwise why it is not */
  blocked: (s: ReturnType<typeof useGameStore.getState>, trust: number) => string | null
}

const CREW_ACTIONS: Record<string, CrewAction> = {
  eurylochus: {
    label: 'Спросить о готовности',
    detail: 'Честная оценка: чего не хватает для отплытия',
    blocked: () => null,
  },
  polites: {
    label: 'Разведать берег',
    detail: '+1 провизия, +2 доверие',
    blocked: (_s, trust) => (trust < 40 ? 'Нужно его доверие 40' : null),
  },
  kyros: {
    label: 'Просмолить корпус',
    detail: '−1 смола · корабль станет мореходным',
    blocked: s => (s.flags.hull_sealed ? 'Корпус уже просмолён' : s.resources.pitch < 1 ? 'Нужна смола' : null),
  },
  aed: {
    label: 'Спеть о доме',
    detail: '+8 доверие команды, +3 Ностос',
    blocked: (_s, trust) => (trust < 35 ? 'Нужно его доверие 35' : null),
  },
  smith: {
    label: 'Переплавить олово',
    detail: '−1 олово → +2 бронзы',
    blocked: s => (s.resources.tin < 1 ? 'Нужно олово' : null),
  },
}

export function ShipHub() {
  const { crew, crewTrust, resources, dcs, odysseus, log, goToLocation, bossDefeated,
          daysElapsed, crewActionDay, flags, useCrewAction } = useGameStore()

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
          <h3>Команда · Доверие {crewTrust}% · День {daysElapsed}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
            Каждый может сделать одно дело за день. День проходит при выходе на берег.
          </p>
          <div className="crew-list">
            {crew.filter(m => m.alive).map(member => {
              const action = CREW_ACTIONS[member.id]
              const usedToday = crewActionDay[member.id] === daysElapsed
              const reason = action?.blocked(useGameStore.getState(), member.trust) ?? null
              const disabled = usedToday || !!reason
              return (
                <div key={member.id} className="crew-member" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ minWidth: 150 }}>
                    <div className="crew-name">{member.name}</div>
                    <div className="crew-role">{member.role}</div>
                  </div>
                  <div className="crew-trust-bar">
                    <div className="crew-trust-fill" style={{ width: `${member.trust}%` }} />
                  </div>
                  {action && (
                    <button
                      className="btn btn-ghost"
                      disabled={disabled}
                      onClick={() => useCrewAction(member.id)}
                      style={{ fontSize: 12, padding: '6px 12px', flexBasis: '100%' }}
                      title={usedToday ? 'Уже занят сегодня' : reason ?? action.detail}
                    >
                      {action.label}
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)' }}>
                        {usedToday ? 'Уже занят сегодня' : reason ?? action.detail}
                      </span>
                    </button>
                  )}
                </div>
              )
            })}
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
              <span className="resource-name">🔥 Смола</span>
              <span className={`resource-value${!flags.hull_sealed && resources.pitch < 1 ? ' critical' : ''}`}>
                {resources.pitch}
              </span>
            </div>
            <div className="resource-row">
              <span className="resource-name">⚓ Корпус</span>
              <span className={`resource-value${flags.hull_sealed ? '' : ' critical'}`}>
                {flags.hull_sealed ? 'просмолён' : 'течёт ⚠'}
              </span>
            </div>
            <div className="resource-row">
              <span className="resource-name">⚰️ Олово</span>
              <span className="resource-value">{resources.tin}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ship-section">
        <h3>Параметры Одиссея</h3>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Ностос', value: odysseus.nostos },
            { label: 'Метис', value: `${odysseus.metis}/5` },
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
