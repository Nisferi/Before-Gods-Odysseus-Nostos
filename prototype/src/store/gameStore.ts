import { create } from 'zustand'
import type {
  GamePhase, OdysseusStats, Resources, CrewMember,
  GameEvent, BossData, BossPhase, Choice, ChoiceResult, LogEntry
} from '../types'
import { act1Events } from '../data/events'
import { shadowOfHector, poseidonMessenger } from '../data/boss'
import { initialCrew } from '../data/crew'
import { loadMeta, saveMeta, worldFlagsOnly } from './meta'

interface GameState {
  phase: GamePhase
  runNumber: number
  daysElapsed: number

  odysseus: OdysseusStats
  resources: Resources
  crew: CrewMember[]
  crewTrust: number
  athenaFavor: number
  poseidonWrath: number
  dcs: number

  currentAct: number
  currentLocation: string
  completedEvents: string[]
  availableEvents: GameEvent[]
  bossPhase: number
  bossDefeated: boolean
  flags: Record<string, boolean>

  activeEvent: GameEvent | null
  activeBoss: BossData | null
  activeBossPhase: BossPhase | null
  choiceResult: ChoiceResult | null
  log: LogEntry[]

  fromExploration: boolean

  startGame: () => void
  goToLocation: () => void
  goToShip: () => void
  startExploration: () => void
  triggerNextEvent: () => void
  triggerEventById: (eventId: string) => void
  addPickup: (kind: 'food' | 'gold' | 'pitch') => void
  damagePlayer: (amount: number) => void
  endDuel: (won: boolean) => void
  commitRun: (outcome: 'death' | 'victory') => void
  makeChoice: (choice: Choice) => void
  continueAfterChoice: () => void
  startFinalBoss: () => void
  makeBossChoice: (choice: Choice) => void
  continueBossPhase: () => void
  makeFinalChoice: (choice: 'sail' | 'ritual' | 'talk') => void
  resetGame: () => void
}

const buildAvailableEvents = (completed: string[], flags: Record<string, boolean>): GameEvent[] => {
  return act1Events.filter(e => {
    if (e.isFixed) return false
    if (completed.includes(e.id)) return false
    if (e.requiresFlag && !flags[e.requiresFlag]) return false
    if (e.blockedByFlag && flags[e.blockedByFlag]) return false
    return true
  })
}

const pickRandomEvent = (pool: GameEvent[]): GameEvent | null => {
  if (pool.length === 0) return null
  const totalWeight = pool.reduce((sum, e) => sum + (e.weight ?? 1), 0)
  let roll = Math.random() * totalWeight
  for (const event of pool) {
    roll -= event.weight ?? 1
    if (roll <= 0) return event
  }
  return pool[pool.length - 1]
}

