import { useGameStore } from '../store/gameStore'

export function LocationScreen() {
  const { completedEvents, startExploration, goToLocation, goToShip } = useGameStore()
  const eventsCount = completedEvents.length
  const canFight = eventsCount >= 3

  return (
    <div className="location-screen">
      <p className="location-name">Акт I</p>
      <h2 className="location-title">Берег Трои</h2>
      <p className="location-description">
        Пепел, обломки кораблей и запах войны. Троя ещё горит на горизонте.
        Твоя команда ждёт приказа. Море ждёт чего-то другого.
      </p>

      <p className="location-progress">
        Событий исследовано: {eventsCount} · {canFight ? 'Тень Гектора ждёт' : 'Исследуй дальше'}
      </p>

      <div className="location-actions">
        <button className="btn btn-primary" onClick={startExploration}>
          Исследовать берег
        </button>
        <button className="btn btn-secondary" onClick={goToLocation}>
          Случайное событие
        </button>
        <button className="btn btn-ghost" onClick={goToShip}>
          Вернуться на корабль
        </button>
      </div>
    </div>
  )
}
