import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'

// ─── Constants ───────────────────────────────────────────────────────────────
const CW = 960, CH = 540
const GROUND_Y = 430
const GRAVITY = 1380
const JUMP_VEL = -590
const MOVE_SPD = 255
const COYOTE_MS = 110
const JUMP_BUF_MS = 100
const DASH_SPD = 760
const DASH_MS = 180
const DASH_CD_MS = 800
const ATK_MS = 260
const ATK_CD_MS = 430
const ATK_RANGE = 64
const ATK_DMG = 34
const INVULN_MS = 800
const MAX_PARTICLES = 350

// ─── Palette ─────────────────────────────────────────────────────────────────
const P = {
  skyStops: ['#030014', '#0a0530', '#1a0a44', '#2c0e3c', '#481408', '#6a2008'] as string[],
  moon: '#e8e0c8', moonGlow: 'rgba(232,224,200,0.10)',
  cityFill: '#0a0503', cityGlow: '#ff5510',
  ruinFill: '#120a06',
  seaTop: '#06122a', seaBot: '#020812', seaLine: '#0e2b48', moonPath: 'rgba(220,210,170,0.05)',
  gndTop: '#42300c', gnd: '#2c1e08', gndDark: '#1a1205', pebble: '#54400f',
  stoneA: '#1c1209', stoneB: '#2c1c0e', stoneC: '#3e2814', stoneHi: '#5c3e20',
  woodA: '#2a1608', woodB: '#3e220c', woodHi: '#583414',
  body: '#0d0805', gold: '#c8941a', goldHi: '#f0b840', goldDk: '#7e5a08',
  crimson: '#8a0a08', crimsonHi: '#c42018', skin: '#7a4e1e', blade: '#9a98a8', bladeHi: '#d8d8e8',
  fire0: '#ff5500', fire1: '#dd2200', fire2: '#ffaa00', fireCore: '#fff4d0',
  portal0: '#5020b0', portal1: '#9050e8', portalCore: '#d8b0ff',
  npcRobe: '#3a2a10', npcSkin: '#6a3e14',
  enemyRag: '#241408', enemyEye: '#ff3000', dogFur: '#1c1410',
  hector: '#100a08', hectorArmor: '#5a3a10', hectorFlame: '#ff4400',
  ghost: 'rgba(150,170,220,0.16)',
  uiBg: 'rgba(4,2,1,0.78)', uiBorder: '#c8941a', uiText: '#e0b860', uiDim: '#8a6830',
}

// ─── Types ───────────────────────────────────────────────────────────────────
type Facing = 1 | -1
interface Player {
  x: number; y: number; vx: number; vy: number
  facing: Facing; onGround: boolean; wasGround: boolean
  walkPhase: number; idlePhase: number; coyote: number; jumpBuf: number; landTimer: number
  dashT: number; dashCd: number; dashDir: Facing
  atkT: number; atkCd: number; invuln: number; flash: number
}
interface Enemy {
  id: string; kind: 'marauder' | 'dog'
  x: number; y: number; vx: number; homeX: number
  hp: number; maxHp: number; facing: Facing
  state: 'patrol' | 'chase' | 'windup' | 'strike' | 'dead'
  t: number; phase: number; flash: number; deadT: number
}
interface Hector {
  x: number; y: number; vx: number; vy: number; facing: Facing
  hp: number; maxHp: number
  state: 'enter' | 'approach' | 'tellLunge' | 'lunge' | 'tellSlam' | 'slam' | 'stagger' | 'dying'
  t: number; phase: number; flash: number
  waveX: number; waveActive: boolean; waveDir: Facing
}
interface Particle {
  x: number; y: number; vx: number; vy: number
  life: number; max: number; size: number; r: number; g: number; b: number; grav: number
}
interface Pickup { id: string; x: number; y: number; kind: 'food' | 'gold' | 'pitch'; got: boolean }
interface Platform { x: number; y: number; w: number; h: number; kind: 'stone' | 'wood' | 'crate' }
interface LevelObj {
  id: string; x: number; y: number; w: number; h: number
  kind: 'col' | 'fire' | 'body' | 'tent' | 'cave' | 'ship' | 'portal' | 'npc' | 'wall'
  label: string; eventId?: string; isShip?: boolean; npcId?: string; portalTo?: string
}

// ─── Level data ──────────────────────────────────────────────────────────────
const PLATS_TROY: Platform[] = [
  { x: 210,  y: 410, w: 80,  h: 20, kind: 'wood'  },
  { x: 700,  y: 378, w: 110, h: 22, kind: 'stone' },
  { x: 1510, y: 398, w: 88,  h: 32, kind: 'stone' },
  { x: 1542, y: 368, w: 88,  h: 30, kind: 'stone' },
  { x: 1574, y: 338, w: 88,  h: 30, kind: 'stone' },
  { x: 1606, y: 303, w: 245, h: 25, kind: 'stone' },
  { x: 2550, y: 402, w: 62,  h: 28, kind: 'crate' },
  { x: 2550, y: 374, w: 62,  h: 28, kind: 'crate' },
  { x: 3210, y: 390, w: 100, h: 40, kind: 'stone' },
  { x: 3840, y: 408, w: 210, h: 22, kind: 'wood'  },
  { x: 4060, y: 392, w: 190, h: 16, kind: 'wood'  },
  { x: 4250, y: 365, w: 300, h: 14, kind: 'wood'  },
]
const PICKUPS_TROY: Pickup[] = [
  { id: 'f1', x: 460,  y: GROUND_Y - 14, kind: 'food',  got: false },
  { id: 'g1', x: 745,  y: 378 - 14,      kind: 'gold',  got: false },
  { id: 'p1', x: 1255, y: GROUND_Y - 14, kind: 'pitch', got: false },
  { id: 'g2', x: 1700, y: 303 - 14,      kind: 'gold',  got: false },
  { id: 'p2', x: 2580, y: 374 - 14,      kind: 'pitch', got: false },
  { id: 'f2', x: 2980, y: GROUND_Y - 14, kind: 'food',  got: false },
  { id: 'g3', x: 3255, y: 390 - 14,      kind: 'gold',  got: false },
  { id: 'f3', x: 4140, y: 392 - 14,      kind: 'food',  got: false },
]
const OBJS_TROY: LevelObj[] = [
  { id: 'fire0',   x: 400,  y: GROUND_Y - 74, w: 26,  h: 74,  kind: 'fire',   label: '' },
  { id: 'kings',   x: 570,  y: GROUND_Y - 44, w: 105, h: 44,  kind: 'body',   label: 'Тела трёх царей',       eventId: 'three_dead_kings' },
  { id: 'col1',    x: 740,  y: GROUND_Y - 255,w: 58,  h: 255, kind: 'col',    label: '' },
  { id: 'col2',    x: 860,  y: GROUND_Y - 195,w: 46,  h: 195, kind: 'col',    label: '' },
  { id: 'wall1',   x: 960,  y: GROUND_Y - 130,w: 200, h: 130, kind: 'wall',   label: '' },
  { id: 'fire1',   x: 1140, y: GROUND_Y - 80, w: 28,  h: 80,  kind: 'fire',   label: '' },
  { id: 'col3',    x: 1648, y: GROUND_Y - 278,w: 66,  h: 278, kind: 'col',    label: 'Храм Аполлона',         eventId: 'apollo_temple' },
  { id: 'col4',    x: 1810, y: GROUND_Y - 238,w: 52,  h: 238, kind: 'col',    label: '' },
  { id: 'col5',    x: 1940, y: GROUND_Y - 262,w: 60,  h: 262, kind: 'col',    label: '' },
  { id: 'tent1',   x: 2270, y: GROUND_Y - 98, w: 135, h: 98,  kind: 'tent',   label: 'Финикийский торговец',  eventId: 'phoenician_trader' },
  { id: 'fire2',   x: 2490, y: GROUND_Y - 82, w: 28,  h: 82,  kind: 'fire',   label: '' },
  { id: 'deser',   x: 2720, y: GROUND_Y - 48, w: 68,  h: 48,  kind: 'body',   label: 'Дезертир',              eventId: 'deserter_encounter' },
  { id: 'fire3',   x: 3050, y: GROUND_Y - 80, w: 28,  h: 80,  kind: 'fire',   label: '' },
  { id: 'cave1',   x: 3280, y: GROUND_Y - 118,w: 100, h: 118, kind: 'cave',   label: 'Пещера провидца',       eventId: 'cave_of_seer' },
  { id: 'fire4',   x: 3760, y: GROUND_Y - 76, w: 26,  h: 76,  kind: 'fire',   label: '' },
  { id: 'ship1',   x: 4200, y: GROUND_Y - 178,w: 340, h: 178, kind: 'ship',   label: 'На корабль (E)',        isShip: true },
  { id: 'portal1', x: 4960, y: GROUND_Y - 118,w: 120, h: 118, kind: 'portal', label: 'Фракия (E)',            portalTo: 'thrace' },
]
const ENEMIES_TROY: Omit<Enemy, 'state' | 't' | 'phase' | 'flash' | 'deadT'>[] = [
  { id: 'dog1',  kind: 'dog',      x: 1330, y: GROUND_Y, vx: 0, homeX: 1330, hp: 40, maxHp: 40, facing: 1 },
  { id: 'mar1',  kind: 'marauder', x: 2120, y: GROUND_Y, vx: 0, homeX: 2120, hp: 70, maxHp: 70, facing: -1 },
  { id: 'dog2',  kind: 'dog',      x: 2940, y: GROUND_Y, vx: 0, homeX: 2940, hp: 40, maxHp: 40, facing: 1 },
  { id: 'mar2',  kind: 'marauder', x: 3560, y: GROUND_Y, vx: 0, homeX: 3560, hp: 70, maxHp: 70, facing: -1 },
]