const applyEffectsToState = (
  state: GameState,
  choice: Choice
): Partial<GameState> => {
  const fx = choice.effects
  const newResources = { ...state.resources }
  if (fx.food !== undefined) newResources.food = Math.max(0, newResources.food + fx.food)
  if (fx.gold !== undefined) newResources.gold = Math.max(0, newResources.gold + fx.gold)
  if (fx.bronze !== undefined) newResources.bronze = Math.max(0, newResources.bronze + fx.bronze)
  if (fx.pitch !== undefined) newResources.pitch = Math.max(0, newResources.pitch + fx.pitch)
  if (fx.tin !== undefined) newResources.tin = Math.max(0, newResources.tin + fx.tin)

  const newOdysseus = { ...state.odysseus }
  if (fx.hp !== undefined) newOdysseus.hp = Math.max(0, Math.min(newOdysseus.maxHp, newOdysseus.hp + fx.hp))
  if (fx.metis !== undefined) newOdysseus.metis = Math.max(0, Math.min(5, newOdysseus.metis + fx.metis))
  if (fx.anger !== undefined) newOdysseus.anger = Math.max(0, Math.min(100, newOdysseus.anger + fx.anger))
  if (fx.piety !== undefined) newOdysseus.piety = Math.max(0, Math.min(100, newOdysseus.piety + fx.piety))
  if (fx.nostos !== undefined) newOdysseus.nostos = Math.max(0, Math.min(100, newOdysseus.nostos + fx.nostos))
  if (fx.glory !== undefined) newOdysseus.glory = Math.max(0, Math.min(100, newOdysseus.glory + fx.glory))
  if (fx.shadow !== undefined) newOdysseus.shadow = Math.max(0, Math.min(100, newOdysseus.shadow + fx.shadow))

  const newFlags = { ...state.flags }
  if (fx.setFlag) newFlags[fx.setFlag] = true
  if (fx.removeFlag) delete newFlags[fx.removeFlag]

  const effectSummary: string[] = []
  if (fx.food && fx.food > 0) effectSummary.push(`+${fx.food} провизии`)
  if (fx.food && fx.food < 0) effectSummary.push(`${fx.food} провизии`)
  if (fx.gold && fx.gold > 0) effectSummary.push(`+${fx.gold} золота`)
  if (fx.gold && fx.gold < 0) effectSummary.push(`${fx.gold} золота`)
  if (fx.pitch && fx.pitch > 0) effectSummary.push(`+${fx.pitch} смолы`)
  if (fx.pitch && fx.pitch < 0) effectSummary.push(`${fx.pitch} смолы`)
  if (fx.tin && fx.tin > 0) effectSummary.push(`+${fx.tin} олова`)
  if (fx.tin && fx.tin < 0) effectSummary.push(`${fx.tin} олова`)
  if (fx.hp && fx.hp < 0) effectSummary.push(`${fx.hp} здоровья`)
  if (fx.hp && fx.hp > 0) effectSummary.push(`+${fx.hp} здоровья`)
  if (fx.metis && fx.metis > 0) effectSummary.push(`+${fx.metis} Метис`)
  if (fx.dcs && fx.dcs > 0) effectSummary.push(`+${fx.dcs} DCS`)
  if (fx.dcs && fx.dcs < 0) effectSummary.push(`${fx.dcs} DCS`)
  if (fx.crewTrust && fx.crewTrust > 0) effectSummary.push(`+${fx.crewTrust} доверие команды`)
  if (fx.crewTrust && fx.crewTrust < 0) effectSummary.push(`${fx.crewTrust} доверие команды`)
  if (fx.athenaFavor && fx.athenaFavor > 0) effectSummary.push(`+${fx.athenaFavor} Афина`)
  if (fx.athenaFavor && fx.athenaFavor < 0) effectSummary.push(`${fx.athenaFavor} Афина`)
  if (fx.piety && fx.piety > 0) effectSummary.push(`+${fx.piety} благочестие`)

  const newLog: LogEntry[] = [...state.log]
  if (fx.logMessage) {
    newLog.push({ text: fx.logMessage, type: 'event' })
  }

  return {
    resources: newResources,
    odysseus: newOdysseus,
    flags: newFlags,
    dcs: Math.max(0, Math.min(100, state.dcs + (fx.dcs ?? 0))),
    crewTrust: Math.max(0, Math.min(100, state.crewTrust + (fx.crewTrust ?? 0))),
    athenaFavor: Math.max(0, Math.min(100, state.athenaFavor + (fx.athenaFavor ?? 0))),
    poseidonWrath: Math.max(0, Math.min(100, state.poseidonWrath + (fx.poseidonWrath ?? 0))),
    choiceResult: { choiceText: choice.text, resultText: choice.result, effectSummary },
    log: newLog,
  }
}

const initialOdysseus: OdysseusStats = {
  hp: 100, maxHp: 100,
  metis: 2,
  anger: 0,
  piety: 10,
  nostos: 60,
  glory: 30,
  shadow: 0,
}

