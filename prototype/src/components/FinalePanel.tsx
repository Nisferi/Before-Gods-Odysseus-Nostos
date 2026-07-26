import { useGameStore } from '../store/gameStore'

export function FinalePanel() {
  const { resources, crewTrust, athenaFavor, poseidonWrath, flags, makeFinalChoice, goToShip } = useGameStore()

  const sealed = !!flags.hull_sealed
  const hasFood = resources.food >= 3
  const hasTrust = crewTrust >= 30
  const stormy = poseidonWrath >= 50
  const seaworthy = sealed && hasFood && hasTrust
  // Athena, a loyal crew or deep stores are the three ways through an angry sea
  const stormAnswered = !stormy || athenaFavor >= 25 || crewTrust >= 60 || resources.food >= 6
  const canRitual = resources.food >= 2 && resources.gold >= 2
  const canTalk = crewTrust >= 50

  return (
    <div className="finale-screen">
      <h2 className="finale-title">Корабль готов</h2>

      <p className="finale-description">
        Море ждёт. Команда ждёт. Где-то за горизонтом — Итака.
        Посейдон ещё злится. Но выбор за тобой.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        <p className={`finale-condition ${sealed ? 'met' : 'unmet'}`}>
          {sealed ? '✓' : '✗'} Корпус: {sealed ? 'просмолён' : 'течёт — Кир просмолит за 1 смолу'}
        </p>
        <p className={`finale-condition ${hasFood ? 'met' : 'unmet'}`}>
          {hasFood ? '✓' : '✗'} Провизия: {resources.food}/3 мешка
        </p>
        <p className={`finale-condition ${hasTrust ? 'met' : 'unmet'}`}>
          {hasTrust ? '✓' : '✗'} Доверие команды: {crewTrust}%/30%
        </p>
        {stormy && (
          <p className={`finale-condition ${stormAnswered ? 'met' : 'unmet'}`}>
            {stormAnswered ? '✓' : '✗'} Посейдон в ярости ({poseidonWrath}) — нужна Афина 25,
            доверие 60% или 6 провизии
          </p>
        )}
      </div>

      <div className="finale-choices">
        <button className="btn" onClick={() => makeFinalChoice('sail')} style={{ width: '100%' }}>
          Отплыть немедленно
          <br />
          <small style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            {!seaworthy
              ? '⚠ Корабль не выйдет в море в таком состоянии'
              : stormAnswered ? 'Безопасно' : '⚠ Шторм за мысом'}
          </small>
        </button>

        <button
          className="btn"
          onClick={() => makeFinalChoice('ritual')}
          disabled={!canRitual}
          style={{ width: '100%' }}
        >
          Провести ритуал Афины
          <br />
          <small style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            {canRitual ? '−2 провизии, −2 золота | +Афина' : 'Нужно 2 еды и 2 золота'}
          </small>
        </button>

        <button
          className="btn"
          onClick={() => makeFinalChoice('talk')}
          disabled={!canTalk}
          style={{ width: '100%' }}
        >
          Поговорить с командой
          <br />
          <small style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            {canTalk ? '+15 доверия, лучший маршрут' : `Нужно ${50 - crewTrust}% больше доверия`}
          </small>
        </button>

        {/* Отплытие необратимо — пока корабль не готов, нужен путь назад */}
        <button className="btn btn-ghost" onClick={goToShip} style={{ width: '100%' }}>
          Вернуться на корабль
          <br />
          <small style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            {seaworthy ? 'Проверить трюм и команду перед отплытием' : '⚠ Здесь можно исправить то, чего не хватает'}
          </small>
        </button>
      </div>
    </div>
  )
}
