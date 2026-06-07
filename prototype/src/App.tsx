import './App.css'
import { useCallback } from 'react'
import { useGameStore } from './store/gameStore'
import { MainMenu } from './components/MainMenu'
import { HUD } from './components/HUD'
import { LocationScreen } from './components/LocationScreen'
import { GameCanvas } from './components/GameCanvas'
import { EventPanel } from './components/EventPanel'
import { EventResult } from './components/EventResult'
import { BossPanel } from './components/BossPanel'
import { ShipHub } from './components/ShipHub'
import { FinalePanel } from './components/FinalePanel'
import { RunEnd } from './components/RunEnd'

export default function App() {
  const phase = useGameStore(s => s.phase)
  const goToShip = useGameStore(s => s.goToShip)
  const triggerEventById = useGameStore(s => s.triggerEventById)

  const handleExploreExit = useCallback(() => goToShip(), [goToShip])
  const handleTriggerEvent = useCallback((id: string) => triggerEventById(id), [triggerEventById])

  if (phase === 'menu') return <MainMenu />

  if (phase === 'exploration') {
    return (
      <div className="game-wrapper" style={{ padding: 0 }}>
        <HUD />
        <GameCanvas onExit={handleExploreExit} onTriggerEvent={handleTriggerEvent} />
      </div>
    )
  }

  return (
    <div className="game-wrapper">
      <HUD />
      <div style={{ flex: 1 }}>
        {phase === 'ship'         && <ShipHub />}
        {phase === 'location'     && <LocationScreen />}
        {phase === 'event'        && <EventPanel />}
        {phase === 'event_result' && <EventResult />}
        {phase === 'boss'         && <BossPanel />}
        {phase === 'boss_result'  && <BossPanel />}
        {phase === 'finale'       && <FinalePanel />}
        {(phase === 'death' || phase === 'victory') && <RunEnd />}
      </div>
    </div>
  )
}