const initialResources: Resources = {
  food: 0, gold: 0, bronze: 5, pitch: 2, tin: 0,
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'menu',
  runNumber: 0,
  daysElapsed: 0,
  odysseus: initialOdysseus,
  resources: initialResources,
  crew: initialCrew,
  crewTrust: 35,
  athenaFavor: 10,
  poseidonWrath: 30,
  dcs: 85,
  currentAct: 1,
  currentLocation: 'troy_shore',
  completedEvents: [],
  availableEvents: [],
  bossPhase: 0,
  bossDefeated: false,
  flags: {},
  fromExploration: false,
  activeEvent: null,
  activeBoss: null,
  activeBossPhase: null,
  choiceResult: null,
  log: [{ text: 'Троя пала. Море ждёт.', type: 'story' }],

  startGame: () => {
    const state = get()
    const fixedEvent = act1Events.find(e => e.isFixed) ?? null
    // The world carries over between runs: DCS keeps falling, knowledge stays known.
    const meta = loadMeta()
    const carriedFlags = { ...meta.flags }
    const startLog: LogEntry[] = [{ text: 'Троя пала. Море ждёт.', type: 'story' }]
    if (meta.runs > 0) {
      startLog.push({
        text: `Путь ${meta.runs + 1}-й. Боги отступили ещё дальше — DCS ${meta.dcs}.`,
        type: 'divine',
      })
    }
    if (carriedFlags.knows_curse_details) {
      startLog.push({ text: 'Ты помнишь слова провидца из прошлой жизни.', type: 'divine' })
    }
    set({
      phase: fixedEvent ? 'event' : 'location',
      runNumber: state.runNumber + 1,
      daysElapsed: 0,
      odysseus: { ...initialOdysseus },
      resources: { ...initialResources },
      crew: initialCrew.map(m => ({ ...m })),
      crewTrust: 35,
      athenaFavor: 10,
      poseidonWrath: 30,
      dcs: meta.dcs,
      completedEvents: [],
      availableEvents: buildAvailableEvents([], carriedFlags),
      bossPhase: 0,
      bossDefeated: false,
      flags: carriedFlags,
      fromExploration: false,
      activeEvent: fixedEvent,
      activeBoss: null,
      activeBossPhase: null,
      choiceResult: null,
      log: startLog,
    })
    saveMeta({ ...meta, runs: meta.runs + 1 })
  },

  /** Persist world state when a run ends — the gods keep receding. */
  commitRun: (outcome: 'death' | 'victory') => {
    const state = get()
    const meta = loadMeta()
    const drop = outcome === 'death' ? 5 : 2
    saveMeta({
      ...meta,
      dcs: Math.max(0, state.dcs - drop),
      flags: { ...meta.flags, ...worldFlagsOnly(state.flags) },
      deaths: meta.deaths + (outcome === 'death' ? 1 : 0),
      victories: meta.victories + (outcome === 'victory' ? 1 : 0),
      bestNostos: Math.max(meta.bestNostos, state.odysseus.nostos),
    })
  },

  goToLocation: () => {
    const state = get()
    const pool = buildAvailableEvents(state.completedEvents, state.flags)
    const next = pickRandomEvent(pool)
    if (!next) {
      if (state.bossDefeated) {
        set({ phase: 'finale' })
      } else {
        set({ phase: 'duel', log: [...state.log, { text: 'Из пепла поднимается тень в горящем доспехе…', type: 'combat' }] })
      }
      return
    }
    set({ phase: 'event', activeEvent: next, choiceResult: null })
  },

  addPickup: (kind) => {
    const state = get()
    set({ resources: { ...state.resources, [kind]: state.resources[kind] + 1 } })
  },

  damagePlayer: (amount) => {
    const state = get()
    const hp = Math.max(0, state.odysseus.hp - amount)
    set({ odysseus: { ...state.odysseus, hp } })
    if (hp <= 0) set({ phase: 'death', log: [...state.log, { text: 'Одиссей пал на берегу Трои.', type: 'combat' }] })
  },

  /** Resolves whichever canvas fight is currently running. */
  endDuel: (won) => {
    const state = get()
    const isMessenger = state.phase === 'duel2'
    if (!won) {
      set({
        phase: 'death',
        log: [...state.log, {
          text: isMessenger ? 'Море сомкнулось над тобой.' : 'Тень Гектора оказалась сильнее.',
          type: 'combat',
        }],
      })
      return
    }
    if (isMessenger) {
      // The sea does not forgive, but it withdraws when it has taken enough.
      set({
        phase: 'finale',
        bossDefeated: true,
        activeBoss: null,
        activeBossPhase: null,
        choiceResult: null,
        poseidonWrath: Math.min(100, state.poseidonWrath + 10),
        odysseus: { ...state.odysseus, glory: Math.min(100, state.odysseus.glory + 15) },
        log: [...state.log, { text: 'Посланник рассыпался пеной. Посейдон запомнил и это.', type: 'divine' }],
      })
      return
    }
    set({
      phase: 'boss',
      activeBoss: shadowOfHector,
      activeBossPhase: shadowOfHector.phases[1],
      bossPhase: 1,
      choiceResult: null,
      log: [...state.log, { text: 'Тень Гектора повержена в бою. Она ждёт твоего слова.', type: 'combat' }],
    })
  },

  goToShip: () => set({ phase: 'ship', activeEvent: null, choiceResult: null }),

  startExploration: () => {
    const state = get()
    set({ phase: 'exploration', fromExploration: false, daysElapsed: state.daysElapsed + 1 })
  },

  triggerEventById: (eventId: string) => {
    const event = act1Events.find(e => e.id === eventId) ?? null
    if (!event) return
    set({ phase: 'event', activeEvent: event, choiceResult: null, fromExploration: true })
  },

  triggerNextEvent: () => {
    const state = get()
    const pool = buildAvailableEvents(state.completedEvents, state.flags)
    const next = pickRandomEvent(pool)
    if (!next) {
      if (state.bossDefeated) {
        set({ phase: 'finale' })
      } else {
        set({ phase: 'duel' })
      }
      return
    }
    set({ phase: 'event', activeEvent: next, choiceResult: null })
  },

  makeChoice: (choice: Choice) => {
    const state = get()
    const updates = applyEffectsToState(state, choice)
    const newCompleted = state.activeEvent
      ? [...state.completedEvents, state.activeEvent.id]
      : state.completedEvents

    set({ ...updates, completedEvents: newCompleted, phase: 'event_result' })

    if (get().odysseus.hp <= 0 || get().crewTrust <= 0) {
      set({ phase: 'death' })
    }
  },

  continueAfterChoice: () => {
    const state = get()
    const foodCost = Math.max(1, Math.ceil(state.crew.filter(m => m.alive).length / 2))
    const newFood = Math.max(0, state.resources.food - foodCost)
    const foodLow = newFood < 3
    set({
      choiceResult: null,
      activeEvent: null,
      resources: { ...state.resources, food: newFood },
      crewTrust: foodLow ? Math.max(0, state.crewTrust - 10) : state.crewTrust,
      daysElapsed: state.daysElapsed + 1,
    })
    if (state.fromExploration) {
      set({ phase: 'exploration', fromExploration: false })
      return
    }
    const pool = buildAvailableEvents(state.completedEvents, state.flags)
    if (pool.length === 0 && !state.bossDefeated) {
      set({ phase: 'duel' })
    } else {
      set({ phase: 'location' })
    }
  },

  startFinalBoss: () => {
    set({
      phase: 'boss',
      activeBoss: poseidonMessenger,
      activeBossPhase: poseidonMessenger.phases[0],
      bossPhase: 0,
    })
  },

  makeBossChoice: (choice: Choice) => {
    const state = get()
    // Meeting the Messenger head-on is fought on the shore, not resolved in text.
    if (state.activeBoss?.id === 'poseidon_messenger' && choice.id === 'fight_force') {
      set({
        phase: 'duel2',
        choiceResult: null,
        log: [...state.log, { text: 'Ты пошёл навстречу волне.', type: 'combat' }],
      })
      return
    }
    const updates = applyEffectsToState(state, choice)
    set({ ...updates, phase: 'boss_result' })
    if (get().odysseus.hp <= 0) {
      set({ phase: 'death' })
    }
  },

  continueBossPhase: () => {
    const state = get()
    const boss = state.activeBoss
    if (!boss) return
    const nextPhaseIdx = state.bossPhase + 1
    if (nextPhaseIdx < boss.phases.length) {
      set({
        bossPhase: nextPhaseIdx,
        activeBossPhase: boss.phases[nextPhaseIdx],
        choiceResult: null,
        phase: 'boss',
      })
    } else {
      if (boss.id === 'shadow_hector') {
        set({
          bossDefeated: false,
          choiceResult: null,
          phase: 'boss',
          activeBoss: poseidonMessenger,
          activeBossPhase: poseidonMessenger.phases[0],
          bossPhase: 0,
          log: [...state.log, { text: 'Тень Гектора рассеялась. Но море ещё не успокоилось.', type: 'combat' }],
        })
      } else {
        set({
          bossDefeated: true,
          choiceResult: null,
          phase: 'finale',
          log: [...state.log, { text: 'Посланник Посейдона отступил в глубину.', type: 'divine' }],
        })
      }
    }
  },

  makeFinalChoice: (choice) => {
    const state = get()
    const { resources, crewTrust, athenaFavor } = state
    const goodEnding = resources.food >= 5 && crewTrust >= 40 && athenaFavor >= 20
    const badEnding = resources.food < 3 || crewTrust < 30

    if (choice === 'sail') {
      if (badEnding) {
        set({ phase: 'death', log: [...state.log, { text: 'Корабль ушёл в шторм. Море не простило.', type: 'story' }] })
      } else {
        set({ phase: 'victory', log: [...state.log, { text: 'Корабль отплыл. Итака ждёт.', type: 'story' }] })
      }
    } else if (choice === 'ritual') {
      if (resources.food >= 2 && resources.gold >= 2) {
        set({
          phase: 'victory',
          resources: { ...resources, food: resources.food - 2, gold: resources.gold - 2 },
          athenaFavor: Math.min(100, athenaFavor + 15),
          log: [...state.log, { text: 'Ритуал совершён. Афина приняла жертву. Корабль отплыл.', type: 'divine' }],
        })
      } else {
        set({ phase: goodEnding ? 'victory' : 'death' })
      }
    } else {
      if (crewTrust >= 50) {
        set({
          phase: 'victory',
          crewTrust: Math.min(100, crewTrust + 15),
          log: [...state.log, { text: 'Ты поговорил с командой. Они верят тебе. Корабль отплыл.', type: 'story' }],
        })
      } else {
        set({ phase: goodEnding ? 'victory' : 'death' })
      }
    }
  },

  resetGame: () => set({
    phase: 'menu',
    fromExploration: false,
    daysElapsed: 0,
    odysseus: { ...initialOdysseus },
    resources: { ...initialResources },
    crew: initialCrew.map(m => ({ ...m })),
    crewTrust: 35,
    athenaFavor: 10,
    poseidonWrath: 30,
    dcs: 85,
    completedEvents: [],
    availableEvents: [],
    bossPhase: 0,
    bossDefeated: false,
    flags: {},
    activeEvent: null,
    activeBoss: null,
    activeBossPhase: null,
    choiceResult: null,
    log: [],
  }),
}))
