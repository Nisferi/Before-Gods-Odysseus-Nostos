import { useGameStore } from '../store/gameStore'

export function MainMenu() {
  const startGame = useGameStore(s => s.startGame)

  return (
    <div className="menu-screen">
      <div>
        <p className="menu-subtitle">Before Gods</p>
        <h1 className="menu-title">Odysseus' Nostos</h1>
      </div>

      <div className="menu-divider" />

      <p className="menu-description">
        1200 год до н.э. Троя пала. Боги уходят. Море не хочет возвращать людей домой.
        <br /><br />
        Сражайся, лги, торгуйся с богами. Веди команду через голод, проклятия и распад мира.
        Каждый выбор приближает Итаку — или превращает тебя в чудовище, достойное собственных мифов.
      </p>

      <div className="menu-divider" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={startGame}>
          Начать путь
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>
          Акт I · Берег Трои · Вертикальный срез
        </p>
      </div>
    </div>
  )
}
