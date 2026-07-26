import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { sfx } from '../audio/sfx'

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
const ATK_MS = 240
const ATK_CD_MS = 300
const ATK_RANGE = 64
const COMBO_WINDOW_MS = 520          // press again within this to chain
const COMBO_DMG = [30, 34, 52]       // third swing is the payoff
const PARRY_MS = 320                 // total guard duration
const PARRY_PERFECT_MS = 160         // early frames negate damage and stagger
const PARRY_CD_MS = 520
const INVULN_MS = 800
const HITSTOP_LIGHT = 55             // freeze-frames sell the impact
const HITSTOP_HEAVY = 110
const MAX_PARTICLES = 380

// ─── Palette ─────────────────────────────────────────────────────────────────
const P = {
  skyStops: ['#030014', '#0a0530', '#1a0a44', '#2c0e3c', '#481408', '#6a2008'] as string[],
  moon: '#e8e0c8', moonGlow: 'rgba(232,224,200,0.10)',
  cityFill: '#0a0503', cityGlow: '#ff5510',
  ruinFill: '#120a06', fgFill: '#050302',
  seaTop: '#06122a', seaBot: '#020812', seaLine: '#0e2b48', moonPath: 'rgba(220,210,170,0.05)',
  gndTop: '#42300c', gnd: '#2c1e08', gndDark: '#1a1205', pebble: '#54400f',
  stoneA: '#1c1209', stoneB: '#2c1c0e', stoneC: '#3e2814', stoneHi: '#5c3e20',
  woodA: '#2a1608', woodB: '#3e220c', woodHi: '#583414',
  body: '#0d0805', gold: '#c8941a', goldHi: '#f0b840', goldDk: '#7e5a08',
  crimson: '#8a0a08', crimsonHi: '#c42018', skin: '#7a4e1e', blade: '#9a98a8', bladeHi: '#d8d8e8',
  fire0: '#ff5500', fire1: '#dd2200', fire2: '#ffaa00', fireCore: '#fff4d0',
  portal0: '#5020b0', portal1: '#9050e8', portalCore: '#d8b0ff',
  npcRobe: '#3a2a10', npcSkin: '#6a3e14',
  enemyRag: '#241408', enemyEye: '#ff3000', dogFur: '#1c1410', archerCloak: '#1e2a18',
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
  combo: number; comboT: number
  parryT: number; parryCd: number; parryFlash: number
  stepT: number; air: boolean
}
interface Enemy {
  id: string; kind: 'marauder' | 'dog' | 'archer'
  x: number; y: number; vx: number; homeX: number
  hp: number; maxHp: number; facing: Facing
  state: 'patrol' | 'chase' | 'windup' | 'strike' | 'stagger' | 'dead'
  t: number; phase: number; flash: number; deadT: number
}
interface Projectile { x: number; y: number; vx: number; vy: number; life: number; from: 'archer' }
interface DamageNum { x: number; y: number; v: number; life: number; crit: boolean }
interface Hector {
  x: number; y: number; vx: number; vy: number; facing: Facing
  hp: number; maxHp: number
  state: 'enter' | 'approach' | 'tellLunge' | 'lunge' | 'tellSlam' | 'slam' | 'stagger' | 'dying'
  t: number; phase: number; flash: number
  waveX: number; waveActive: boolean; waveDir: Facing
}
/**
 * Poseidon's Messenger — a drowned man worn as a glove by the sea.
 * Fights at range and denies ground, where Hector closes and commits.
 */
