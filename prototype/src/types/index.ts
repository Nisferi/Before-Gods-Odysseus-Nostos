export type GamePhase =
  | 'menu'
  | 'ship'
  | 'location'
  | 'exploration'
  | 'event'
  | 'event_result'
  | 'boss'
  | 'boss_result'
  | 'finale'
  | 'death'
  | 'victory'

export interface Resources {
  food: number
  gold: number
  bronze: number
  silver: number
  iron: number
}

export interface OdysseusStats {
  hp: number
  maxHp: number
  metis: number       // 0–5
  anger: number       // 0–100
  piety: number       // 0–100
  nostos: number      // 0–100
  glory: number       // 0–100
  shadow: number      // 0–100, связь с подземным миром
}

export interface CrewMember {
  id: string
  name: string
  role: string
  alive: boolean
  trust: number       // 0–100
}

export interface GameEffect {
  food?: number
  gold?: number
  bronze?: number
  silver?: number
  iron?: number
  hp?: number
  metis?: number
  anger?: number
  piety?: number
  nostos?: number
  glory?: number
  shadow?: number
  dcs?: number
  crewTrust?: number
  athenaFavor?: number
  poseidonWrath?: number
  setFlag?: string
  removeFlag?: string
  logMessage?: string
}

export interface Choice {
  id: string
  text: string
  subtext?: string
  requiresMetis?: number
  requiresFood?: number
  requiresGold?: number
  requiresFlag?: string
  blockedByFlag?: string
  effects: GameEffect
  result: string
  tone?: 'brave' | 'cunning' | 'pious' | 'ruthless' | 'wise' | 'neutral'
}

export interface GameEvent {
  id: string
  title: string
  description: string
  location: string
  act: number
  choices: Choice[]
  isFixed?: boolean
  weight?: number         // для случайного выбора из пула
  requiresFlag?: string
  blockedByFlag?: string
}

export interface BossPhase {
  id: string
  title: string
  description: string
  choices: Choice[]
}

export interface BossData {
  id: string
  name: string
  phases: BossPhase[]
}

export interface ChoiceResult {
  choiceText: string
  resultText: string
  effectSummary: string[]
}

export interface LogEntry {
  text: string
  type: 'event' | 'combat' | 'resource' | 'story' | 'divine'
}