const PLATS_THRACE: Platform[] = [
  { x: 280,  y: 398, w: 100, h: 32, kind: 'stone' },
  { x: 780,  y: 388, w: 85,  h: 20, kind: 'stone' },
  { x: 1650, y: 370, w: 200, h: 25, kind: 'stone' },
  { x: 1700, y: 345, w: 200, h: 25, kind: 'stone' },
  { x: 2100, y: 400, w: 90,  h: 30, kind: 'crate' },
]
const PICKUPS_THRACE: Pickup[] = [
  { id: 'tf1', x: 340,  y: GROUND_Y - 14, kind: 'food',  got: false },
  { id: 'tp1', x: 905,  y: GROUND_Y - 14, kind: 'pitch', got: false },
  { id: 'tg1', x: 1750, y: 345 - 14,      kind: 'gold',  got: false },
]
const OBJS_THRACE: LevelObj[] = [
  { id: 'npc-w',   x: 500,  y: GROUND_Y - 52, w: 54, h: 52, kind: 'npc',   label: 'Алексий (E)',          npcId: 'warrior_thrace' },
  { id: 'fire-t1', x: 360,  y: GROUND_Y - 75, w: 26, h: 75, kind: 'fire',  label: '' },
  { id: 'tent-t',  x: 760,  y: GROUND_Y - 92, w: 120,h: 92, kind: 'tent',  label: 'Лагерь фракийцев' },
  { id: 'fire-t2', x: 1080, y: GROUND_Y - 78, w: 28, h: 78, kind: 'fire',  label: '' },
  { id: 'npc-p',   x: 1300, y: GROUND_Y - 52, w: 54, h: 52, kind: 'npc',   label: 'Артемиса (E)',         npcId: 'priestess_thrace' },
  { id: 'col-t1',  x: 1680, y: GROUND_Y - 290,w: 60, h: 290,kind: 'col',   label: 'Святилище Деметры' },
  { id: 'col-t2',  x: 1810, y: GROUND_Y - 250,w: 50, h: 250,kind: 'col',   label: '' },
  { id: 'cave-t',  x: 2300, y: GROUND_Y - 110,w: 96, h: 110,kind: 'cave',  label: 'Тёмная пещера' },
  { id: 'portal2', x: 3450, y: GROUND_Y - 118,w: 120,h: 118,kind: 'portal',label: 'Берег Трои (E)',       portalTo: 'troy' },
]
const ENEMIES_THRACE: Omit<Enemy, 'state' | 't' | 'phase' | 'flash' | 'deadT'>[] = [
  { id: 'tdog1', kind: 'dog',      x: 960,  y: GROUND_Y, vx: 0, homeX: 960,  hp: 40, maxHp: 40, facing: 1 },
  { id: 'tmar1', kind: 'marauder', x: 1980, y: GROUND_Y, vx: 0, homeX: 1980, hp: 70, maxHp: 70, facing: -1 },
]

const NPCS: Record<string, { name: string; role: string; line: string }> = {
  warrior_thrace:   { name: 'Алексий',  role: 'Фракийский воин', line: 'Ахеец? Война закончилась, но море всё ещё гонит трупы на берег. Уходи, пока цел.' },
  priestess_thrace: { name: 'Артемиса', role: 'Жрица Деметры',   line: 'Боги уходят. Я чувствую это каждый рассвет. Но земля остаётся — и пшеница растёт.' },
}

const LOCATIONS = {
  troy:   { name: 'Берег Трои',   width: 5200, startX: 160, plats: PLATS_TROY,   pickups: PICKUPS_TROY,   objs: OBJS_TROY,   enemies: ENEMIES_TROY },
  thrace: { name: 'Берег Фракии', width: 3800, startX: 160, plats: PLATS_THRACE, pickups: PICKUPS_THRACE, objs: OBJS_THRACE, enemies: ENEMIES_THRACE },
} as const
type LocKey = keyof typeof LOCATIONS

// World state survives canvas remounts (event screens) within one run:
// collected pickups stay collected, slain enemies stay dead, position is kept.
const persist = {
  run: -1,
  loc: 'troy' as LocKey,
  x: LOCATIONS.troy.startX as number,
  got: new Set<string>(),
  dead: new Set<string>(),
}