interface Messenger {
  x: number; y: number; facing: Facing
  hp: number; maxHp: number
  state: 'rise' | 'drift' | 'tellSpout' | 'spout' | 'tellSurge' | 'surge' | 'grab' | 'stagger' | 'dying'
  t: number; phase: number; flash: number
  spouts: { x: number; t: number }[]
  surgeX: number; surgeActive: boolean; surgeDir: Facing
  tide: number
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
  { id: 'arc1',  kind: 'archer',   x: 2560, y: 374,      vx: 0, homeX: 2560, hp: 34, maxHp: 34, facing: -1 },
  { id: 'dog2',  kind: 'dog',      x: 2940, y: GROUND_Y, vx: 0, homeX: 2940, hp: 40, maxHp: 40, facing: 1 },
  { id: 'arc2',  kind: 'archer',   x: 3230, y: 390,      vx: 0, homeX: 3230, hp: 34, maxHp: 34, facing: -1 },
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
  { id: 'tarc1', kind: 'archer',   x: 1700, y: 345,      vx: 0, homeX: 1700, hp: 34, maxHp: 34, facing: -1 },
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

// Messenger arena: a tidal flat. Higher ground matters because the surge
// sweeps everything standing on the sand.
const PLATS_DUEL2: Platform[] = [
  { x: 150,  y: 372, w: 130, h: 30, kind: 'stone' },
  { x: 470,  y: 344, w: 110, h: 26, kind: 'stone' },
  { x: 900,  y: 344, w: 110, h: 26, kind: 'stone' },
  { x: 1220, y: 372, w: 130, h: 30, kind: 'stone' },
]
const OBJS_DUEL2: LevelObj[] = [
  { id: 'wcol1', x: 60,   y: GROUND_Y - 210, w: 48, h: 210, kind: 'col', label: '' },
  { id: 'wcol2', x: 1392, y: GROUND_Y - 210, w: 48, h: 210, kind: 'col', label: '' },
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
/** Vertical two-stop fill — cheap volume on otherwise flat silhouettes. */
function vgrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, top: string, bot: string) {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  g.addColorStop(0, top); g.addColorStop(1, bot)
  return g
}
/** Horizontal fill used for side-lit props. */
function hgrad(ctx: CanvasRenderingContext2D, x0: number, x1: number, left: string, right: string) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0)
  g.addColorStop(0, left); g.addColorStop(1, right)
  return g
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
  // Moon — one soft falloff, then the disc, then faint maria
  const mx = CW * 0.78, my = 82
  const halo = g.createRadialGradient(mx, my, 8, mx, my, 120)
  halo.addColorStop(0, 'rgba(226,220,196,0.22)')
  halo.addColorStop(0.28, 'rgba(200,196,180,0.09)')
  halo.addColorStop(1, 'rgba(180,180,170,0)')
  g.fillStyle = halo
  g.fillRect(mx - 120, my - 120, 240, 240)
  const disc = g.createRadialGradient(mx - 6, my - 7, 2, mx, my, 24)
  disc.addColorStop(0, '#f6f2e2')
  disc.addColorStop(0.7, '#e2dcc4')
  disc.addColorStop(1, '#c6bfa4')
  g.fillStyle = disc
  g.beginPath(); g.arc(mx, my, 24, 0, Math.PI * 2); g.fill()
  g.globalAlpha = 0.18
  g.fillStyle = '#6c6552'
  g.beginPath(); g.arc(mx - 8, my - 5, 6, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.arc(mx + 6, my + 7, 4, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.arc(mx + 9, my - 8, 2.6, 0, Math.PI * 2); g.fill()
  g.globalAlpha = 1
  return c
}

/**
 * Burning Troy on the horizon. Kept deliberately small and near-black: it is a
 * city seen from a beach kilometres away, not a wall behind the player.
 */
function makeCityLayer(): HTMLCanvasElement {
  const W = 1400, H = 120
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!

  // fire glow behind the skyline, so towers read as backlit
  const glow = g.createLinearGradient(0, H - 96, 0, H)
  glow.addColorStop(0, 'rgba(255,90,20,0)')
  glow.addColorStop(0.55, 'rgba(255,96,22,0.20)')
  glow.addColorStop(1, 'rgba(255,130,40,0.34)')
  g.fillStyle = glow
  g.fillRect(0, H - 96, W, 96)

  g.fillStyle = '#070403'
  // curtain wall
  g.fillRect(0, H - 26, W, 26)
  for (let x = 0; x < W; x += 22) g.fillRect(x, H - 32, 12, 7)
  // towers of varying height, none tall enough to crowd the play area
  const towers = [95, 268, 431, 605, 742, 918, 1096, 1278]
  towers.forEach((tx, i) => {
    const th = 26 + prand(i + 40) * 34
    const tw = 26 + prand(i + 80) * 16
    g.fillRect(tx - tw / 2, H - 26 - th, tw, th)
    for (let m = tx - tw / 2; m < tx + tw / 2 - 5; m += 10) g.fillRect(m, H - 32 - th, 6, 7)
  })
  // the Scaean gate
  g.fillRect(645, H - 62, 62, 36)
  g.fillStyle = 'rgba(255,120,40,0.55)'
  g.beginPath(); g.arc(676, H - 26, 15, Math.PI, 0); g.fill()
  // fires burning on the roofs
  g.fillStyle = 'rgba(255,140,50,0.5)'
  towers.forEach((tx, i) => {
    if (prand(i + 200) < 0.45) return
    const th = 26 + prand(i + 40) * 34
    g.beginPath()
    g.ellipse(tx, H - 30 - th, 10 + prand(i + 210) * 6, 5, 0, 0, Math.PI * 2)
    g.fill()
  })
  return c
}

/** Ruined colonnade on the beach itself — mid-distance, stands on the ground line. */
function makeRuinsLayer(): HTMLCanvasElement {
  const W = 1100, H = 150
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = P.ruinFill
  for (let i = 0; i < 11; i++) {
    const x = prand(i + 11) * W
    const h = 34 + prand(i + 22) * 96
    const w = 11 + prand(i + 33) * 16
    g.fillRect(x, H - h, w, h)
    // broken capital
    if (prand(i + 44) > 0.45) g.fillRect(x - 6, H - h, w + 12, 7)
    // fallen drum beside it
    if (prand(i + 55) > 0.6) {
      g.beginPath()
      g.ellipse(x + w + 14, H - 5, 13, 5, 0, 0, Math.PI * 2)
      g.fill()
    }
  }
  // low architrave fragments lying along the sand
  for (let i = 0; i < 5; i++) {
    const x = prand(i + 77) * W
    g.fillRect(x, H - 9, 44 + prand(i + 88) * 40, 9)
  }
  return c
}

// ─── Component ───────────────────────────────────────────────────────────────
interface Props {
  mode: 'explore' | 'duel' | 'duel2'
  onExit: () => void
  onTriggerEvent: (id: string) => void
  onDuelEnd: (won: boolean) => void
}

export function GameCanvas({ mode, onExit, onTriggerEvent, onDuelEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isTouch] = useState(() => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0))

  const cbRef = useRef({ onExit, onTriggerEvent, onDuelEnd })
  cbRef.current = { onExit, onTriggerEvent, onDuelEnd }

  const keysRef = useRef({ left: false, right: false, jump: false, action: false, dash: false, attack: false, parry: false })

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
    const isHectorDuel = mode === 'duel'
    const isSeaDuel = mode === 'duel2'
    const isDuel = isHectorDuel || isSeaDuel

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
      combo: 0, comboT: 0,
      parryT: 0, parryCd: 0, parryFlash: 0,
      stepT: 0, air: false,
    }
    const spawnEnemies = (loc: LocKey): Enemy[] =>
      LOCATIONS[loc].enemies
        .filter(e => !persist.dead.has(e.id))
        .map(e => ({ ...e, state: 'patrol' as const, t: 0, phase: prand(e.x) * 6, flash: 0, deadT: 0 }))
    const spawnPickups = (loc: LocKey): Pickup[] =>
      LOCATIONS[loc].pickups.filter(p => !persist.got.has(p.id)).map(p => ({ ...p }))

    let location: LocKey = startLoc
    let plats: Platform[] = isSeaDuel ? PLATS_DUEL2 : isHectorDuel ? PLATS_DUEL : [...LOCATIONS[startLoc].plats]
    let objs: LevelObj[] = isSeaDuel ? OBJS_DUEL2 : isHectorDuel ? OBJS_DUEL : LOCATIONS[startLoc].objs
    let pickups: Pickup[] = isDuel ? [] : spawnPickups(startLoc)
    let enemies: Enemy[] = isDuel ? [] : spawnEnemies(startLoc)
    let levelW = isDuel ? DUEL_W : LOCATIONS[startLoc].width

    const hector: Hector | null = isHectorDuel ? {
      x: 1050, y: GROUND_Y, vx: 0, vy: 0, facing: -1,
      hp: 300, maxHp: 300, state: 'enter', t: 0, phase: 0, flash: 0,
      waveX: 0, waveActive: false, waveDir: -1,
    } : null

    const messenger: Messenger | null = isSeaDuel ? {
      x: 1080, y: GROUND_Y, facing: -1,
      hp: 340, maxHp: 340, state: 'rise', t: 0, phase: 0, flash: 0,
      spouts: [], surgeX: 0, surgeActive: false, surgeDir: -1, tide: 0,
    } : null

    const particles: Particle[] = []
    let projectiles: Projectile[] = []
    let dmgNums: DamageNum[] = []
    let emberT = 0, ashT = 0
    let camX = 0
    let time = 0
    let lastTs = performance.now()
    let portalCd = 0
    let dialogue: { name: string; role: string; line: string; t: number } | null = null
    let prompt: { label: string; x: number; y: number } | null = null
    let shake = 0
    let hitStop = 0
    let lightning = 0, lightningT = 2 + Math.random() * 6
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
      if (k === 'k' || k === 'c') keys.parry = true
      if (k === 'm') sfx.toggle()
      if (k === 'escape' && !isDuel) cbRef.current.onExit()
      sfx.unlock()
    }
    const ku = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'a' || e.key === 'ArrowLeft') keys.left = false
      if (k === 'd' || e.key === 'ArrowRight') keys.right = false
      if (k === 'w' || k === ' ' || e.key === 'ArrowUp') keys.jump = false
      if (k === 'e' || k === 'enter') keys.action = false
      if (k === 'shift') keys.dash = false
      if (k === 'j' || k === 'x' || k === 'f') keys.attack = false
      if (k === 'k' || k === 'c') keys.parry = false
    }
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    sfx.startAmbient()

    // ── Combat helpers ──
    /** Returns true when the blow was answered by the guard instead of the body. */
    const tryParry = (fromX: number): 'perfect' | 'blocked' | null => {
      if (player.parryT <= 0) return null
      const facingIt = (fromX - player.x) * player.facing > 0
      if (!facingIt) return null
      const elapsed = PARRY_MS - player.parryT
      return elapsed <= PARRY_PERFECT_MS ? 'perfect' : 'blocked'
    }
    const hurtPlayer = (dmg: number, fromX: number) => {
      if (player.invuln > 0 || player.dashT > 0) return
      const par = tryParry(fromX)
      if (par) {
        player.parryFlash = 240
        player.invuln = 260
        sfx.parry()
        const dir: Facing = fromX > player.x ? 1 : -1
        burst(player.x + dir * 22, player.y - 46, par === 'perfect' ? 16 : 8, 235, 225, 255, par === 'perfect' ? 260 : 150)
        if (par === 'perfect') {
          hitStop = Math.max(hitStop, HITSTOP_HEAVY)
          shake = Math.max(shake, 7)
          dmgNums.push({ x: player.x, y: player.y - 96, v: 0, life: 0.9, crit: true })
          // stagger whoever swung
          for (const en of enemies) {
            if (en.state !== 'dead' && Math.abs(en.x - fromX) < 40) { en.state = 'stagger'; en.t = 0; en.vx = dir * 150 }
          }
          if (hector && Math.abs(hector.x - fromX) < 60 && hector.state !== 'dying') { hector.state = 'stagger'; hector.t = 0 }
        } else {
          hitStop = Math.max(hitStop, HITSTOP_LIGHT)
          useGameStore.getState().damagePlayer(Math.max(1, Math.round(dmg * 0.35)))
        }
        return
      }
      player.invuln = INVULN_MS
      player.flash = 200
      player.combo = 0
      player.vx = player.x < fromX ? -260 : 260
      player.vy = -220
      shake = 9
      hitStop = Math.max(hitStop, HITSTOP_LIGHT)
      sfx.hurt()
      burst(player.x, player.y - 40, 10, 200, 30, 20)
      dmgNums.push({ x: player.x, y: player.y - 84, v: dmg, life: 0.9, crit: false })
      useGameStore.getState().damagePlayer(dmg)
    }

    // ── Main loop ──
    const loop = (ts: number) => {
      const rawDt = clamp((ts - lastTs) / 1000, 0, 0.033)
      lastTs = ts
      // Hit-stop freezes simulation for a few frames while rendering continues —
      // the single biggest contributor to how a hit *feels*.
      if (hitStop > 0) {
        hitStop -= rawDt * 1000
        raf = requestAnimationFrame(loop)
        return
      }
      const dt = rawDt
      time += dt

      // ════ UPDATE ════
      let moveVel = 0
      if (keys.left) moveVel = -MOVE_SPD
      else if (keys.right) moveVel = MOVE_SPD
      if (moveVel !== 0) player.facing = moveVel > 0 ? 1 : -1
      // guarding roots you in place
      if (player.parryT > 0) moveVel *= 0.25

      // dash
      player.dashCd = Math.max(0, player.dashCd - dt * 1000)
      if (keys.dash && player.dashCd <= 0 && player.dashT <= 0 && player.parryT <= 0) {
        player.dashT = DASH_MS
        player.dashDir = player.facing
        player.dashCd = DASH_CD_MS
        sfx.dash()
        burst(player.x, player.y - 20, 6, 200, 150, 60, 90)
      }
      if (player.dashT > 0) {
        moveVel = DASH_SPD * player.dashDir
        player.dashT -= dt * 1000
        addP({ x: player.x - player.dashDir * 14, y: player.y - 18 - Math.random() * 30, vx: -player.dashDir * 60, vy: -20, life: 0.22, max: 0.22, size: 3, r: 220, g: 170, b: 80, grav: 0 })
      }

      // parry / guard
      player.parryCd = Math.max(0, player.parryCd - dt * 1000)
      player.parryT = Math.max(0, player.parryT - dt * 1000)
      player.parryFlash = Math.max(0, player.parryFlash - dt * 1000)
      if (keys.parry && player.parryCd <= 0 && player.parryT <= 0 && player.dashT <= 0) {
        player.parryT = PARRY_MS
        player.parryCd = PARRY_CD_MS
        keys.parry = false
      }

      // attack — three-swing chain, the third lands heavy
      player.atkCd = Math.max(0, player.atkCd - dt * 1000)
      player.atkT = Math.max(0, player.atkT - dt * 1000)
      player.comboT = Math.max(0, player.comboT - dt * 1000)
      if (player.comboT <= 0 && player.atkT <= 0) player.combo = 0
      if (keys.attack && player.atkCd <= 0 && player.parryT <= 0) {
        // Airborne swing is a committed downward strike: more damage, and it
        // drives Odysseus down so the blow lands with his weight behind it.
        const air = !player.onGround
        player.air = air
        const step = air ? 0 : player.combo % 3
        const heavy = !air && step === 2
        player.atkT = heavy ? ATK_MS + 90 : ATK_MS
        player.atkCd = heavy ? ATK_CD_MS + 220 : ATK_CD_MS
        player.combo = air ? 0 : step + 1
        player.comboT = air ? 0 : COMBO_WINDOW_MS
        const dmg = air ? 40 : COMBO_DMG[step]
        const reach = heavy ? ATK_RANGE + 16 : ATK_RANGE
        sfx.swing(air ? 2 : step)
        if (air) {
          player.vy = Math.max(player.vy, 420)
          player.x += player.facing * 8
        } else if (heavy) {
          player.x += player.facing * 14
        }
        const hx = player.x + player.facing * reach * 0.6
        let connected = false
        for (const en of enemies) {
          if (en.state === 'dead') continue
          if (Math.abs(en.x - hx) < reach && Math.abs(en.y - player.y) < 70) {
            connected = true
            en.hp -= dmg
            en.flash = 120
            en.vx = player.facing * (heavy ? 380 : 200)
            dmgNums.push({ x: en.x, y: en.y - 60, v: dmg, life: 0.8, crit: heavy })
            burst(en.x, en.y - 30, heavy ? 14 : 8, 255, 200, 120, heavy ? 260 : 180)
            shake = Math.max(shake, heavy ? 8 : 4)
            if (en.hp <= 0) {
              en.state = 'dead'; en.deadT = 0
              persist.dead.add(en.id)
              sfx.enemyDie()
              burst(en.x, en.y - 30, 18, 120, 40, 30, 240)
            } else {
              en.state = 'chase'
            }
          }
        }
        if (hector && hector.state !== 'dying' && hector.state !== 'enter') {
          if (Math.abs(hector.x - hx) < reach + 20 && Math.abs(hector.y - player.y) < 90) {
            connected = true
            const hdmg = heavy ? 40 : 24
            hector.hp -= hdmg
            hector.flash = 110
            dmgNums.push({ x: hector.x, y: hector.y - 110, v: hdmg, life: 0.8, crit: heavy })
            burst(hector.x, hector.y - 60, heavy ? 16 : 10, 255, 120, 40, heavy ? 280 : 180)
            shake = Math.max(shake, heavy ? 9 : 5)
            if (hector.hp <= 0) {
              hector.state = 'dying'; hector.t = 0
              shake = 16
              hitStop = HITSTOP_HEAVY * 2
              sfx.bossRoar()
            }
          }
        }
        if (messenger && messenger.state !== 'dying' && messenger.state !== 'rise') {
          if (Math.abs(messenger.x - hx) < reach + 22 && Math.abs(messenger.y - player.y) < 96) {
            connected = true
            const mdmg = heavy ? 42 : 25
            messenger.hp -= mdmg
            messenger.flash = 110
            dmgNums.push({ x: messenger.x, y: messenger.y - 108, v: mdmg, life: 0.8, crit: heavy })
            burst(messenger.x, messenger.y - 56, heavy ? 16 : 10, 150, 205, 230, heavy ? 280 : 180)
            shake = Math.max(shake, heavy ? 9 : 5)
            if (messenger.hp <= 0) {
              messenger.state = 'dying'; messenger.t = 0
              messenger.surgeActive = false
              messenger.spouts = []
              shake = 16
              hitStop = HITSTOP_HEAVY * 2
              sfx.bossRoar()
            }
          }
        }
        // arrows can be swatted out of the air
        projectiles = projectiles.filter(pr => {
          if (Math.abs(pr.x - hx) < reach && Math.abs(pr.y - (player.y - 44)) < 46) {
            connected = true
            burst(pr.x, pr.y, 6, 220, 210, 180, 140)
            return false
          }
          return true
        })
        if (connected) {
          sfx.hit(heavy)
          hitStop = Math.max(hitStop, heavy ? HITSTOP_HEAVY : HITSTOP_LIGHT)
        }
        keys.attack = false
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
        sfx.jump()
        for (let i = 0; i < 5; i++) addP({ x: player.x + (Math.random() - 0.5) * 20, y: player.y, vx: (Math.random() - 0.5) * 120, vy: -40, life: 0.3, max: 0.3, size: 2, r: 120, g: 95, b: 60, grav: 300 })
      }
      if (player.onGround && !player.wasGround) {
        player.landTimer = 150
        sfx.land()
        for (let i = 0; i < 7; i++) addP({ x: player.x + (Math.random() - 0.5) * 26, y: player.y, vx: (Math.random() - 0.5) * 160, vy: -50, life: 0.35, max: 0.35, size: 2.2, r: 120, g: 95, b: 60, grav: 300 })
      }
      player.landTimer = Math.max(0, player.landTimer - dt * 1000)

      if (player.onGround && Math.abs(player.vx) > 10) {
        player.walkPhase += dt * 11
        player.stepT -= dt * 1000
        if (player.stepT <= 0) { player.stepT = 290; sfx.step() }
        if (Math.random() < 0.12) addP({ x: player.x - player.facing * 10, y: player.y, vx: -player.facing * 40, vy: -30, life: 0.25, max: 0.25, size: 1.6, r: 110, g: 88, b: 55, grav: 200 })
      } else {
        player.idlePhase += dt * 2
        player.stepT = 0
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
        const isArcher = en.kind === 'archer'
        const aggro = isArcher ? 430 : en.kind === 'dog' ? 340 : 260
        const reach = isArcher ? 380 : en.kind === 'dog' ? 42 : 56
        switch (en.state) {
          case 'patrol': {
            // Archers hold their perch; the others walk a beat.
            const span = 130
            en.vx = isArcher ? 0 : (en.kind === 'dog' ? 60 : 38) * en.facing
            if (!isArcher) {
              if (en.x > en.homeX + span) en.facing = -1
              if (en.x < en.homeX - span) en.facing = 1
            } else if (adx > 8) {
              en.facing = dx > 0 ? 1 : -1
            }
            if (adx < aggro && Math.abs(player.y - en.y) < (isArcher ? 220 : 90)) en.state = 'chase'
            break
          }
          case 'chase': {
            en.facing = dx > 0 ? 1 : -1
            if (isArcher) {
              // keep distance, then draw
              en.vx = adx < 150 ? -110 * en.facing : 0
              if (adx < reach && adx > 90) { en.state = 'windup'; en.t = 0; en.vx = 0 }
            } else {
              en.vx = (en.kind === 'dog' ? 190 : 120) * en.facing
              if (adx < reach) { en.state = 'windup'; en.t = 0; en.vx = 0 }
            }
            if (adx > aggro * 1.6) en.state = 'patrol'
            break
          }
          case 'windup': {
            en.vx = 0
            en.t += dt * 1000
            const tell = isArcher ? 620 : en.kind === 'dog' ? 320 : 450
            if (en.t > tell) { en.state = 'strike'; en.t = 0 }
            break
          }
          case 'strike': {
            en.t += dt * 1000
            if (isArcher) {
              if (en.t < 20) {
                // loose one arrow, led slightly toward the player
                const ax = en.x + en.facing * 18, ay = en.y - 46
                const tx = player.x, ty = player.y - 42
                const d = Math.max(60, Math.hypot(tx - ax, ty - ay))
                const spd = 560
                projectiles.push({ x: ax, y: ay, vx: ((tx - ax) / d) * spd, vy: ((ty - ay) / d) * spd - 40, life: 2.2, from: 'archer' })
                sfx.swing(0)
              } else if (en.t > 900) {
                en.state = adx < aggro ? 'chase' : 'patrol'
              }
            } else if (en.t < 140) {
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
          case 'stagger': {
            en.t += dt * 1000
            en.vx *= 0.86
            if (en.t > 700) { en.state = 'chase'; en.t = 0 }
            break
          }
        }
        en.x += en.vx * dt
        en.x = clamp(en.x, 40, levelW - 40)
      }
      enemies = enemies.filter(e => e.state !== 'dead' || e.deadT < 1.2)

      // ── Arrows in flight ──
      projectiles = projectiles.filter(pr => {
        pr.life -= dt
        if (pr.life <= 0) return false
        pr.vy += 320 * dt
        pr.x += pr.vx * dt
        pr.y += pr.vy * dt
        if (pr.y >= GROUND_Y) {
          burst(pr.x, GROUND_Y, 4, 130, 110, 80, 90)
          return false
        }
        if (Math.abs(pr.x - player.x) < 20 && pr.y > player.y - 78 && pr.y < player.y - 4) {
          hurtPlayer(10, pr.x)
          return false
        }
        return true
      })

      // ── Floating damage numbers ──
      for (let i = dmgNums.length - 1; i >= 0; i--) {
        const dn = dmgNums[i]
        dn.life -= dt
        dn.y -= dt * 34
        if (dn.life <= 0) dmgNums.splice(i, 1)
      }

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
              sfx.slam()
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

      // ── Messenger AI (sea duel) ──
      if (messenger && !duelEnded) {
        const M = messenger
        M.flash = Math.max(0, M.flash - dt * 1000)
        M.phase += dt * 2.2
        M.t += dt
        M.tide = 10 + Math.sin(time * 0.55) * 8
        const mdx = player.x - M.x
        if (M.state !== 'dying') M.facing = mdx > 0 ? 1 : -1

        switch (M.state) {
          case 'rise':
            if (M.t > 1.6) { M.state = 'drift'; M.t = 0 }
            break
          case 'drift': {
            // glides over the flat, never quite closing
            const want = player.x - M.facing * 250
            M.x += clamp(want - M.x, -110 * dt * 6, 110 * dt * 6) * dt * 2.4
            if (M.t > 1.5) {
              const r = Math.random()
              M.state = Math.abs(mdx) < 150 ? 'grab' : r < 0.5 ? 'tellSpout' : 'tellSurge'
              M.t = 0
            }
            break
          }
          case 'tellSpout':
            if (M.t > 0.62) {
              // three columns walk toward wherever the player stood
              M.state = 'spout'; M.t = 0
              const base = player.x
              M.spouts = [
                { x: base, t: 0 },
                { x: base + (mdx > 0 ? 130 : -130), t: -0.28 },
                { x: base + (mdx > 0 ? 260 : -260), t: -0.56 },
              ]
              sfx.slam()
            }
            break
          case 'spout':
            if (M.t > 1.5) { M.state = 'drift'; M.t = 0 }
            break
          case 'tellSurge':
            if (M.t > 0.75) {
              M.state = 'surge'; M.t = 0
              M.surgeActive = true
              M.surgeDir = mdx > 0 ? 1 : -1
              M.surgeX = M.x
              shake = 10
              sfx.slam()
            }
            break
          case 'surge':
            if (M.t > 1.5) { M.state = 'drift'; M.t = 0 }
            break
          case 'grab':
            if (M.t < 0.34) {
              M.x += M.facing * 340 * dt
              if (Math.abs(player.x - M.x) < 50 && Math.abs(player.y - M.y) < 84) hurtPlayer(16, M.x)
            } else if (M.t > 0.9) { M.state = 'stagger'; M.t = 0 }
            break
          case 'stagger':
            if (M.t > 0.8) { M.state = 'drift'; M.t = 0 }
            break
          case 'dying':
            if (M.t > 1.8) { duelEnded = true; cbRef.current.onDuelEnd(true) }
            break
        }

        // water columns erupting from the sand
        for (const sp of M.spouts) {
          sp.t += dt
          if (sp.t > 0.34 && sp.t < 0.62 &&
              Math.abs(player.x - sp.x) < 30 && player.y > GROUND_Y - 130) {
            hurtPlayer(14, sp.x)
          }
          if (sp.t > 0.2 && sp.t < 0.7 && Math.random() < 0.7) {
            addP({
              x: sp.x + (Math.random() - 0.5) * 26, y: GROUND_Y,
              vx: (Math.random() - 0.5) * 90, vy: -280 - Math.random() * 190,
              life: 0.6, max: 0.6, size: 2 + Math.random() * 2.5,
              r: 130, g: 190, b: 220, grav: 520,
            })
          }
        }
        M.spouts = M.spouts.filter(sp => sp.t < 1.1)

        // the surge: a wall of water at ankle height — get off the sand
        if (M.surgeActive) {
          M.surgeX += M.surgeDir * 400 * dt
          for (let i = 0; i < 2; i++) {
            addP({
              x: M.surgeX + (Math.random() - 0.5) * 30, y: GROUND_Y - Math.random() * 40,
              vx: M.surgeDir * 70, vy: -110 - Math.random() * 90,
              life: 0.45, max: 0.45, size: 2 + Math.random() * 2,
              r: 150, g: 200, b: 225, grav: 420,
            })
          }
          if (Math.abs(player.x - M.surgeX) < 34 && player.y > GROUND_Y - 40) {
            hurtPlayer(13, M.surgeX - M.surgeDir * 10)
          }
          if (M.surgeX < -40 || M.surgeX > DUEL_W + 40) M.surgeActive = false
        }
        M.x = clamp(M.x, 70, DUEL_W - 70)
      }

      // ── Pickups ──
      for (const pk of pickups) {
        if (pk.got) continue
        const dx = player.x - pk.x, dy = (player.y - 20) - pk.y
        if (dx * dx + dy * dy < 38 * 38) {
          pk.got = true
          persist.got.add(pk.id)
          st.addPickup(pk.kind)
          sfx.pickup()
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
            sfx.portal()
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
      // distant lightning over the burning city
      lightning = Math.max(0, lightning - dt * 1000)
      lightningT -= dt
      if (lightningT <= 0 && (location === 'troy' || isDuel)) {
        lightningT = 7 + Math.random() * 13
        lightning = 190
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

      // lightning wash — a two-stage flicker, brightest at the horizon
      if (lightning > 0) {
        const lf = lightning / 190
        const stage = lf > 0.82 ? 1 : lf > 0.6 ? 0.35 : lf * 0.5
        ctx.fillStyle = `rgba(180,190,235,${0.4 * stage})`
        ctx.fillRect(0, 0, CW, CH * 0.62)
      }

      // warm haze where the burning city meets the water
      const flick = 0.5 + Math.sin(time * 9) * 0.18 + Math.sin(time * 23.7) * 0.1
      ctx.globalAlpha = 0.5 * flick
      ctx.fillStyle = cityGlowGrad
      ctx.fillRect(0, 150, CW, 175)
      ctx.globalAlpha = 1

      // burning Troy on the horizon (parallax 0.04), base sitting on the sea line
      const cityY = 318 - 120
      const cityOff = -((camX * 0.04) % 1400)
      ctx.drawImage(cityLayer, cityOff, cityY)
      ctx.drawImage(cityLayer, cityOff + 1400, cityY)

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

      // beach ruins standing on the ground line (parallax 0.22)
      ctx.globalAlpha = 0.85
      const ruinsOff = -((camX * 0.22) % 1100)
      ctx.drawImage(ruinsLayer, ruinsOff, GROUND_Y - 150)
      ctx.drawImage(ruinsLayer, ruinsOff + 1100, GROUND_Y - 150)
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

      // Messenger arena is a tidal flat: standing water sheeting over the sand,
      // rising and falling with the boss's own breathing tide.
      if (messenger) {
        const t2 = messenger.tide
        const wetGrad = ctx.createLinearGradient(0, GROUND_Y, 0, CH)
        wetGrad.addColorStop(0, `rgba(30,80,115,${0.5 + t2 * 0.012})`)
        wetGrad.addColorStop(0.45, 'rgba(14,42,64,0.4)')
        wetGrad.addColorStop(1, 'rgba(6,20,32,0.16)')
        ctx.fillStyle = wetGrad
        ctx.fillRect(0, GROUND_Y, CW, CH - GROUND_Y)
        // sky reflected in the sheet of water
        ctx.globalAlpha = 0.16
        ctx.fillStyle = '#5a3a70'
        ctx.fillRect(0, GROUND_Y, CW, 16)
        ctx.globalAlpha = 1
        // ripple lines drifting shoreward
        ctx.strokeStyle = 'rgba(150,205,235,0.2)'
        ctx.lineWidth = 1.2
        for (let i = 0; i < 4; i++) {
          const ry = GROUND_Y + 12 + i * 22
          ctx.beginPath()
          for (let x = 0; x <= CW; x += 26) {
            const yy = ry + Math.sin(x * 0.022 + time * (0.9 + i * 0.25) + i) * 2.4
            if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy)
          }
          ctx.stroke()
        }
      }

      ctx.save()
      ctx.translate(-camX, 0)

      // ── platforms ──
      for (const pl of plats) {
        if (pl.x + pl.w < camX - 40 || pl.x > camX + CW + 40) continue
        if (pl.kind === 'stone') {
          ctx.fillStyle = vgrad(ctx, pl.y, pl.y + pl.h, '#3a2512', '#1a1008')
          rr(ctx, pl.x, pl.y, pl.w, pl.h, 3); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
          ctx.fillStyle = P.stoneHi; ctx.fillRect(pl.x + 2, pl.y + 1.5, pl.w - 4, 2.5)
          ctx.strokeStyle = P.stoneA; ctx.lineWidth = 1
          for (let x = pl.x + 18; x < pl.x + pl.w - 6; x += 26) {
            ctx.beginPath(); ctx.moveTo(x, pl.y + 4); ctx.lineTo(x, pl.y + pl.h - 3); ctx.stroke()
          }
        } else if (pl.kind === 'wood') {
          ctx.fillStyle = vgrad(ctx, pl.y, pl.y + pl.h, '#3c2110', '#1e1206')
          rr(ctx, pl.x, pl.y, pl.w, pl.h, 2); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
          ctx.fillStyle = P.woodHi; ctx.fillRect(pl.x + 2, pl.y + 1.5, pl.w - 4, 2)
          ctx.strokeStyle = P.woodB; ctx.lineWidth = 1.4
          for (let x = pl.x + 14; x < pl.x + pl.w; x += 22) {
            ctx.beginPath(); ctx.moveTo(x, pl.y + 2); ctx.lineTo(x, pl.y + pl.h - 2); ctx.stroke()
          }
        } else {
          // supply crate: slats, corner irons, a hint of a merchant's mark
          ctx.fillStyle = vgrad(ctx, pl.y, pl.y + pl.h, '#4a2b12', '#26160a')
          rr(ctx, pl.x, pl.y, pl.w, pl.h, 2); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
          ctx.strokeStyle = 'rgba(20,12,6,0.9)'; ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(pl.x + 4, pl.y + pl.h * 0.5); ctx.lineTo(pl.x + pl.w - 4, pl.y + pl.h * 0.5)
          ctx.stroke()
          ctx.strokeStyle = P.woodHi; ctx.lineWidth = 1.4
          ctx.globalAlpha = 0.55
          ctx.beginPath(); ctx.moveTo(pl.x + 4, pl.y + pl.h - 4); ctx.lineTo(pl.x + pl.w - 4, pl.y + 4); ctx.stroke()
          ctx.globalAlpha = 1
          ctx.fillStyle = 'rgba(90,60,26,0.8)'
          ctx.fillRect(pl.x + 2, pl.y + 2, 4, pl.h - 4)
          ctx.fillRect(pl.x + pl.w - 6, pl.y + 2, 4, pl.h - 4)
        }
      }

      // ── level objects ──
      for (const ob of objs) {
        if (ob.x + ob.w < camX - 220 || ob.x > camX + CW + 220) continue
        const t = time
        if (ob.kind === 'col') {
          // fluted column with capital and base, rim-lit by fires
          ctx.fillStyle = hgrad(ctx, ob.x, ob.x + ob.w, '#100a05', '#33210f')
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
          ctx.fillStyle = vgrad(ctx, ob.y, ob.y + ob.h, '#241708', '#0e0904')
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
          // canvas is lit from the fire side, dark on the other
          ctx.fillStyle = hgrad(ctx, ob.x, ob.x + ob.w, '#2b1a09', '#4a2c10')
          ctx.beginPath()
          ctx.moveTo(ob.x + ob.w / 2, ob.y)
          ctx.lineTo(ob.x, ob.y + ob.h)
          ctx.lineTo(ob.x + ob.w, ob.y + ob.h)
          ctx.closePath(); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2.2; ctx.stroke()
          // dyed bands, muted so they read as cloth rather than paint
          ctx.save()
          ctx.beginPath()
          ctx.moveTo(ob.x + ob.w / 2, ob.y)
          ctx.lineTo(ob.x, ob.y + ob.h)
          ctx.lineTo(ob.x + ob.w, ob.y + ob.h)
          ctx.closePath(); ctx.clip()
          ctx.globalAlpha = 0.5
          ctx.strokeStyle = '#5e1410'; ctx.lineWidth = 7
          ctx.beginPath(); ctx.moveTo(ob.x + ob.w / 2, ob.y + 10); ctx.lineTo(ob.x + ob.w * 0.16, ob.y + ob.h); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(ob.x + ob.w / 2, ob.y + 10); ctx.lineTo(ob.x + ob.w * 0.84, ob.y + ob.h); ctx.stroke()
          ctx.globalAlpha = 0.28
          ctx.strokeStyle = '#8a6a2a'; ctx.lineWidth = 3
          ctx.beginPath(); ctx.moveTo(ob.x + ob.w / 2, ob.y + 14); ctx.lineTo(ob.x + ob.w * 0.34, ob.y + ob.h); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(ob.x + ob.w / 2, ob.y + 14); ctx.lineTo(ob.x + ob.w * 0.66, ob.y + ob.h); ctx.stroke()
          ctx.restore()
          ctx.globalAlpha = 1
          // guy ropes
          ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.2
          ctx.beginPath(); ctx.moveTo(ob.x + 6, ob.y + ob.h); ctx.lineTo(ob.x - 16, ob.y + ob.h); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(ob.x + ob.w - 6, ob.y + ob.h); ctx.lineTo(ob.x + ob.w + 16, ob.y + ob.h); ctx.stroke()
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
        } else if (en.kind === 'archer') {
          const draw = en.state === 'windup' ? Math.min(1, en.t / 620) : 0
          const sway = Math.sin(en.phase * 0.4) * 1.2
          // legs
          ctx.strokeStyle = fl ? '#8a6a48' : P.archerCloak; ctx.lineWidth = 5
          ctx.beginPath(); ctx.moveTo(-3, -30); ctx.lineTo(-6, 0); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(4, -30); ctx.lineTo(8, 0); ctx.stroke()
          // hooded body
          ctx.fillStyle = fl ? '#8a6a48' : P.archerCloak
          ctx.beginPath()
          ctx.moveTo(-11, -28)
          ctx.lineTo(-8, -56 + sway); ctx.lineTo(9, -56 + sway); ctx.lineTo(12, -28)
          ctx.closePath(); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
          // hood
          ctx.fillStyle = fl ? '#8a6a48' : '#16200f'
          ctx.beginPath(); ctx.arc(0, -64 + sway, 9.5, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
          ctx.fillStyle = 'rgba(0,0,0,0.55)'
          ctx.beginPath(); ctx.arc(0, -66 + sway, 9.5, Math.PI, 0); ctx.fill()
          ctx.fillStyle = en.state === 'patrol' ? '#a8a070' : P.enemyEye
          ctx.beginPath(); ctx.arc(4, -64 + sway, 1.7, 0, Math.PI * 2); ctx.fill()
          // bow, drawn deeper as the shot charges
          const bx = 14, by = -48 + sway
          ctx.strokeStyle = P.woodB; ctx.lineWidth = 3
          ctx.beginPath(); ctx.arc(bx, by, 20, -1.15, 1.15); ctx.stroke()
          ctx.strokeStyle = '#c8c0a0'; ctx.lineWidth = 1.2
          const pull = draw * 11
          ctx.beginPath()
          ctx.moveTo(bx + 20 * Math.cos(-1.15), by + 20 * Math.sin(-1.15))
          ctx.lineTo(bx - pull, by)
          ctx.lineTo(bx + 20 * Math.cos(1.15), by + 20 * Math.sin(1.15))
          ctx.stroke()
          if (draw > 0.05) {
            ctx.strokeStyle = P.woodB; ctx.lineWidth = 2
            ctx.beginPath(); ctx.moveTo(bx - pull, by); ctx.lineTo(bx + 22, by); ctx.stroke()
          }
          // arms
          ctx.strokeStyle = fl ? '#8a6a48' : P.archerCloak; ctx.lineWidth = 4
          ctx.beginPath(); ctx.moveTo(4, -52 + sway); ctx.lineTo(bx, by); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(2, -50 + sway); ctx.lineTo(bx - pull - 2, by + 2); ctx.stroke()
          // telegraph glint before release
          if (draw > 0.75) {
            ctx.fillStyle = `rgba(255,120,60,${(draw - 0.75) * 2.4})`
            ctx.beginPath(); ctx.arc(bx + 22, by, 3.4, 0, Math.PI * 2); ctx.fill()
          }
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
          const barY = en.y - (en.kind === 'dog' ? 44 : en.kind === 'archer' ? 80 : 86)
          ctx.fillStyle = 'rgba(0,0,0,0.6)'
          ctx.fillRect(en.x - w / 2, barY, w, 4)
          ctx.fillStyle = '#c03020'
          ctx.fillRect(en.x - w / 2, barY, w * frac, 4)
        }
        // windup telegraph — a red tick above whoever is about to swing
        if (en.state === 'windup') {
          const tell = en.kind === 'archer' ? 620 : en.kind === 'dog' ? 320 : 450
          const f = Math.min(1, en.t / tell)
          ctx.fillStyle = `rgba(255,60,30,${0.35 + f * 0.55})`
          ctx.beginPath()
          ctx.arc(en.x, en.y - (en.kind === 'dog' ? 56 : 96), 3 + f * 2.5, 0, Math.PI * 2)
          ctx.fill()
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

      // ── Messenger ──
      if (messenger) {
        const M = messenger
        // telegraph markers on the sand where the columns will burst
        for (const sp of M.spouts) {
          if (sp.t < 0.34 && sp.t > -0.6) {
            const warn = clamp((sp.t + 0.6) / 0.94, 0, 1)
            ctx.strokeStyle = `rgba(120,200,235,${0.3 + warn * 0.6})`
            ctx.lineWidth = 2.5
            ctx.beginPath(); ctx.ellipse(sp.x, GROUND_Y, 26 * warn, 8 * warn, 0, 0, Math.PI * 2); ctx.stroke()
          }
          if (sp.t >= 0.28 && sp.t < 0.85) {
            const up = clamp((sp.t - 0.28) / 0.2, 0, 1)
            const fade = clamp(1 - (sp.t - 0.5) / 0.35, 0, 1)
            const h = 150 * up
            const wg = ctx.createLinearGradient(0, GROUND_Y - h, 0, GROUND_Y)
            wg.addColorStop(0, `rgba(215,240,250,${0.85 * fade})`)
            wg.addColorStop(0.5, `rgba(110,180,215,${0.7 * fade})`)
            wg.addColorStop(1, `rgba(40,90,130,${0.5 * fade})`)
            ctx.fillStyle = wg
            ctx.beginPath()
            ctx.moveTo(sp.x - 17, GROUND_Y)
            ctx.quadraticCurveTo(sp.x - 12, GROUND_Y - h * 0.6, sp.x - 5, GROUND_Y - h)
            ctx.lineTo(sp.x + 5, GROUND_Y - h)
            ctx.quadraticCurveTo(sp.x + 12, GROUND_Y - h * 0.6, sp.x + 17, GROUND_Y)
            ctx.closePath(); ctx.fill()
          }
        }
        // the surge front
        if (M.surgeActive) {
          const sg = ctx.createLinearGradient(0, GROUND_Y - 46, 0, GROUND_Y)
          sg.addColorStop(0, 'rgba(220,245,255,0.75)')
          sg.addColorStop(1, 'rgba(35,90,130,0.6)')
          ctx.fillStyle = sg
          ctx.beginPath()
          ctx.moveTo(M.surgeX - M.surgeDir * 90, GROUND_Y)
          ctx.quadraticCurveTo(M.surgeX - M.surgeDir * 26, GROUND_Y - 48, M.surgeX, GROUND_Y - 40)
          ctx.quadraticCurveTo(M.surgeX + M.surgeDir * 12, GROUND_Y - 16, M.surgeX + M.surgeDir * 18, GROUND_Y)
          ctx.closePath(); ctx.fill()
          ctx.strokeStyle = 'rgba(235,250,255,0.85)'; ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(M.surgeX - M.surgeDir * 90, GROUND_Y - 3)
          ctx.quadraticCurveTo(M.surgeX - M.surgeDir * 26, GROUND_Y - 50, M.surgeX, GROUND_Y - 40)
          ctx.stroke()
        }

        ctx.save()
        ctx.translate(M.x, M.y)
        if (M.state === 'dying') ctx.globalAlpha = Math.max(0, 1 - M.t / 1.7)
        if (M.state === 'rise') ctx.globalAlpha = Math.min(1, M.t / 1.4)
        ctx.scale(M.facing, 1)
        const mfl = M.flash > 0
        const tellM = M.state === 'tellSpout' || M.state === 'tellSurge'
        const risen = M.state === 'rise' ? Math.min(1, M.t / 1.4) : 1
        ctx.translate(0, (1 - risen) * 90)
        const sway = Math.sin(M.phase) * 4

        // cold aura off the body
        const maur = ctx.createRadialGradient(0, -58, 8, 0, -58, 92)
        maur.addColorStop(0, `rgba(90,190,220,${tellM ? 0.32 : 0.15})`)
        maur.addColorStop(1, 'rgba(60,140,190,0)')
        ctx.fillStyle = maur
        ctx.fillRect(-92, -150, 184, 160)

        // No legs — the sea carries it, narrowing to a wrung column at the waist
        // and flaring where it meets the sand.
        const bodyGrad = vgrad(ctx, -110, 6, mfl ? '#7ec4d8' : '#0f3348', '#030d16')
        ctx.fillStyle = bodyGrad
        ctx.beginPath()
        ctx.moveTo(-13, -88)
        ctx.quadraticCurveTo(-8 + sway * 0.5, -58, -11 + sway, -30)
        ctx.quadraticCurveTo(-22 + sway * 1.7, -12, -30 + sway * 2, 4)
        ctx.lineTo(30 + sway * 2, 4)
        ctx.quadraticCurveTo(22 + sway * 1.7, -12, 11 + sway, -30)
        ctx.quadraticCurveTo(8 + sway * 0.5, -58, 13, -88)
        ctx.closePath(); ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2.4; ctx.stroke()
        // water sheeting down the column
        ctx.strokeStyle = 'rgba(170,225,245,0.28)'; ctx.lineWidth = 1.4
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath()
          ctx.moveTo(i * 7, -84)
          ctx.quadraticCurveTo(i * 5 + sway, -46, i * 13 + sway * 1.8, 2)
          ctx.stroke()
        }

        // drowned torso — shoulders wider than the waist below it
        ctx.fillStyle = bodyGrad
        ctx.beginPath()
        ctx.moveTo(-21, -102)
        ctx.quadraticCurveTo(-24, -96, -20, -84)
        ctx.lineTo(-13, -66); ctx.lineTo(13, -66); ctx.lineTo(20, -84)
        ctx.quadraticCurveTo(24, -96, 21, -102)
        ctx.closePath(); ctx.fill()
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2.8; ctx.stroke()
        // ribs showing through swollen flesh
        ctx.strokeStyle = 'rgba(180,225,240,0.3)'; ctx.lineWidth = 1.3
        for (let i = 0; i < 3; i++) {
          const w = 15 - i * 2.5
          ctx.beginPath()
          ctx.moveTo(-w, -96 + i * 9); ctx.lineTo(w, -96 + i * 9)
          ctx.stroke()
        }
        // wet rim light down the seaward edge
        ctx.strokeStyle = 'rgba(200,245,255,0.45)'; ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(-20, -100); ctx.quadraticCurveTo(-23, -84, -13, -66)
        ctx.stroke()
        // arms — long, waterlogged, trailing weed
        const armAng = M.state === 'grab' ? 0.5 : tellM ? -1.5 : -0.35 + Math.sin(M.phase * 1.3) * 0.15
        ctx.save()
        ctx.translate(14, -96)
        ctx.rotate(armAng)
        ctx.strokeStyle = mfl ? '#8ecfe0' : '#17415a'; ctx.lineWidth = 8
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(48, 12); ctx.stroke()
        ctx.strokeStyle = '#22503a'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(30, 8); ctx.quadraticCurveTo(38, 26, 30, 40); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(44, 12); ctx.quadraticCurveTo(52, 30, 44, 44); ctx.stroke()
        ctx.restore()
        ctx.save()
        ctx.translate(-14, -96)
        ctx.rotate(-armAng * 0.6)
        ctx.strokeStyle = mfl ? '#8ecfe0' : '#17415a'; ctx.lineWidth = 7
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40, 16); ctx.stroke()
        ctx.restore()

        // head: a drowned man's, eyes lit from inside
        ctx.fillStyle = mfl ? '#a8dcea' : '#1c4b64'
        ctx.beginPath(); ctx.arc(0, -118, 14, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2.6; ctx.stroke()
        // hair of kelp
        ctx.strokeStyle = '#1e4a34'; ctx.lineWidth = 2.6
        for (let i = 0; i < 5; i++) {
          const a = -2.5 + i * 0.42
          ctx.beginPath()
          ctx.moveTo(Math.cos(a) * 12, -118 + Math.sin(a) * 12)
          ctx.quadraticCurveTo(
            Math.cos(a) * 26 + sway, -112 + Math.sin(a) * 22,
            Math.cos(a) * 24 + sway * 1.8, -94 + Math.sin(a) * 30
          )
          ctx.stroke()
        }
        // eyes
        const eyeGlow = tellM ? 1 : 0.6
        ctx.fillStyle = `rgba(180,255,255,${eyeGlow})`
        ctx.beginPath(); ctx.arc(5, -120, 3, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(-5, -120, 2.4, 0, Math.PI * 2); ctx.fill()
        // water constantly falling off it
        if (Math.random() < 0.5) {
          addP({
            x: M.x + (Math.random() - 0.5) * 42, y: M.y - 100 + Math.random() * 60,
            vx: (Math.random() - 0.5) * 20, vy: 60 + Math.random() * 90,
            life: 0.5, max: 0.5, size: 1.4 + Math.random() * 1.4,
            r: 140, g: 200, b: 225, grav: 300,
          })
        }
        ctx.restore()
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

      // raised guard — shield swings across while parrying
      if (player.parryT > 0 || player.parryFlash > 0) {
        const gp = player.parryT > 0 ? 1 : player.parryFlash / 240
        const perfect = player.parryT > PARRY_MS - PARRY_PERFECT_MS
        ctx.globalAlpha = 0.55 + gp * 0.45
        ctx.save()
        ctx.translate(16, -52 + breathe)
        ctx.rotate(-0.25)
        ctx.fillStyle = '#3a2a12'
        ctx.beginPath(); ctx.ellipse(0, 0, 12, 26, 0, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = perfect ? '#fff4d0' : '#000'
        ctx.lineWidth = perfect ? 3 : 2.4
        ctx.stroke()
        ctx.fillStyle = P.gold
        ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
        if (player.parryFlash > 0) {
          const pf = player.parryFlash / 240
          ctx.strokeStyle = `rgba(235,230,255,${pf * 0.9})`
          ctx.lineWidth = 3
          ctx.beginPath(); ctx.arc(20, -50 + breathe, 26 + (1 - pf) * 22, -1.1, 1.1); ctx.stroke()
        }
        ctx.globalAlpha = 1
      }
      ctx.restore()

      // ── arrows ──
      for (const pr of projectiles) {
        if (pr.x < camX - 30 || pr.x > camX + CW + 30) continue
        const ang = Math.atan2(pr.vy, pr.vx)
        ctx.save()
        ctx.translate(pr.x, pr.y)
        ctx.rotate(ang)
        ctx.strokeStyle = P.woodB; ctx.lineWidth = 2.4
        ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(8, 0); ctx.stroke()
        ctx.fillStyle = P.blade
        ctx.beginPath(); ctx.moveTo(8, -3); ctx.lineTo(17, 0); ctx.lineTo(8, 3); ctx.closePath(); ctx.fill()
        ctx.strokeStyle = '#d8d0b8'; ctx.lineWidth = 1.4
        ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-9, -3.5); ctx.moveTo(-14, 0); ctx.lineTo(-9, 3.5); ctx.stroke()
        ctx.restore()
      }

      // ── particles ──
      for (const p of particles) {
        const a = clamp(p.life / p.max, 0, 1)
        ctx.globalAlpha = a * 0.9
        ctx.fillStyle = `rgb(${p.r | 0},${p.g | 0},${p.b | 0})`
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + a * 0.4), 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1

      // ── dynamic firelight ──
      // Additive pass so every fire actually lights the ground, props and
      // characters standing near it instead of just glowing on its own.
      ctx.globalCompositeOperation = 'lighter'
      for (const ob of objs) {
        if (ob.kind !== 'fire') continue
        const fx = ob.x + ob.w / 2
        if (fx < camX - 200 || fx > camX + CW + 200) continue
        const fy = GROUND_Y - 26
        const rad = 168 + Math.sin(time * 7 + ob.x) * 9 + Math.sin(time * 17.3 + ob.x) * 4
        const lg = ctx.createRadialGradient(fx, fy, 4, fx, fy, rad)
        lg.addColorStop(0, 'rgba(255,150,50,0.30)')
        lg.addColorStop(0.42, 'rgba(220,90,20,0.13)')
        lg.addColorStop(1, 'rgba(180,60,10,0)')
        ctx.fillStyle = lg
        ctx.fillRect(fx - rad, fy - rad, rad * 2, rad * 2)
      }
      ctx.globalCompositeOperation = 'source-over'

      // ── floating damage numbers ──
      for (const dn of dmgNums) {
        const a = clamp(dn.life / 0.9, 0, 1)
        ctx.globalAlpha = a
        ctx.textAlign = 'center'
        if (dn.v === 0) {
          ctx.font = '700 17px Cinzel, Georgia, serif'
          ctx.fillStyle = '#eae4ff'
          ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 3
          ctx.strokeText('ПАРИРОВАНО', dn.x, dn.y)
          ctx.fillText('ПАРИРОВАНО', dn.x, dn.y)
        } else {
          ctx.font = dn.crit ? '700 24px Cinzel, Georgia, serif' : '700 17px Cinzel, Georgia, serif'
          ctx.fillStyle = dn.crit ? '#ffd24a' : '#e8d8b8'
          ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 3
          ctx.strokeText(String(dn.v), dn.x, dn.y)
          ctx.fillText(String(dn.v), dn.x, dn.y)
        }
        ctx.textAlign = 'left'
      }
      ctx.globalAlpha = 1

      ctx.restore() // world space

      // ── foreground debris (parallax 1.28) ──
      // Kept low along the very bottom edge so it frames the shot without ever
      // occluding the player or the platforms.
      {
        const fgOff = camX * 1.28
        ctx.fillStyle = P.fgFill
        ctx.globalAlpha = 0.9
        const start = Math.floor(fgOff / 430)
        for (let i = start; i < start + 5; i++) {
          const sx = i * 430 + prand(i + 61) * 190 - fgOff
          if (sx < -220 || sx > CW + 80) continue
          const kind = Math.floor(prand(i + 71) * 3)
          if (kind === 0) {
            // rubble mound
            ctx.beginPath()
            ctx.moveTo(sx - 60, CH); ctx.quadraticCurveTo(sx, CH - 46, sx + 62, CH)
            ctx.closePath(); ctx.fill()
          } else if (kind === 1) {
            // toppled column drums half-buried in sand
            for (let d = 0; d < 3; d++) {
              ctx.beginPath()
              ctx.ellipse(sx + d * 40, CH - 12 + d * 4, 26, 12, 0.12, 0, Math.PI * 2)
              ctx.fill()
            }
          } else {
            // ribs of a beached hull
            ctx.lineWidth = 8
            ctx.strokeStyle = P.fgFill
            for (let r = 0; r < 4; r++) {
              ctx.beginPath()
              ctx.arc(sx + r * 32, CH + 52, 62, Math.PI * 1.22, Math.PI * 1.58)
              ctx.stroke()
            }
          }
        }
        ctx.globalAlpha = 1
      }

      // ── fog bank in Thrace (cold, unfamiliar shore) ──
      if (!isDuel && location === 'thrace') {
        for (let i = 0; i < 3; i++) {
          const fy = 330 + i * 52
          const off = ((time * (7 + i * 4) - camX * (0.24 + i * 0.06)) % (CW + 420)) - 210
          const fgrad = ctx.createLinearGradient(0, fy - 40, 0, fy + 40)
          fgrad.addColorStop(0, 'rgba(150,165,180,0)')
          fgrad.addColorStop(0.5, `rgba(150,165,180,${0.11 - i * 0.02})`)
          fgrad.addColorStop(1, 'rgba(150,165,180,0)')
          ctx.fillStyle = fgrad
          ctx.beginPath()
          ctx.ellipse(off, fy, 340, 34, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.ellipse(off - CW - 420, fy, 340, 34, 0, 0, Math.PI * 2)
          ctx.fill()
        }
      }

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
      {
        const boss =
          hector && hector.state !== 'enter'
            ? { hp: hector.hp, max: hector.maxHp, name: 'ТЕНЬ ГЕКТОРА', c0: '#7a1410', c1: '#d83018' }
            : messenger && messenger.state !== 'rise'
              ? { hp: messenger.hp, max: messenger.maxHp, name: 'ПОСЛАННИК ПОСЕЙДОНА', c0: '#0d3a52', c1: '#3aa8c8' }
              : null
        if (boss) {
          const bw = 420, bx = (CW - bw) / 2
          ctx.fillStyle = 'rgba(0,0,0,0.65)'
          rr(ctx, bx - 4, 18, bw + 8, 22, 5); ctx.fill()
          ctx.strokeStyle = P.uiBorder; ctx.lineWidth = 1.4; ctx.stroke()
          const frac = clamp(boss.hp / boss.max, 0, 1)
          const hg = ctx.createLinearGradient(bx, 0, bx + Math.max(1, bw * frac), 0)
          hg.addColorStop(0, boss.c0); hg.addColorStop(1, boss.c1)
          ctx.fillStyle = hg
          ctx.fillRect(bx, 22, bw * frac, 14)
          ctx.fillStyle = P.uiText
          ctx.font = '700 12px Georgia, serif'
          ctx.textAlign = 'center'
          ctx.fillText(boss.name, CW / 2, 33)
          ctx.textAlign = 'left'
        }
      }

      // ── combo counter ──
      if (player.combo > 1 && player.comboT > 0) {
        const ca = clamp(player.comboT / COMBO_WINDOW_MS, 0, 1)
        ctx.globalAlpha = 0.35 + ca * 0.65
        ctx.textAlign = 'center'
        ctx.font = '700 30px Cinzel, Georgia, serif'
        ctx.fillStyle = player.combo >= 3 ? '#ffd24a' : '#e0b860'
        ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 4
        const cx2 = CW - 78
        ctx.strokeText(`×${player.combo}`, cx2, 92)
        ctx.fillText(`×${player.combo}`, cx2, 92)
        // window timer ring
        ctx.strokeStyle = `rgba(200,148,26,${ca})`
        ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.arc(cx2, 82, 26, -Math.PI / 2, -Math.PI / 2 + ca * Math.PI * 2); ctx.stroke()
        ctx.textAlign = 'left'
        ctx.globalAlpha = 1
      }

      // ── ability cooldown pips ──
      {
        const pips: [string, number, number][] = [
          ['Рывок', player.dashCd, DASH_CD_MS],
          ['Щит',   player.parryCd, PARRY_CD_MS],
        ]
        pips.forEach(([label, cd, max], i) => {
          const px = CW - 150 + i * 68, py = CH - 40
          const ready = cd <= 0
          ctx.fillStyle = ready ? 'rgba(200,148,26,0.22)' : 'rgba(0,0,0,0.5)'
          rr(ctx, px, py, 56, 22, 4); ctx.fill()
          ctx.strokeStyle = ready ? P.uiBorder : 'rgba(138,104,48,0.5)'
          ctx.lineWidth = 1.2; ctx.stroke()
          if (!ready) {
            ctx.fillStyle = 'rgba(200,148,26,0.25)'
            ctx.fillRect(px + 1, py + 1, 54 * (1 - cd / max), 20)
          }
          ctx.fillStyle = ready ? P.uiText : P.uiDim
          ctx.font = '600 11px Georgia, serif'
          ctx.textAlign = 'center'
          ctx.fillText(label, px + 28, py + 15)
          ctx.textAlign = 'left'
        })
      }

      // ── location title + controls hint ──
      if (!isDuel) {
        ctx.fillStyle = P.uiDim
        ctx.font = '700 12px Georgia, serif'
        ctx.fillText(LOCATIONS[location].name, 14, CH - 14)
        if (!isTouch) {
          ctx.fillStyle = 'rgba(138,104,48,0.7)'
          ctx.font = '11px Georgia, serif'
          ctx.fillText('A/D — ход · W — прыжок · Shift — рывок · J — удар (серия ×3) · K — щит · E — действие · M — звук · Esc — корабль', 14, CH - 32)
        }
      } else if (!isTouch) {
        ctx.fillStyle = 'rgba(138,104,48,0.8)'
        ctx.font = '11px Georgia, serif'
        ctx.fillText(
          isSeaDuel
            ? 'J — серия ударов, в прыжке — удар сверху · K — щит · Вал сметает песок: запрыгни на камни · Столбы бьют вверх — уходи вбок'
            : 'J — серия из трёх ударов · K — щит (точный блок оглушает) · Shift — рывок сквозь копьё · W — через волну',
          14, CH - 14
        )
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
      sfx.stopAmbient()
    }
  }, [mode, isTouch])

  // ── touch controls (v1.4) ──
  const bindTouch = (key: keyof typeof keysRef.current) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); sfx.unlock(); keysRef.current[key] = true },
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
            <div style={{ ...tBtn, width: 48, height: 48, fontSize: 18 }} {...bindTouch('parry')}>🛡</div>
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
