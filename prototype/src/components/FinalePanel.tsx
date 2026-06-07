import { useGameStore } from '../store/gameStore'

export function FinalePanel() {
  const { resources, crewTrust, athenaFavor, makeFinalChoice } = useGameStore()

  const hasEnoughFood = resources.food >= 5
  const hasEnoughTrust = crewTrust >= 40
  const hasEnoughAthena = athenaFavor >= 20
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
        <p className={`finale-condition ${hasEnoughFood ? 'met' : 'unmet'}`}>
          {hasEnoughFood ? '✓' : '✗'} Провизия: {resources.food}/5 мешков
        </p>
        <p className={`finale-condition ${hasEnoughTrust ? 'met' : 'unmet'}`}>
          {hasEnoughTrust ? '✓' : '✗'} Доверие команды: {crewTrust}%/40%
        </p>
        <p className={`finale-condition ${hasEnoughAthena ? 'met' : 'unmet'}`}>
          {hasEnoughAthena ? '✓' : '✗'} Благосклонность Афины: {athenaFavor}/20
        </p>
      </div>

      <div className="finale-choices">
        <button className="btn" onClick={() => makeFinalChoice('sail')} style={{ width: '100%' }}>
          Отплыть немедленно
          <br />
          <small style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            {hasEnoughFood && hasEnoughTrust ? 'Безопасно' : '⚠ Рискованно без достаточных ресурсов'}
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
      </div>
    </div>
  )
}
