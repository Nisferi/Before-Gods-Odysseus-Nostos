import './App.css'
import { useGameStore } from './store/gameStore'
import { MainMenu } from './components/MainMenu'
import { HUD } from './components/HUD'
import { LocationScreen } from './components/LocationScreen'
import { EventPanel } from './components/EventPanel'
import { EventResult } from './components/EventResult'
import { BossPanel } from './components/BossPanel'
import { ShipHub } from './components/ShipHub'
import { FinalePanel } from './components/FinalePanel'
import { RunEnd } from './components/RunEnd'

export default function App() {
  const phase = useGameStore(s => s.phase)

  if (phase === 'menu') return <MainMenu />

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