// Duel arena
const DUEL_W = 1500
const PLATS_DUEL: Platform[] = [
  { x: 180,  y: 392, w: 110, h: 38, kind: 'stone' },
  { x: 1210, y: 392, w: 110, h: 38, kind: 'stone' },
]
const OBJS_DUEL: LevelObj[] = [
  { id: 'dcol1', x: 90,   y: GROUND_Y - 250, w: 54, h: 250, kind: 'col',  label: '' },
  { id: 'dcol2', x: 1356, y: GROUND_Y - 250, w: 54, h: 250, kind: 'col',  label: '' },
  { id: 'dfire1',x: 250,  y: GROUND_Y - 78,  w: 28, h: 78,  kind: 'fire', label: '' },
  { id: 'dfire2',x: 1222, y: GROUND_Y - 78,  w: 28, h: 78,  kind: 'fire', label: '' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}
// deterministic pseudo-random per index
const prand = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

// ─── Offscreen layer pre-render (performance) ────────────────────────────────
function makeSkyLayer(dcs: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = CW; c.height = CH
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, CH)
  P.skyStops.forEach((col, i) => grad.addColorStop(i / (P.skyStops.length - 1), col))
  g.fillStyle = grad
  g.fillRect(0, 0, CW, CH)
  // Stars — count and brightness scale with DCS (gods leaving = stars dying)
  const starCount = Math.round(70 * (dcs / 100))
  for (let i = 0; i < starCount; i++) {
    const x = prand(i) * CW
    const y = prand(i + 500) * CH * 0.42
    const sz = 0.4 + prand(i + 900) * 1.4
    g.globalAlpha = 0.25 + prand(i + 300) * 0.6 * (dcs / 100)
    g.fillStyle = i % 7 === 0 ? '#ffd890' : '#f0ecd8'
    g.beginPath(); g.arc(x, y, sz, 0, Math.PI * 2); g.fill()
  }
  g.globalAlpha = 1
  // Moon with glow + craters
  const mx = CW * 0.78, my = 86
  for (let r = 90; r > 30; r -= 14) {
    g.fillStyle = P.moonGlow
    g.beginPath(); g.arc(mx, my, r, 0, Math.PI * 2); g.fill()
  }
  g.fillStyle = P.moon
  g.beginPath(); g.arc(mx, my, 28, 0, Math.PI * 2); g.fill()
  g.fillStyle = 'rgba(160,150,130,0.5)'
  g.beginPath(); g.arc(mx - 9, my - 6, 5, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.arc(mx + 7, my + 8, 3.5, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.arc(mx + 11, my - 9, 2.5, 0, Math.PI * 2); g.fill()
  return c
}

function makeCityLayer(): HTMLCanvasElement {
  // burning Troy silhouette strip, drawn once, tiled with parallax
  const W = 1400, H = 240
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = P.cityFill
  // wall base
  g.fillRect(0, H - 60, W, 60)
  // merlons
  for (let x = 0; x < W; x += 36) g.fillRect(x, H - 72, 20, 12)
  // towers
  const towers = [120, 340, 560, 800, 1020, 1240]
  towers.forEach((tx, i) => {
    const th = 90 + prand(i + 40) * 70
    const tw = 54 + prand(i + 80) * 26
    g.fillRect(tx - tw / 2, H - 60 - th, tw, th)
    for (let mx = tx - tw / 2; mx < tx + tw / 2 - 8; mx += 16) g.fillRect(mx, H - 72 - th, 10, 12)
  })
  // gate arch
  g.fillRect(660, H - 130, 90, 70)
  g.fillStyle = '#000'
  g.beginPath(); g.arc(705, H - 60, 26, Math.PI, 0); g.fill()
  return c
}

function makeRuinsLayer(): HTMLCanvasElement {
  const W = 1100, H = 200
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = P.ruinFill
  for (let i = 0; i < 9; i++) {
    const x = prand(i + 11) * W
    const h = 50 + prand(i + 22) * 110
    const w = 14 + prand(i + 33) * 22
    g.fillRect(x, H - h, w, h)
    if (prand(i + 44) > 0.5) g.fillRect(x - 8, H - h, w + 16, 10)
  }
  return c
}

// ─── Component ───────────────────────────────────────────────────────────────
interface Props {
  mode: 'explore' | 'duel'
  onExit: () => void
  onTriggerEvent: (id: string) => void
  onDuelEnd: (won: boolean) => void
}

export function GameCanvas({ mode, onExit, onTriggerEvent, onDuelEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isTouch] = useState(() => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0))

  const cbRef = useRef({ onExit, onTriggerEvent, onDuelEnd })
  cbRef.current = { onExit, onTriggerEvent, onDuelEnd }

  const keysRef = useRef({ left: false, right: false, jump: false, action: false, dash: false, attack: false })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // HiDPI crispness
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = CW * dpr
    canvas.height = CH * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const keys = keysRef.current
    const isDuel = mode === 'duel'

    // ── State (all local to the loop — no React re-renders) ──
    const runNum = useGameStore.getState().runNumber
    if (!isDuel && persist.run !== runNum) {
      persist.run = runNum
      persist.loc = 'troy'
      persist.x = LOCATIONS.troy.startX
      persist.got.clear()
      persist.dead.clear()
    }
    const startLoc: LocKey = isDuel ? 'troy' : persist.loc
    const player: Player = {
      x: isDuel ? 250 : persist.x, y: GROUND_Y, vx: 0, vy: 0,
      facing: 1, onGround: true, wasGround: true,
      walkPhase: 0, idlePhase: 0, coyote: 0, jumpBuf: 0, landTimer: 0,
      dashT: 0, dashCd: 0, dashDir: 1,
      atkT: 0, atkCd: 0, invuln: 0, flash: 0,
    }
    const spawnEnemies = (loc: LocKey): Enemy[] =>
      LOCATIONS[loc].enemies
        .filter(e => !persist.dead.has(e.id))
        .map(e => ({ ...e, state: 'patrol' as const, t: 0, phase: prand(e.x) * 6, flash: 0, deadT: 0 }))
    const spawnPickups = (loc: LocKey): Pickup[] =>
      LOCATIONS[loc].pickups.filter(p => !persist.got.has(p.id)).map(p => ({ ...p }))

    let location: LocKey = startLoc
    let plats: Platform[] = isDuel ? PLATS_DUEL : [...LOCATIONS[startLoc].plats]
    let objs: LevelObj[] = isDuel ? OBJS_DUEL : LOCATIONS[startLoc].objs
    let pickups: Pickup[] = isDuel ? [] : spawnPickups(startLoc)
    let enemies: Enemy[] = isDuel ? [] : spawnEnemies(startLoc)
    let levelW = isDuel ? DUEL_W : LOCATIONS[startLoc].width

    const hector: Hector | null = isDuel ? {
      x: 1050, y: GROUND_Y, vx: 0, vy: 0, facing: -1,
      hp: 300, maxHp: 300, state: 'enter', t: 0, phase: 0, flash: 0,
      waveX: 0, waveActive: false, waveDir: -1,
    } : null

    const particles: Particle[] = []
    let emberT = 0, ashT = 0
    let camX = 0
    let time = 0
    let lastTs = performance.now()
    let portalCd = 0
    let dialogue: { name: string; role: string; line: string; t: number } | null = null
    let prompt: { label: string; x: number; y: number } | null = null
    let shake = 0
    let duelEnded = false
    let raf = 0

    // cached layers
    let skyDcsBucket = -1
    let skyLayer: HTMLCanvasElement | null = null
    const cityLayer = makeCityLayer()
    const ruinsLayer = makeRuinsLayer()

    // cached static gradients (screen-space, identical every frame)
    const seaY = 318
    const seaGrad = ctx.createLinearGradient(0, seaY, 0, GROUND_Y)
    seaGrad.addColorStop(0, P.seaTop); seaGrad.addColorStop(1, P.seaBot)
    const gndGrad = ctx.createLinearGradient(0, GROUND_Y, 0, CH)
    gndGrad.addColorStop(0, P.gndTop); gndGrad.addColorStop(0.25, P.gnd); gndGrad.addColorStop(1, P.gndDark)
    const vignette = ctx.createRadialGradient(CW / 2, CH / 2, CH * 0.42, CW / 2, CH / 2, CH * 0.95)
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(1, 'rgba(0,0,0,0.5)')
    const cityGlowGrad = ctx.createRadialGradient(CW * 0.42, 246, 20, CW * 0.42, 246, 420)
    cityGlowGrad.addColorStop(0, 'rgba(255,85,16,0.5)')
    cityGlowGrad.addColorStop(1, 'rgba(255,85,16,0)')

    const addP = (p: Particle) => { if (particles.length < MAX_PARTICLES) particles.push(p) }
    const burst = (x: number, y: number, n: number, r: number, g: number, b: number, spd = 180) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const v = spd * (0.4 + Math.random() * 0.8)
        addP({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.5 + Math.random() * 0.4, max: 0.9, size: 1.5 + Math.random() * 2.5, r, g, b, grav: 500 })
      }
    }

    // ── Keyboard ──
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'a' || e.key === 'ArrowLeft') keys.left = true
      if (k === 'd' || e.key === 'ArrowRight') keys.right = true
      if (k === 'w' || k === ' ' || e.key === 'ArrowUp') { keys.jump = true; e.preventDefault() }
      if (k === 'e' || k === 'enter') keys.action = true
      if (k === 'shift') keys.dash = true
      if (k === 'j' || k === 'x' || k === 'f') keys.attack = true
      if (k === 'escape' && !isDuel) cbRef.current.onExit()
    }
    const ku = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'a' || e.key === 'ArrowLeft') keys.left = false
      if (k === 'd' || e.key === 'ArrowRight') keys.right = false
      if (k === 'w' || k === ' ' || e.key === 'ArrowUp') keys.jump = false
      if (k === 'e' || k === 'enter') keys.action = false
      if (k === 'shift') keys.dash = false
      if (k === 'j' || k === 'x' || k === 'f') keys.attack = false
    }
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)

    // ── Combat helpers ──
    const hurtPlayer = (dmg: number, fromX: number) => {
      if (player.invuln > 0 || player.dashT > 0) return
      player.invuln = INVULN_MS
      player.flash = 200
      player.vx = player.x < fromX ? -260 : 260
      player.vy = -220
      shake = 9
      burst(player.x, player.y - 40, 10, 200, 30, 20)
      useGameStore.getState().damagePlayer(dmg)
    }

    // ── Main loop ──
    const loop = (ts: number) => {
      const dt = clamp((ts - lastTs) / 1000, 0, 0.033)
      lastTs = ts
      time += dt

      // ════ UPDATE ════
      let moveVel = 0
      if (keys.left) moveVel = -MOVE_SPD
      else if (keys.right) moveVel = MOVE_SPD
      if (moveVel !== 0) player.facing = moveVel > 0 ? 1 : -1

      // dash
      player.dashCd = Math.max(0, player.dashCd - dt * 1000)
      if (keys.dash && player.dashCd <= 0 && player.dashT <= 0) {
        player.dashT = DASH_MS
        player.dashDir = player.facing
        player.dashCd = DASH_CD_MS
        burst(player.x, player.y - 20, 6, 200, 150, 60, 90)
      }
      if (player.dashT > 0) {
        moveVel = DASH_SPD * player.dashDir
        player.dashT -= dt * 1000
        addP({ x: player.x - player.dashDir * 14, y: player.y - 18 - Math.random() * 30, vx: -player.dashDir * 60, vy: -20, life: 0.22, max: 0.22, size: 3, r: 220, g: 170, b: 80, grav: 0 })
      }

      // attack
      player.atkCd = Math.max(0, player.atkCd - dt * 1000)
      player.atkT = Math.max(0, player.atkT - dt * 1000)
      if (keys.attack && player.atkCd <= 0) {
        player.atkT = ATK_MS
        player.atkCd = ATK_CD_MS
        const hx = player.x + player.facing * ATK_RANGE * 0.6
        // hit enemies
        for (const en of enemies) {
          if (en.state === 'dead') continue
          if (Math.abs(en.x - hx) < ATK_RANGE && Math.abs(en.y - player.y) < 70) {
            en.hp -= ATK_DMG
            en.flash = 120
            en.vx = player.facing * 200
            burst(en.x, en.y - 30, 8, 255, 200, 120)
            shake = Math.max(shake, 4)
            if (en.hp <= 0) {
              en.state = 'dead'; en.deadT = 0
              persist.dead.add(en.id)
              burst(en.x, en.y - 30, 18, 120, 40, 30, 240)
            } else {
              en.state = 'chase'
            }
          }
        }
        // hit hector
        if (hector && hector.state !== 'dying' && hector.state !== 'enter') {
          if (Math.abs(hector.x - hx) < ATK_RANGE + 20 && Math.abs(hector.y - player.y) < 90) {
            hector.hp -= 25
            hector.flash = 110
            burst(hector.x, hector.y - 60, 10, 255, 120, 40)
            shake = Math.max(shake, 5)
            if (hector.hp <= 0) {
              hector.state = 'dying'; hector.t = 0
              shake = 14
            }
          }
        }
      }

      player.invuln = Math.max(0, player.invuln - dt * 1000)
      player.flash = Math.max(0, player.flash - dt * 1000)

      // physics
      player.vy += GRAVITY * dt
      player.vx = moveVel
      player.x += player.vx * dt
      player.y += player.vy * dt

      player.wasGround = player.onGround
      player.onGround = false
      if (player.y >= GROUND_Y) { player.y = GROUND_Y; player.vy = 0; player.onGround = true }
      for (const pl of plats) {
        if (player.x + 10 < pl.x || player.x - 10 > pl.x + pl.w) continue
        if (player.vy >= 0 && player.y >= pl.y && player.y - player.vy * dt <= pl.y + 14) {
          player.y = pl.y; player.vy = 0; player.onGround = true
        }
      }
      if (player.onGround) player.coyote = COYOTE_MS
      else player.coyote = Math.max(0, player.coyote - dt * 1000)
      player.jumpBuf = Math.max(0, player.jumpBuf - dt * 1000)
      if (keys.jump) { player.jumpBuf = JUMP_BUF_MS; keys.jump = false }
      if (player.jumpBuf > 0 && (player.onGround || player.coyote > 0)) {
        player.vy = JUMP_VEL; player.jumpBuf = 0; player.coyote = 0; player.onGround = false
        for (let i = 0; i < 5; i++) addP({ x: player.x + (Math.random() - 0.5) * 20, y: player.y, vx: (Math.random() - 0.5) * 120, vy: -40, life: 0.3, max: 0.3, size: 2, r: 120, g: 95, b: 60, grav: 300 })
      }
      if (player.onGround && !player.wasGround) {
        player.landTimer = 150
        for (let i = 0; i < 7; i++) addP({ x: player.x + (Math.random() - 0.5) * 26, y: player.y, vx: (Math.random() - 0.5) * 160, vy: -50, life: 0.35, max: 0.35, size: 2.2, r: 120, g: 95, b: 60, grav: 300 })
      }
      player.landTimer = Math.max(0, player.landTimer - dt * 1000)

      if (player.onGround && Math.abs(player.vx) > 10) {
        player.walkPhase += dt * 11
        if (Math.random() < 0.12) addP({ x: player.x - player.facing * 10, y: player.y, vx: -player.facing * 40, vy: -30, life: 0.25, max: 0.25, size: 1.6, r: 110, g: 88, b: 55, grav: 200 })
      } else {
        player.idlePhase += dt * 2
      }
      player.x = clamp(player.x, 20, levelW - 20)

      // ── Enemies AI ──
      const st = useGameStore.getState()
      for (const en of enemies) {
        en.flash = Math.max(0, en.flash - dt * 1000)
        en.phase += dt * (en.kind === 'dog' ? 12 : 7)
        if (en.state === 'dead') { en.deadT += dt; continue }
        const dx = player.x - en.x
        const adx = Math.abs(dx)
        const aggro = en.kind === 'dog' ? 340 : 260
        const reach = en.kind === 'dog' ? 42 : 56
        switch (en.state) {
          case 'patrol': {
            const span = 130
            en.vx = (en.kind === 'dog' ? 60 : 38) * en.facing
            if (en.x > en.homeX + span) en.facing = -1
            if (en.x < en.homeX - span) en.facing = 1
            if (adx < aggro && Math.abs(player.y - en.y) < 90) en.state = 'chase'
            break
          }
          case 'chase': {
            en.facing = dx > 0 ? 1 : -1
            en.vx = (en.kind === 'dog' ? 190 : 120) * en.facing
            if (adx < reach) { en.state = 'windup'; en.t = 0; en.vx = 0 }
            if (adx > aggro * 1.6) en.state = 'patrol'
            break
          }
          case 'windup': {
            en.vx = 0
            en.t += dt * 1000
            if (en.t > (en.kind === 'dog' ? 320 : 450)) { en.state = 'strike'; en.t = 0 }
            break
          }
          case 'strike': {
            en.t += dt * 1000
            if (en.t < 140) {
              en.vx = en.facing * (en.kind === 'dog' ? 360 : 240)
              if (adx < reach + 10 && Math.abs(player.y - en.y) < 60) {
                hurtPlayer(en.kind === 'dog' ? 8 : 13, en.x)
              }
            } else if (en.t > 520) {
              en.state = adx < aggro ? 'chase' : 'patrol'
            } else {
              en.vx = 0
            }
            break
          }
        }
        en.x += en.vx * dt
        en.x = clamp(en.x, 40, levelW - 40)
      }
      enemies = enemies.filter(e => e.state !== 'dead' || e.deadT < 1.2)

      // ── Hector AI (duel) ──
      if (hector && !duelEnded) {
        hector.flash = Math.max(0, hector.flash - dt * 1000)
        hector.phase += dt * 5
        hector.t += dt
        const hdx = player.x - hector.x
        switch (hector.state) {
          case 'enter':
            if (hector.t > 1.4) { hector.state = 'approach'; hector.t = 0 }
            break
          case 'approach': {
            hector.facing = hdx > 0 ? 1 : -1
            hector.vx = 95 * hector.facing
            hector.x += hector.vx * dt
            if (Math.abs(hdx) < 110 && hector.t > 0.7) {
              hector.state = Math.random() < 0.55 ? 'tellLunge' : 'tellSlam'
              hector.t = 0; hector.vx = 0
            } else if (hector.t > 2.6) {
              hector.state = 'tellLunge'; hector.t = 0; hector.vx = 0
            }
            break
          }
          case 'tellLunge':
            if (hector.t > 0.5) { hector.state = 'lunge'; hector.t = 0; hector.facing = hdx > 0 ? 1 : -1 }
            break
          case 'lunge': {
            hector.vx = 560 * hector.facing
            hector.x += hector.vx * dt
            if (Math.abs(player.x - hector.x) < 58 && Math.abs(player.y - hector.y) < 80) {
              hurtPlayer(18, hector.x)
            }
            if (hector.t > 0.42) { hector.state = 'stagger'; hector.t = 0 }
            break
          }
          case 'tellSlam':
            if (hector.t > 0.6) {
              hector.state = 'slam'; hector.t = 0
              hector.waveActive = true
              hector.waveX = hector.x
              hector.waveDir = hdx > 0 ? 1 : -1
              shake = 11
              burst(hector.x, GROUND_Y, 16, 255, 110, 30, 220)
            }
            break
          case 'slam':
            if (hector.t > 0.9) { hector.state = 'approach'; hector.t = 0 }
            break
          case 'stagger':
            if (hector.t > 0.8) { hector.state = 'approach'; hector.t = 0 }
            break
          case 'dying':
            if (hector.t > 1.6) {
              duelEnded = true
              cbRef.current.onDuelEnd(true)
            }
            break
        }
        // shockwave
        if (hector.waveActive) {
          hector.waveX += hector.waveDir * 420 * dt
          addP({ x: hector.waveX, y: GROUND_Y - 4, vx: 0, vy: -120 - Math.random() * 80, life: 0.3, max: 0.3, size: 3, r: 255, g: 120, b: 30, grav: 200 })
          if (Math.abs(player.x - hector.waveX) < 30 && player.y > GROUND_Y - 26) {
            hurtPlayer(15, hector.waveX - hector.waveDir * 10)
          }
          if (hector.waveX < 0 || hector.waveX > DUEL_W) hector.waveActive = false
        }
        hector.x = clamp(hector.x, 60, DUEL_W - 60)
      }

      // ── Pickups ──
      for (const pk of pickups) {
        if (pk.got) continue
        const dx = player.x - pk.x, dy = (player.y - 20) - pk.y
        if (dx * dx + dy * dy < 38 * 38) {
          pk.got = true
          persist.got.add(pk.id)
          st.addPickup(pk.kind)
          burst(pk.x, pk.y, 10, 240, 200, 80, 130)
        }
      }

      // ── Interactions (E) ──
      prompt = null
      if (!isDuel) {
        let nearest: LevelObj | null = null
        let bestD = 1e9
        for (const ob of objs) {
          if (!ob.eventId && !ob.isShip && !ob.portalTo && !ob.npcId) continue
          const cx = ob.x + ob.w / 2
          const d = Math.abs(player.x - cx)
          if (d < 85 && d < bestD) { bestD = d; nearest = ob }
        }
        if (nearest) prompt = { label: nearest.label || 'Взаимодействовать', x: nearest.x + nearest.w / 2, y: nearest.y - 16 }
        portalCd = Math.max(0, portalCd - dt * 1000)
        if (keys.action && nearest) {
          keys.action = false
          if (nearest.eventId) {
            cbRef.current.onTriggerEvent(nearest.eventId)
          } else if (nearest.isShip) {
            cbRef.current.onExit()
          } else if (nearest.portalTo && portalCd <= 0) {
            const nl = nearest.portalTo as LocKey
            location = nl
            plats = [...LOCATIONS[nl].plats]
            objs = LOCATIONS[nl].objs
            pickups = spawnPickups(nl)
            enemies = spawnEnemies(nl)
            levelW = LOCATIONS[nl].width
            player.x = LOCATIONS[nl].startX
            player.y = GROUND_Y; player.vy = 0
            portalCd = 800
            persist.loc = nl
            persist.x = player.x
          } else if (nearest.npcId) {
            const npc = NPCS[nearest.npcId]
            if (npc) dialogue = { ...npc, t: 0 }
          }
        }
      }
      if (dialogue) {
        dialogue.t += dt
        if (dialogue.t > 0.4 && keys.action) { dialogue = null; keys.action = false }
        if (dialogue && dialogue.t > 6) dialogue = null
      }

      // ── Ambient particles ──
      emberT -= dt * 1000
      if (emberT < 0) {
        emberT = 70
        for (const ob of objs) {
          if (ob.kind !== 'fire') continue
          const sx = ob.x + ob.w / 2 - camX
          if (sx < -60 || sx > CW + 60) continue
          addP({ x: ob.x + ob.w / 2 + (Math.random() - 0.5) * 16, y: ob.y + 10, vx: (Math.random() - 0.5) * 60, vy: -90 - Math.random() * 110, life: 1.1, max: 1.1, size: 2 + Math.random() * 2, r: 255, g: 130, b: 20, grav: -40 })
        }
      }
      // ash drifting over Troy
      ashT -= dt * 1000
      if (ashT < 0 && (location === 'troy' || isDuel)) {
        ashT = 120
        addP({ x: camX + Math.random() * CW, y: -8, vx: -18 + Math.random() * 24, vy: 26 + Math.random() * 26, life: 7, max: 7, size: 1.2 + Math.random() * 1.6, r: 130, g: 115, b: 105, grav: 0 })
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life -= dt
        if (p.life <= 0) { particles.splice(i, 1); continue }
        p.vy += p.grav * dt
        p.x += p.vx * dt; p.y += p.vy * dt
      }

      if (!isDuel) persist.x = player.x

      // camera
      const targetCam = clamp(player.x - CW * 0.38, 0, levelW - CW)
      camX += (targetCam - camX) * Math.min(1, dt * 7)
      shake = Math.max(0, shake - dt * 36)
      const shx = shake > 0 ? (Math.random() - 0.5) * shake : 0
      const shy = shake > 0 ? (Math.random() - 0.5) * shake : 0

      // ════ RENDER ════
      const dcs = st.dcs
      const dcsBucket = Math.round(dcs / 5)
      if (dcsBucket !== skyDcsBucket) { skyDcsBucket = dcsBucket; skyLayer = makeSkyLayer(dcs) }

      ctx.save()
      ctx.translate(shx, shy)

      // sky (pre-rendered)
      if (skyLayer) ctx.drawImage(skyLayer, 0, 0)

      // burning city silhouette (parallax 0.05) + flicker glow
      const flick = 0.5 + Math.sin(time * 9) * 0.18 + Math.sin(time * 23.7) * 0.1
      const cityY = 96
      ctx.globalAlpha = 0.35 * flick
      ctx.fillStyle = cityGlowGrad
      ctx.fillRect(0, 0, CW, CH * 0.62)
      ctx.globalAlpha = 1
      const cityOff = -((camX * 0.05) % 1400)
      ctx.drawImage(cityLayer, cityOff, cityY)
      ctx.drawImage(cityLayer, cityOff + 1400, cityY)

      // mid ruins (parallax 0.16)
      ctx.globalAlpha = 0.8
      const ruinsOff = -((camX * 0.16) % 1100)
      ctx.drawImage(ruinsLayer, ruinsOff, 175)
      ctx.drawImage(ruinsLayer, ruinsOff + 1100, 175)
      ctx.globalAlpha = 1

      // sea with moon path
      ctx.fillStyle = seaGrad
      ctx.fillRect(0, seaY, CW, GROUND_Y - seaY)
      ctx.fillStyle = P.moonPath
      ctx.fillRect(CW * 0.66, seaY, 150, GROUND_Y - seaY)
      ctx.strokeStyle = P.seaLine
      ctx.lineWidth = 1.6
      for (let w = 0; w < 6; w++) {
        const yy = seaY + 14 + w * 16
        ctx.globalAlpha = 0.5 - w * 0.06
        ctx.beginPath()
        for (let x = 0; x <= CW; x += 24) {
          const wy = yy + Math.sin(x * 0.018 + time * (1.1 + w * 0.2) + w * 2 - camX * 0.004) * 3.2
          if (x === 0) ctx.moveTo(x, wy); else ctx.lineTo(x, wy)
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // ground band
      ctx.fillStyle = gndGrad
      ctx.fillRect(0, GROUND_Y, CW, CH - GROUND_Y)
      // pebbles & debris (deterministic per world position)
      ctx.fillStyle = P.pebble
      const pebStart = Math.floor(camX / 46)
      for (let i = pebStart; i < pebStart + 24; i++) {
        const wx = i * 46 + prand(i) * 30
        const sx = wx - camX
        const sy = GROUND_Y + 8 + prand(i + 7) * (CH - GROUND_Y - 18)
        ctx.globalAlpha = 0.5 + prand(i + 3) * 0.4
        ctx.beginPath(); ctx.ellipse(sx, sy, 2.6 + prand(i + 5) * 3.4, 1.4 + prand(i + 9) * 1.8, 0, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
      // ground highlight edge
      ctx.strokeStyle = P.stoneHi
      ctx.globalAlpha = 0.45
      ctx.beginPath(); ctx.moveTo(0, GROUND_Y + 0.5); ctx.lineTo(CW, GROUND_Y + 0.5); ctx.stroke()
      ctx.globalAlpha = 1

      ctx.save()
      ctx.translate(-camX, 0)

      // ── platforms ──
      for (const pl of plats) {
        if (pl.x + pl.w < camX - 40 || pl.x > camX + CW + 40) continue
        if (pl.kind === 'stone') {
          ctx.fillStyle = P.stoneB; rr(ctx, pl.x, pl.y, pl.w, pl.h, 3); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
          ctx.fillStyle = P.stoneHi; ctx.fillRect(pl.x + 2, pl.y + 1.5, pl.w - 4, 2.5)
          ctx.strokeStyle = P.stoneA; ctx.lineWidth = 1
          for (let x = pl.x + 18; x < pl.x + pl.w - 6; x += 26) {
            ctx.beginPath(); ctx.moveTo(x, pl.y + 4); ctx.lineTo(x, pl.y + pl.h - 3); ctx.stroke()
          }
        } else if (pl.kind === 'wood') {
          ctx.fillStyle = P.woodA; rr(ctx, pl.x, pl.y, pl.w, pl.h, 2); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
          ctx.fillStyle = P.woodHi; ctx.fillRect(pl.x + 2, pl.y + 1.5, pl.w - 4, 2)
          ctx.strokeStyle = P.woodB; ctx.lineWidth = 1.4
          for (let x = pl.x + 14; x < pl.x + pl.w; x += 22) {
            ctx.beginPath(); ctx.moveTo(x, pl.y + 2); ctx.lineTo(x, pl.y + pl.h - 2); ctx.stroke()
          }
        } else {
          ctx.fillStyle = P.woodB; rr(ctx, pl.x, pl.y, pl.w, pl.h, 2); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
          ctx.strokeStyle = P.woodHi; ctx.lineWidth = 1.2
          ctx.beginPath(); ctx.moveTo(pl.x + 3, pl.y + 3); ctx.lineTo(pl.x + pl.w - 3, pl.y + pl.h - 3)
          ctx.moveTo(pl.x + pl.w - 3, pl.y + 3); ctx.lineTo(pl.x + 3, pl.y + pl.h - 3); ctx.stroke()
        }
      }

      // ── level objects ──
      for (const ob of objs) {
        if (ob.x + ob.w < camX - 220 || ob.x > camX + CW + 220) continue
        const t = time
        if (ob.kind === 'col') {
          // fluted column with capital and base, rim-lit by fires
          ctx.fillStyle = P.stoneA
          ctx.fillRect(ob.x, ob.y, ob.w, ob.h)
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2.4
          ctx.strokeRect(ob.x, ob.y, ob.w, ob.h)
          ctx.fillStyle = P.stoneB
          ctx.fillRect(ob.x - 7, ob.y, ob.w + 14, 12)
          ctx.fillRect(ob.x - 5, ob.y + 12, ob.w + 10, 6)
          ctx.fillRect(ob.x - 7, ob.y + ob.h - 10, ob.w + 14, 10)
          ctx.strokeStyle = '#000'; ctx.lineWidth = 1.6
          ctx.strokeRect(ob.x - 7, ob.y, ob.w + 14, 12)
          // flutes
          ctx.strokeStyle = P.stoneB; ctx.lineWidth = 1.6
          for (let i = 1; i < 5; i++) {
            const fx = ob.x + (ob.w / 5) * i
            ctx.beginPath(); ctx.moveTo(fx, ob.y + 18); ctx.lineTo(fx, ob.y + ob.h - 10); ctx.stroke()
          }
          // warm rim light on right edge
          ctx.fillStyle = 'rgba(200,120,40,0.16)'
          ctx.fillRect(ob.x + ob.w - 4, ob.y + 14, 4, ob.h - 24)
          // crack
          ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.moveTo(ob.x + ob.w * 0.3, ob.y + ob.h * 0.35)
          ctx.lineTo(ob.x + ob.w * 0.55, ob.y + ob.h * 0.48)
          ctx.lineTo(ob.x + ob.w * 0.42, ob.y + ob.h * 0.6)
          ctx.stroke()
        } else if (ob.kind === 'wall') {
          ctx.fillStyle = P.stoneA
          ctx.fillRect(ob.x, ob.y, ob.w, ob.h)
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2.2; ctx.strokeRect(ob.x, ob.y, ob.w, ob.h)
          ctx.strokeStyle = P.stoneB; ctx.lineWidth = 1.2
          for (let yy = ob.y + 18; yy < ob.y + ob.h; yy += 22) {
            ctx.beginPath(); ctx.moveTo(ob.x, yy); ctx.lineTo(ob.x + ob.w, yy); ctx.stroke()
          }
          // ruined top
          ctx.fillStyle = P.stoneA
          ctx.beginPath()
          ctx.moveTo(ob.x, ob.y)
          ctx.lineTo(ob.x + 30, ob.y - 16); ctx.lineTo(ob.x + 70, ob.y - 4)
          ctx.lineTo(ob.x + 120, ob.y - 22); ctx.lineTo(ob.x + 170, ob.y - 8)
          ctx.lineTo(ob.x + ob.w, ob.y)
          ctx.closePath(); ctx.fill()
        } else if (ob.kind === 'fire') {
          const cxf = ob.x + ob.w / 2
          // logs
          ctx.strokeStyle = P.woodB; ctx.lineWidth = 5
          ctx.beginPath(); ctx.moveTo(cxf - 16, GROUND_Y - 3); ctx.lineTo(cxf + 12, GROUND_Y - 10); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(cxf + 16, GROUND_Y - 3); ctx.lineTo(cxf - 12, GROUND_Y - 10); ctx.stroke()
          // flame layers
          for (let l = 0; l < 4; l++) {
            const amp = (4 - l) * 7
            const ph = t * (2.2 - l * 0.3) + l
            const top = ob.y + l * 10
            ctx.fillStyle = [P.fire1, P.fire0, P.fire2, P.fireCore][l]
            ctx.globalAlpha = [0.85, 0.85, 0.9, 0.95][l]
            ctx.beginPath()
            ctx.moveTo(cxf - 13 + l * 2.6, GROUND_Y - 6)
            ctx.quadraticCurveTo(cxf - amp + Math.sin(ph) * 5, (top + GROUND_Y) / 2, cxf + Math.sin(ph * 1.4) * 4, top + Math.sin(ph * 2.2) * 5)
            ctx.quadraticCurveTo(cxf + amp + Math.sin(ph + 1) * 5, (top + GROUND_Y) / 2, cxf + 13 - l * 2.6, GROUND_Y - 6)
            ctx.closePath(); ctx.fill()
          }
          ctx.globalAlpha = 1
          // ambient halo
          const fg = ctx.createRadialGradient(cxf, GROUND_Y - 22, 6, cxf, GROUND_Y - 22, 95)
          fg.addColorStop(0, 'rgba(255,140,30,0.18)')
          fg.addColorStop(1, 'rgba(255,140,30,0)')
          ctx.fillStyle = fg
          ctx.fillRect(cxf - 95, GROUND_Y - 117, 190, 130)
        } else if (ob.kind === 'body') {
          ctx.fillStyle = P.body
          for (let i = 0; i < 3; i++) {
            const bx = ob.x + i * (ob.w / 3)
            ctx.beginPath(); ctx.ellipse(bx + 16, ob.y + ob.h - 8, 19, 8, (prand(i + ob.x) - 0.5) * 0.5, 0, Math.PI * 2); ctx.fill()
          }
          ctx.strokeStyle = '#000'; ctx.lineWidth = 1.4
          for (let i = 0; i < 3; i++) {
            const bx = ob.x + i * (ob.w / 3)
            ctx.beginPath(); ctx.ellipse(bx + 16, ob.y + ob.h - 8, 19, 8, (prand(i + ob.x) - 0.5) * 0.5, 0, Math.PI * 2); ctx.stroke()
          }
          // glint of a royal seal
          ctx.fillStyle = P.goldHi
          ctx.globalAlpha = 0.7 + Math.sin(t * 3) * 0.3
          ctx.beginPath(); ctx.arc(ob.x + ob.w * 0.55, ob.y + ob.h - 13, 2.4, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = 1
        } else if (ob.kind === 'tent') {
          ctx.fillStyle = P.woodB
          ctx.beginPath()
          ctx.moveTo(ob.x + ob.w / 2, ob.y)
          ctx.lineTo(ob.x, ob.y + ob.h)
          ctx.lineTo(ob.x + ob.w, ob.y + ob.h)
          ctx.closePath(); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2.2; ctx.stroke()
          // stripes
          ctx.strokeStyle = P.crimson; ctx.lineWidth = 5
          ctx.beginPath(); ctx.moveTo(ob.x + ob.w / 2, ob.y + 8); ctx.lineTo(ob.x + ob.w * 0.22, ob.y + ob.h); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(ob.x + ob.w / 2, ob.y + 8); ctx.lineTo(ob.x + ob.w * 0.78, ob.y + ob.h); ctx.stroke()
          // entry
          ctx.fillStyle = '#000'
          ctx.beginPath()
          ctx.moveTo(ob.x + ob.w / 2 - 13, ob.y + ob.h)
          ctx.lineTo(ob.x + ob.w / 2, ob.y + ob.h - 34)
          ctx.lineTo(ob.x + ob.w / 2 + 13, ob.y + ob.h)
          ctx.closePath(); ctx.fill()
          // lamp glow
          ctx.fillStyle = 'rgba(255,190,80,0.25)'
          ctx.beginPath(); ctx.arc(ob.x + ob.w / 2, ob.y + ob.h - 16, 9 + Math.sin(t * 4) * 2, 0, Math.PI * 2); ctx.fill()
        } else if (ob.kind === 'cave') {
          ctx.fillStyle = P.stoneA
          ctx.beginPath()
          ctx.moveTo(ob.x - 14, GROUND_Y)
          ctx.quadraticCurveTo(ob.x + ob.w * 0.15, ob.y - 22, ob.x + ob.w / 2, ob.y - 8)
          ctx.quadraticCurveTo(ob.x + ob.w * 0.85, ob.y - 20, ob.x + ob.w + 14, GROUND_Y)
          ctx.closePath(); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2.4; ctx.stroke()
          // mouth
          ctx.fillStyle = '#000'
          ctx.beginPath()
          ctx.moveTo(ob.x + ob.w * 0.24, GROUND_Y)
          ctx.quadraticCurveTo(ob.x + ob.w / 2, ob.y + ob.h * 0.28, ob.x + ob.w * 0.76, GROUND_Y)
          ctx.closePath(); ctx.fill()
          // pulsing inner glow
          const ca = 0.22 + Math.sin(t * 1.8) * 0.1
          const cg = ctx.createRadialGradient(ob.x + ob.w / 2, GROUND_Y - 18, 4, ob.x + ob.w / 2, GROUND_Y - 18, 46)
          cg.addColorStop(0, `rgba(150,80,230,${ca})`)
          cg.addColorStop(1, 'rgba(150,80,230,0)')
          ctx.fillStyle = cg
          ctx.fillRect(ob.x, GROUND_Y - 64, ob.w, 64)
        } else if (ob.kind === 'ship') {
          const bx = ob.x, by = ob.y + ob.h
          // hull
          ctx.fillStyle = P.woodA
          ctx.beginPath()
          ctx.moveTo(bx, by - 44)
          ctx.quadraticCurveTo(bx + ob.w * 0.5, by + 6, bx + ob.w, by - 44)
          ctx.lineTo(bx + ob.w - 26, by - 78)
          ctx.lineTo(bx + 30, by - 78)
          ctx.closePath(); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2.4; ctx.stroke()
          // planks
          ctx.strokeStyle = P.woodB; ctx.lineWidth = 1.4
          for (let i = 1; i < 4; i++) {
            ctx.beginPath()
            ctx.moveTo(bx + 12, by - 44 - i * 9)
            ctx.quadraticCurveTo(bx + ob.w / 2, by - 30 - i * 9, bx + ob.w - 12, by - 44 - i * 9)
            ctx.stroke()
          }
          // prow eye (apotropaic)
          ctx.fillStyle = P.fireCore
          ctx.beginPath(); ctx.ellipse(bx + ob.w - 36, by - 60, 6, 4, 0, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = '#000'
          ctx.beginPath(); ctx.arc(bx + ob.w - 35, by - 60, 2, 0, Math.PI * 2); ctx.fill()
          // mast + furled sail
          ctx.fillStyle = P.woodB
          ctx.fillRect(bx + ob.w / 2 - 5, by - 178, 10, 102)
          ctx.strokeStyle = '#000'; ctx.lineWidth = 1.6
          ctx.strokeRect(bx + ob.w / 2 - 5, by - 178, 10, 102)
          ctx.fillStyle = '#cabb96'
          rr(ctx, bx + ob.w / 2 - 56, by - 174, 112, 16, 7); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.stroke()
          // rigging
          ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(bx + ob.w / 2, by - 174); ctx.lineTo(bx + 36, by - 70); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(bx + ob.w / 2, by - 174); ctx.lineTo(bx + ob.w - 36, by - 70); ctx.stroke()
          // oars
          ctx.strokeStyle = P.woodB; ctx.lineWidth = 3
          for (let i = 0; i < 4; i++) {
            const ox2 = bx + 60 + i * 60
            ctx.beginPath(); ctx.moveTo(ox2, by - 50); ctx.lineTo(ox2 - 16, by - 8); ctx.stroke()
          }
        } else if (ob.kind === 'portal') {
          const pcx = ob.x + ob.w / 2, pcy = ob.y + ob.h / 2
          const pul = 1 + Math.sin(t * 2.6) * 0.1
          // dark vortex backdrop
          const vg = ctx.createRadialGradient(pcx, pcy, 2, pcx, pcy, 56 * pul)
          vg.addColorStop(0, 'rgba(216,176,255,0.5)')
          vg.addColorStop(0.45, 'rgba(112,48,200,0.32)')
          vg.addColorStop(1, 'rgba(80,32,176,0)')
          ctx.fillStyle = vg
          ctx.fillRect(pcx - 64, pcy - 64, 128, 128)
          ctx.strokeStyle = P.portal1
          ctx.lineWidth = 3
          ctx.globalAlpha = 0.85
          ctx.beginPath(); ctx.ellipse(pcx, pcy, 30 * pul, 48 * pul, 0, 0, Math.PI * 2); ctx.stroke()
          ctx.strokeStyle = P.portal0
          ctx.globalAlpha = 0.5
          ctx.beginPath(); ctx.ellipse(pcx, pcy, 40 * pul, 58 * pul, 0, 0, Math.PI * 2); ctx.stroke()
          ctx.globalAlpha = 1
          // orbiting sparks
          for (let i = 0; i < 5; i++) {
            const a = t * 2 + (i * Math.PI * 2) / 5
            ctx.fillStyle = P.portalCore
            ctx.globalAlpha = 0.7
            ctx.beginPath(); ctx.arc(pcx + Math.cos(a) * 34, pcy + Math.sin(a) * 52, 2, 0, Math.PI * 2); ctx.fill()
          }
          ctx.globalAlpha = 1
        } else if (ob.kind === 'npc') {
          const ncx = ob.x + ob.w / 2
          const bob = Math.sin(t * 1.6 + ob.x) * 1.5
          // robe
          ctx.fillStyle = P.npcRobe
          ctx.beginPath()
          ctx.moveTo(ncx - 15, GROUND_Y)
          ctx.quadraticCurveTo(ncx - 18, ob.y + 16 + bob, ncx - 8, ob.y + 8 + bob)
          ctx.lineTo(ncx + 8, ob.y + 8 + bob)
          ctx.quadraticCurveTo(ncx + 18, ob.y + 16 + bob, ncx + 15, GROUND_Y)
          ctx.closePath(); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
          // head
          ctx.fillStyle = P.npcSkin
          ctx.beginPath(); ctx.arc(ncx, ob.y + bob, 11, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
          // hood shadow
          ctx.fillStyle = 'rgba(0,0,0,0.45)'
          ctx.beginPath(); ctx.arc(ncx, ob.y + bob - 3, 11, Math.PI, 0); ctx.fill()
        }
      }

      // ── ghosts (Shadow ≥ 20, world remembers the dead) ──
      if (!isDuel && st.odysseus.shadow >= 20) {
        for (const ob of objs) {
          if (ob.kind !== 'fire') continue
          const gx = ob.x + ob.w / 2 + 46
          if (gx < camX - 40 || gx > camX + CW + 40) continue
          const ga = 0.10 + Math.sin(time * 1.3 + ob.x) * 0.06
          ctx.fillStyle = `rgba(150,170,220,${Math.max(0.03, ga)})`
          const gb = Math.sin(time * 0.9 + ob.x) * 3
          ctx.beginPath()
          ctx.moveTo(gx - 11, GROUND_Y)
          ctx.quadraticCurveTo(gx - 13, GROUND_Y - 38 + gb, gx, GROUND_Y - 52 + gb)
          ctx.quadraticCurveTo(gx + 13, GROUND_Y - 38 + gb, gx + 11, GROUND_Y)
          ctx.closePath(); ctx.fill()
          ctx.beginPath(); ctx.arc(gx, GROUND_Y - 58 + gb, 8, 0, Math.PI * 2); ctx.fill()
        }
      }

      // ── pickups ──
      for (const pk of pickups) {
        if (pk.got) continue
        if (pk.x < camX - 30 || pk.x > camX + CW + 30) continue
        const bob = Math.sin(time * 3 + pk.x * 0.05) * 3
        const py = pk.y + bob
        // glow
        const pg = ctx.createRadialGradient(pk.x, py, 1, pk.x, py, 16)
        pg.addColorStop(0, 'rgba(255,220,120,0.35)')
        pg.addColorStop(1, 'rgba(255,220,120,0)')
        ctx.fillStyle = pg
        ctx.fillRect(pk.x - 16, py - 16, 32, 32)
        if (pk.kind === 'food') {
          // amphora
          ctx.fillStyle = '#8a5618'
          ctx.beginPath()
          ctx.moveTo(pk.x - 5, py - 8)
          ctx.quadraticCurveTo(pk.x - 8, py, pk.x - 4, py + 8)
          ctx.lineTo(pk.x + 4, py + 8)
          ctx.quadraticCurveTo(pk.x + 8, py, pk.x + 5, py - 8)
          ctx.closePath(); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 1.4; ctx.stroke()
          ctx.fillRect(pk.x - 4, py - 11, 8, 3)
        } else if (pk.kind === 'gold') {
          ctx.fillStyle = P.gold
          ctx.beginPath(); ctx.ellipse(pk.x, py + 4, 7, 3, 0, 0, Math.PI * 2); ctx.fill()
          ctx.beginPath(); ctx.ellipse(pk.x - 2, py, 7, 3, 0, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = P.goldHi
          ctx.beginPath(); ctx.ellipse(pk.x + 1, py - 4, 7, 3, 0, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke()
        } else {
          // pitch lump
          ctx.fillStyle = '#181410'
          ctx.beginPath(); ctx.ellipse(pk.x, py + 2, 8, 6, 0.3, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; ctx.stroke()
          ctx.fillStyle = 'rgba(255,255,255,0.18)'
          ctx.beginPath(); ctx.ellipse(pk.x - 2, py - 1, 3, 1.6, 0.4, 0, Math.PI * 2); ctx.fill()
        }
      }

      // ── enemies ──
      for (const en of enemies) {
        if (en.x < camX - 80 || en.x > camX + CW + 80) continue
        ctx.save()
        ctx.translate(en.x, en.y)
        if (en.state === 'dead') ctx.globalAlpha = Math.max(0, 1 - en.deadT / 1.1)
        ctx.scale(en.facing, 1)
        const fl = en.flash > 0
        if (en.kind === 'dog') {
          const lope = Math.sin(en.phase) * (Math.abs(en.vx) > 10 ? 1 : 0.2)
          // body
          ctx.fillStyle = fl ? '#883830' : P.dogFur
          ctx.beginPath()
          ctx.ellipse(0, -16 + Math.abs(lope) * 2, 22, 10, lope * 0.1, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
          // head
          ctx.beginPath(); ctx.ellipse(20, -22 + lope, 9, 7, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
          // muzzle
          ctx.beginPath(); ctx.moveTo(27, -22 + lope); ctx.lineTo(34, -19 + lope); ctx.lineTo(27, -17 + lope); ctx.closePath(); ctx.fill()
          // ears
          ctx.beginPath(); ctx.moveTo(16, -28 + lope); ctx.lineTo(14, -35 + lope); ctx.lineTo(20, -29 + lope); ctx.closePath(); ctx.fill()
          // legs
          ctx.strokeStyle = fl ? '#883830' : P.dogFur; ctx.lineWidth = 4
          ctx.beginPath(); ctx.moveTo(-12, -10); ctx.lineTo(-14 + lope * 6, 0); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(12, -10); ctx.lineTo(14 - lope * 6, 0); ctx.stroke()
          // eye
          ctx.fillStyle = en.state === 'chase' || en.state === 'windup' || en.state === 'strike' ? P.enemyEye : '#c89858'
          ctx.beginPath(); ctx.arc(22, -24 + lope, 1.8, 0, Math.PI * 2); ctx.fill()
          // tail
          ctx.strokeStyle = fl ? '#883830' : P.dogFur; ctx.lineWidth = 3
          ctx.beginPath(); ctx.moveTo(-21, -18); ctx.quadraticCurveTo(-30, -24 + lope * 2, -27, -30); ctx.stroke()
        } else {
          const sw = Math.sin(en.phase) * (Math.abs(en.vx) > 10 ? 1 : 0.15)
          const windup = en.state === 'windup' ? Math.min(1, en.t / 450) : 0
          // legs
          ctx.strokeStyle = fl ? '#a04438' : P.enemyRag; ctx.lineWidth = 6
          ctx.beginPath(); ctx.moveTo(-4, -34); ctx.lineTo(-7 + sw * 7, 0); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(4, -34); ctx.lineTo(7 - sw * 7, 0); ctx.stroke()
          // ragged cloak body
          ctx.fillStyle = fl ? '#a04438' : P.enemyRag
          ctx.beginPath()
          ctx.moveTo(-12, -30)
          ctx.lineTo(-9, -62); ctx.lineTo(9, -62); ctx.lineTo(12, -30)
          ctx.lineTo(8, -34); ctx.lineTo(3, -28); ctx.lineTo(-3, -33); ctx.lineTo(-8, -28)
          ctx.closePath(); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
          // head wrap
          ctx.fillStyle = fl ? '#a04438' : '#2e1c0c'
          ctx.beginPath(); ctx.arc(0, -70, 10, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
          // eye glint
          ctx.fillStyle = en.state === 'patrol' ? '#b89868' : P.enemyEye
          ctx.beginPath(); ctx.arc(4, -71, 2, 0, Math.PI * 2); ctx.fill()
          // club arm (raises in windup)
          ctx.save()
          ctx.translate(8, -56)
          ctx.rotate(-0.4 - windup * 1.6 + (en.state === 'strike' && en.t < 140 ? 1.4 : 0))
          ctx.strokeStyle = fl ? '#a04438' : P.enemyRag; ctx.lineWidth = 5
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14, 8); ctx.stroke()
          ctx.fillStyle = P.woodB
          rr(ctx, 12, 4, 22, 7, 3); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 1.4; ctx.stroke()
          ctx.restore()
        }
        ctx.restore()
        // hp pips
        if (en.state !== 'dead' && en.hp < en.maxHp) {
          const w = 30, frac = en.hp / en.maxHp
          ctx.fillStyle = 'rgba(0,0,0,0.6)'
          ctx.fillRect(en.x - w / 2, en.y - (en.kind === 'dog' ? 44 : 86), w, 4)
          ctx.fillStyle = '#c03020'
          ctx.fillRect(en.x - w / 2, en.y - (en.kind === 'dog' ? 44 : 86), w * frac, 4)
        }
      }

      // ── Hector ──
      if (hector) {
        ctx.save()
        ctx.translate(hector.x, hector.y)
        if (hector.state === 'dying') ctx.globalAlpha = Math.max(0, 1 - hector.t / 1.5)
        if (hector.state === 'enter') ctx.globalAlpha = Math.min(1, hector.t / 1.2)
        ctx.scale(hector.facing, 1)
        const hfl = hector.flash > 0
        const tell = hector.state === 'tellLunge' || hector.state === 'tellSlam'
        const hsw = Math.sin(hector.phase) * (Math.abs(hector.vx) > 10 ? 1 : 0.2)
        // burning aura
        const aur = ctx.createRadialGradient(0, -55, 8, 0, -55, 85)
        aur.addColorStop(0, `rgba(255,68,0,${tell ? 0.34 : 0.16})`)
        aur.addColorStop(1, 'rgba(255,68,0,0)')
        ctx.fillStyle = aur
        ctx.fillRect(-85, -140, 170, 150)
        // legs
        ctx.strokeStyle = hfl ? '#c05038' : P.hector; ctx.lineWidth = 9
        ctx.beginPath(); ctx.moveTo(-6, -44); ctx.lineTo(-10 + hsw * 8, 0); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(6, -44); ctx.lineTo(10 - hsw * 8, 0); ctx.stroke()
        // torso
        ctx.fillStyle = hfl ? '#c05038' : P.hector
        rr(ctx, -17, -92, 34, 52, 6); ctx.fill()
        ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.stroke()
        // armor
        ctx.fillStyle = P.hectorArmor
        rr(ctx, -14, -90, 28, 30, 4); ctx.fill()
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
        // spear arm
        ctx.save()
        ctx.translate(12, -82)
        const spearAng = hector.state === 'tellLunge' ? -0.9 : hector.state === 'lunge' ? 0.25 : hector.state === 'tellSlam' ? -1.9 : hector.state === 'slam' ? 0.7 : -0.25
        ctx.rotate(spearAng)
        ctx.strokeStyle = hfl ? '#c05038' : P.hector; ctx.lineWidth = 7
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20, 6); ctx.stroke()
        // spear
        ctx.strokeStyle = P.woodB; ctx.lineWidth = 4
        ctx.beginPath(); ctx.moveTo(8, 4); ctx.lineTo(66, 10); ctx.stroke()
        ctx.fillStyle = P.blade
        ctx.beginPath(); ctx.moveTo(66, 4); ctx.lineTo(82, 10); ctx.lineTo(66, 16); ctx.closePath(); ctx.fill()
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.4; ctx.stroke()
        ctx.restore()
        // shield arm
        ctx.fillStyle = P.hectorArmor
        ctx.beginPath(); ctx.ellipse(-18, -66, 9, 17, 0.15, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
        // head + helm with tall crest
        ctx.fillStyle = hfl ? '#c05038' : P.hector
        ctx.beginPath(); ctx.arc(0, -103, 13, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2.6; ctx.stroke()
        ctx.fillStyle = P.hectorArmor
        ctx.beginPath(); ctx.arc(0, -106, 13, Math.PI + 0.2, Math.PI * 2 - 0.2); ctx.fill()
        ctx.strokeStyle = '#000'; ctx.stroke()
        // burning crest
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = [P.fire1, P.fire0, P.fire2][i]
          ctx.globalAlpha = ctx.globalAlpha * 0.95
          ctx.beginPath()
          ctx.moveTo(-2 - i * 2, -112)
          ctx.quadraticCurveTo(8 + Math.sin(time * 7 + i) * 4, -132 + i * 4, 20 - i * 3, -114 + i * 2)
          ctx.quadraticCurveTo(10, -110, -2 - i * 2, -108)
          ctx.closePath(); ctx.fill()
        }
        // eyes through helm
        ctx.fillStyle = P.hectorFlame
        ctx.beginPath(); ctx.arc(5, -104, 2.2, 0, Math.PI * 2); ctx.fill()
        ctx.restore()

        // boss HP bar (screen space, drawn after restore below)
      }

      // ── player ──
      ctx.save()
      ctx.translate(player.x, player.y)
      const sq = 1 - (player.landTimer / 150) * 0.14
      ctx.scale(player.facing, sq)
      if (player.invuln > 0 && Math.floor(time * 18) % 2 === 0) ctx.globalAlpha = 0.45
      const run = player.onGround && Math.abs(player.vx) > 10
      const leg = run ? Math.sin(player.walkPhase) * 24 : (player.onGround ? 0 : 14)
      const arm = run ? Math.sin(player.walkPhase + Math.PI) * 20 : (player.onGround ? Math.sin(player.idlePhase) * 3 : -18)
      const breathe = !run && player.onGround ? Math.sin(player.idlePhase * 1.5) * 1.2 : 0
      const lean = run ? player.facing * 0 + 0.06 : 0
      ctx.rotate(lean)
      // cape (two segments)
      const cp1 = Math.sin(time * 4 + player.walkPhase) * (run ? 10 : 4)
      ctx.strokeStyle = P.crimson; ctx.lineWidth = 7
      ctx.beginPath()
      ctx.moveTo(-6, -60 + breathe)
      ctx.quadraticCurveTo(-16 - (run ? 8 : 2), -36, -14 + cp1 * 0.4, -6)
      ctx.stroke()
      ctx.strokeStyle = P.crimsonHi; ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.moveTo(-7, -58 + breathe)
      ctx.quadraticCurveTo(-15 - (run ? 7 : 2), -38, -13 + cp1 * 0.4, -10)
      ctx.stroke()
      // back leg
      ctx.save(); ctx.rotate((-leg * Math.PI) / 180 / 1.6)
      ctx.strokeStyle = P.body; ctx.lineWidth = 8
      ctx.beginPath(); ctx.moveTo(3, -34); ctx.lineTo(6, -2); ctx.stroke()
      ctx.restore()
      // torso
      rr(ctx, -12, -64 + breathe, 24, 34, 5)
      ctx.fillStyle = P.body; ctx.fill()
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2.6; ctx.stroke()
      // breastplate
      rr(ctx, -10, -62 + breathe, 20, 22, 4)
      ctx.fillStyle = P.gold; ctx.fill()
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1.6; ctx.stroke()
      ctx.strokeStyle = P.goldDk; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, -62 + breathe); ctx.lineTo(0, -42 + breathe); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(-10, -52 + breathe); ctx.lineTo(10, -52 + breathe); ctx.stroke()
      ctx.fillStyle = P.goldHi
      ctx.fillRect(-8, -60 + breathe, 4, 2)
      // skirt
      ctx.fillStyle = P.body
      ctx.beginPath()
      ctx.moveTo(-12, -32); ctx.lineTo(12, -32); ctx.lineTo(9, -22); ctx.lineTo(-9, -22)
      ctx.closePath(); ctx.fill()
      // front leg
      ctx.save(); ctx.rotate((leg * Math.PI) / 180 / 1.6)
      ctx.strokeStyle = P.body; ctx.lineWidth = 8
      ctx.beginPath(); ctx.moveTo(-3, -32); ctx.lineTo(-7, 0); ctx.stroke()
      // greave
      ctx.strokeStyle = P.goldDk; ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(-5.5, -16); ctx.lineTo(-7, -2); ctx.stroke()
      ctx.restore()
      // sword arm with attack swing
      ctx.save()
      const atkFrac = player.atkT > 0 ? 1 - player.atkT / ATK_MS : -1
      const swing = atkFrac >= 0 ? -1.7 + atkFrac * 2.8 : (arm * Math.PI) / 180 / 1.4 - 0.3
      ctx.translate(8, -56 + breathe)
      ctx.rotate(swing)
      ctx.strokeStyle = P.body; ctx.lineWidth = 6.4
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14, 6); ctx.stroke()
      // xiphos blade
      ctx.strokeStyle = P.blade; ctx.lineWidth = 4
      ctx.beginPath(); ctx.moveTo(13, 5); ctx.lineTo(46, 11); ctx.stroke()
      ctx.strokeStyle = P.bladeHi; ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(14, 3.6); ctx.lineTo(45, 9.6); ctx.stroke()
      // crossguard
      ctx.fillStyle = P.gold
      rr(ctx, 11, 1, 5, 9, 1.5); ctx.fill()
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke()
      // swing trail
      if (atkFrac >= 0 && atkFrac < 0.8) {
        ctx.strokeStyle = `rgba(216,216,232,${0.5 * (1 - atkFrac)})`
        ctx.lineWidth = 10
        ctx.beginPath(); ctx.arc(0, 0, 42, swing - 0.9, swing + 0.12); ctx.stroke()
      }
      ctx.restore()
      // off arm
      ctx.save()
      ctx.rotate((-arm * Math.PI) / 180 / 1.6)
      ctx.strokeStyle = P.body; ctx.lineWidth = 6
      ctx.beginPath(); ctx.moveTo(-8, -56 + breathe); ctx.lineTo(-17, -36 + breathe); ctx.stroke()
      ctx.restore()
      // head
      ctx.beginPath(); ctx.arc(0, -74 + breathe, 12.5, 0, Math.PI * 2)
      ctx.fillStyle = P.skin; ctx.fill()
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2.4; ctx.stroke()
      // helm
      ctx.beginPath(); ctx.arc(0, -77 + breathe, 12, Math.PI + 0.15, Math.PI * 2 - 0.15)
      ctx.fillStyle = P.gold; ctx.fill()
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
      ctx.fillStyle = P.gold
      ctx.fillRect(-12, -78 + breathe, 5, 11)
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2
      ctx.strokeRect(-12, -78 + breathe, 5, 11)
      // crest
      ctx.beginPath()
      ctx.moveTo(-1, -89 + breathe)
      ctx.quadraticCurveTo(12, -98, 16, -82)
      ctx.quadraticCurveTo(8, -80, -1, -80 + breathe)
      ctx.closePath()
      ctx.fillStyle = P.crimson; ctx.fill()
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1.6; ctx.stroke()
      ctx.strokeStyle = P.crimsonHi; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(1, -88 + breathe); ctx.quadraticCurveTo(9, -93, 13, -84); ctx.stroke()
      // eye
      ctx.fillStyle = '#0a0604'
      ctx.beginPath(); ctx.arc(5, -75 + breathe, 1.6, 0, Math.PI * 2); ctx.fill()
      ctx.restore()

      // ── particles ──
      for (const p of particles) {
        const a = clamp(p.life / p.max, 0, 1)
        ctx.globalAlpha = a * 0.9
        ctx.fillStyle = `rgb(${p.r | 0},${p.g | 0},${p.b | 0})`
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + a * 0.4), 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1

      ctx.restore() // world space

      // ── prompt ──
      if (prompt && !dialogue) {
        const sx = prompt.x - camX
        ctx.font = '600 13px Georgia, serif'
        const tw = ctx.measureText(prompt.label).width
        ctx.fillStyle = P.uiBg
        rr(ctx, sx - tw / 2 - 10, prompt.y - 34, tw + 20, 24, 5)
        ctx.fill()
        ctx.strokeStyle = P.uiBorder; ctx.lineWidth = 1; ctx.stroke()
        ctx.fillStyle = P.uiText
        ctx.textAlign = 'center'
        ctx.fillText(prompt.label, sx, prompt.y - 17)
        ctx.textAlign = 'left'
      }

      // ── dialogue box ──
      if (dialogue) {
        const bx = 60, bw = CW - 120, bh = 96, by2 = CH - bh - 24
        ctx.fillStyle = P.uiBg
        rr(ctx, bx, by2, bw, bh, 8); ctx.fill()
        ctx.strokeStyle = P.uiBorder; ctx.lineWidth = 2; ctx.stroke()
        ctx.fillStyle = P.uiText
        ctx.font = '700 15px Georgia, serif'
        ctx.fillText(dialogue.name, bx + 18, by2 + 26)
        ctx.fillStyle = P.uiDim
        ctx.font = 'italic 12px Georgia, serif'
        ctx.fillText(dialogue.role, bx + 18 + ctx.measureText(dialogue.name).width + 70, by2 + 26)
        ctx.fillStyle = '#d8c8a0'
        ctx.font = '14px Georgia, serif'
        // word wrap
        const words = dialogue.line.split(' ')
        let line = '', ly = by2 + 50
        for (const w of words) {
          if (ctx.measureText(line + w).width > bw - 36) {
            ctx.fillText(line, bx + 18, ly); line = w + ' '; ly += 19
          } else line += w + ' '
        }
        ctx.fillText(line, bx + 18, ly)
        ctx.fillStyle = P.uiDim
        ctx.font = '11px Georgia, serif'
        ctx.fillText('E — закрыть', bx + bw - 80, by2 + bh - 12)
      }

      // ── boss HP bar ──
      if (hector && hector.state !== 'enter') {
        const bw = 420, bx = (CW - bw) / 2
        ctx.fillStyle = 'rgba(0,0,0,0.65)'
        rr(ctx, bx - 4, 18, bw + 8, 22, 5); ctx.fill()
        ctx.strokeStyle = P.uiBorder; ctx.lineWidth = 1.4; ctx.stroke()
        const frac = clamp(hector.hp / hector.maxHp, 0, 1)
        const hg = ctx.createLinearGradient(bx, 0, bx + bw * frac, 0)
        hg.addColorStop(0, '#7a1410'); hg.addColorStop(1, '#d83018')
        ctx.fillStyle = hg
        ctx.fillRect(bx, 22, bw * frac, 14)
        ctx.fillStyle = P.uiText
        ctx.font = '700 12px Georgia, serif'
        ctx.textAlign = 'center'
        ctx.fillText('ТЕНЬ ГЕКТОРА', CW / 2, 33)
        ctx.textAlign = 'left'
      }

      // ── location title + controls hint ──
      if (!isDuel) {
        ctx.fillStyle = P.uiDim
        ctx.font = '700 12px Georgia, serif'
        ctx.fillText(LOCATIONS[location].name, 14, CH - 14)
        if (!isTouch) {
          ctx.fillStyle = 'rgba(138,104,48,0.7)'
          ctx.font = '11px Georgia, serif'
          ctx.fillText('A/D — ход · W — прыжок · Shift — рывок · J — удар · E — действие · Esc — корабль', 14, CH - 32)
        }
      } else if (!isTouch) {
        ctx.fillStyle = 'rgba(138,104,48,0.8)'
        ctx.font = '11px Georgia, serif'
        ctx.fillText('J — удар · Shift — рывок сквозь атаки · W — прыжок через волну', 14, CH - 14)
      }

      // hit flash
      if (player.flash > 0) {
        ctx.fillStyle = `rgba(180,20,10,${(player.flash / 200) * 0.22})`
        ctx.fillRect(0, 0, CW, CH)
      }

      // vignette
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, CW, CH)

      ctx.restore() // shake

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
    }
  }, [mode, isTouch])

  // ── touch controls (v1.4) ──
  const bindTouch = (key: keyof typeof keysRef.current) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); keysRef.current[key] = true },
    onPointerUp: (e: React.PointerEvent) => { e.preventDefault(); keysRef.current[key] = false },
    onPointerLeave: () => { keysRef.current[key] = false },
    onPointerCancel: () => { keysRef.current[key] = false },
  })
  const tBtn: React.CSSProperties = {
    width: 58, height: 58, borderRadius: '50%',
    background: 'rgba(10,6,2,0.55)', border: '2px solid rgba(200,148,26,0.55)',
    color: '#e0b860', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
    userSelect: 'none', touchAction: 'none',
  }

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: CW, margin: '0 auto' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', display: 'block', border: '1px solid #2a1c08', background: '#030014' }}
      />
      {isTouch && (
        <>
          <div style={{ position: 'absolute', left: 12, bottom: 12, display: 'flex', gap: 10 }}>
            <div style={tBtn} {...bindTouch('left')}>◀</div>
            <div style={tBtn} {...bindTouch('right')}>▶</div>
          </div>
          <div style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ ...tBtn, width: 48, height: 48, fontSize: 16 }} {...bindTouch('dash')}>⚡</div>
            <div style={tBtn} {...bindTouch('attack')}>⚔</div>
            <div style={tBtn} {...bindTouch('jump')}>⤒</div>
            <div style={{ ...tBtn, width: 48, height: 48, fontSize: 16 }} {...bindTouch('action')}>E</div>
          </div>
          {mode === 'explore' && (
            <div
              style={{ position: 'absolute', right: 12, top: 10, padding: '6px 14px', borderRadius: 6, background: 'rgba(10,6,2,0.55)', border: '1px solid rgba(200,148,26,0.55)', color: '#e0b860', fontSize: 13, userSelect: 'none' }}
              onPointerDown={() => onExit()}
            >
              ⛵ Корабль
            </div>
          )}
        </>
      )}
    </div>
  )
}
