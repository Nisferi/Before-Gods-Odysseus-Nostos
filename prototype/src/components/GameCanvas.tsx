import { useEffect, useLayoutEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

// ─── Constants ──────────────────────────────────────────────────────────────
const CW = 960, CH = 540
const GROUND_Y = 430
const GRAVITY = 1380
const JUMP_VEL = -590
const MOVE_SPD = 255
const COYOTE_MS = 110
const JUMP_BUF_MS = 100
const LEVEL_W_TROY = 5200
const LEVEL_W_THRACE = 3800

// ─── Palette (RPoP-inspired dark atmospheric) ────────────────────────────────
const P = {
  sky: ['#040114', '#080428', '#140840', '#220c38', '#3c1408', '#581c05'],
  troyDark: '#060402',
  seaDeep: '#020c18', sea: '#050f22', seaLine: '#092035', foam: '#102a42',
  gnd: '#3a2808', gndEdge: '#503816', sand: '#806018',
  stoneA: '#181008', stoneB: '#26180c', stoneC: '#382418', stoneD: '#4e3020',
  woodA: '#281408', woodB: '#3c1e0c',
  body: '#0c0806', gold: '#c8941a', goldLit: '#e8b030',
  crimson: '#8a0000', crimsonLit: '#c00000',
  skin: '#7a4e1e', blade: '#8a8898',
  fire0: '#ff5500', fire1: '#dd2200', fire2: '#ffaa00', fireW: '#fff8e0',
  ember: '#ff7700',
  portal0: '#5020b0', portal1: '#9050e8',
  npcRobe: '#38280e', npcSkin: '#6a3e14',
  dlgBg: 'rgba(3,2,1,0.95)', dlgBorder: '#c8941a', dlgText: '#d4a030', dlgSub: '#7a5820',
  hud: '#5a4028', hudBg: 'rgba(0,0,0,0.72)',
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface Player {
  x: number; y: number; vx: number; vy: number
  facing: 1 | -1; onGround: boolean; wasGround: boolean
  walkPhase: number; coyote: number; jumpBuf: number; landTimer: number
}

interface Particle {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; size: number
  r: number; g: number; b: number
}

interface Platform { x: number; y: number; w: number; h: number; kind: 'stone' | 'wood' | 'crate' }

interface LevelObj {
  id: string; x: number; y: number; w: number; h: number
  kind: 'col' | 'fire' | 'body' | 'tent' | 'cave' | 'ship' | 'portal' | 'npc' | 'wall'
  label: string; eventId?: string; isShip?: boolean
  npcId?: string; portalTo?: string; done?: boolean
}

interface Dialogue { show: boolean; name: string; role: string; line: string }

// ─── NPC Data ────────────────────────────────────────────────────────────────
const NPCS: Record<string, { name: string; role: string; line: string }> = {
  warrior_thrace: {
    name: 'Алексий',
    role: 'Фракийский воин',
    line: 'Ахеец? Война закончилась, но море всё ещё гонит трупы на берег. Уходи, пока цел.',
  },
  priestess_thrace: {
    name: 'Артемиса',
    role: 'Жрица Деметры',
    line: 'Боги уходят. Я чувствую это каждый рассвет. Но земля остаётся — и пшеница растёт.',
  },
}

// ─── Level Data ──────────────────────────────────────────────────────────────
const PLATS_TROY: Platform[] = [
  { x: 210,  y: 410, w: 80,  h: 20, kind: 'wood'  }, // driftwood
  { x: 700,  y: 378, w: 110, h: 22, kind: 'stone' }, // fallen lintel
  { x: 1510, y: 398, w: 88,  h: 32, kind: 'stone' }, // temple step 1
  { x: 1542, y: 368, w: 88,  h: 30, kind: 'stone' }, // step 2
  { x: 1574, y: 338, w: 88,  h: 30, kind: 'stone' }, // step 3
  { x: 1606, y: 303, w: 245, h: 25, kind: 'stone' }, // temple porch
  { x: 2550, y: 402, w: 62,  h: 28, kind: 'crate' }, // crate stack 1
  { x: 2550, y: 374, w: 62,  h: 28, kind: 'crate' }, // crate stack 2
  { x: 3210, y: 390, w: 100, h: 40, kind: 'stone' }, // cave ledge
  { x: 3840, y: 408, w: 210, h: 22, kind: 'wood'  }, // pier plank 1
  { x: 4060, y: 392, w: 190, h: 16, kind: 'wood'  }, // pier plank 2
  { x: 4250, y: 365, w: 300, h: 14, kind: 'wood'  }, // ship deck
]

const OBJS_TROY: LevelObj[] = [
  // Zone 1 – Shore
  { id: 'fire0',   x: 400,  y: GROUND_Y - 74, w: 26,  h: 74,  kind: 'fire',   label: '' },
  { id: 'kings',   x: 570,  y: GROUND_Y - 44, w: 105, h: 44,  kind: 'body',   label: 'Тела трёх царей',       eventId: 'three_dead_kings' },
  // Zone 2 – Gate Ruins
  { id: 'col1',    x: 740,  y: GROUND_Y - 255,w: 58,  h: 255, kind: 'col',    label: '' },
  { id: 'col2',    x: 860,  y: GROUND_Y - 195,w: 46,  h: 195, kind: 'col',    label: '' },
  { id: 'wall1',   x: 960,  y: GROUND_Y - 130,w: 200, h: 130, kind: 'wall',   label: '' },
  { id: 'fire1',   x: 1140, y: GROUND_Y - 80, w: 28,  h: 80,  kind: 'fire',   label: '' },
  // Zone 3 – Apollo Temple
  { id: 'col3',    x: 1648, y: GROUND_Y - 278,w: 66,  h: 278, kind: 'col',    label: 'Храм Аполлона',         eventId: 'apollo_temple' },
  { id: 'col4',    x: 1810, y: GROUND_Y - 238,w: 52,  h: 238, kind: 'col',    label: '' },
  { id: 'col5',    x: 1940, y: GROUND_Y - 262,w: 60,  h: 262, kind: 'col',    label: '' },
  // Zone 4 – Market
  { id: 'tent1',   x: 2270, y: GROUND_Y - 98, w: 135, h: 98,  kind: 'tent',   label: 'Финикийский торговец',  eventId: 'phoenician_trader' },
  { id: 'fire2',   x: 2490, y: GROUND_Y - 82, w: 28,  h: 82,  kind: 'fire',   label: '' },
  { id: 'deser',   x: 2720, y: GROUND_Y - 48, w: 68,  h: 48,  kind: 'body',   label: 'Дезертир',              eventId: 'deserter_encounter' },
  // Zone 5 – Caves
  { id: 'fire3',   x: 3050, y: GROUND_Y - 80, w: 28,  h: 80,  kind: 'fire',   label: '' },
  { id: 'cave1',   x: 3280, y: GROUND_Y - 118,w: 100, h: 118, kind: 'cave',   label: 'Пещера провидца',       eventId: 'cave_of_seer' },
  // Zone 6 – Harbor
  { id: 'fire4',   x: 3760, y: GROUND_Y - 76, w: 26,  h: 76,  kind: 'fire',   label: '' },
  { id: 'ship1',   x: 4200, y: GROUND_Y - 178,w: 340, h: 178, kind: 'ship',   label: 'На корабль',            isShip: true },
  // Zone 7 – Far Shore
  { id: 'portal1', x: 4960, y: GROUND_Y - 118,w: 120, h: 118, kind: 'portal', label: 'Фракия →',              portalTo: 'thrace' },
]

const PLATS_THRACE: Platform[] = [
  { x: 280, y: 398, w: 100, h: 32, kind: 'stone' },
  { x: 780, y: 388, w: 85,  h: 20, kind: 'stone' },
  { x: 1650, y: 370, w: 200, h: 25, kind: 'stone' },
  { x: 1700, y: 345, w: 200, h: 25, kind: 'stone' },
  { x: 2100, y: 400, w: 90,  h: 30, kind: 'crate' },
]

const OBJS_THRACE: LevelObj[] = [
  { id: 'npc-w',   x: 500,  y: GROUND_Y - 52, w: 54, h: 52, kind: 'npc',   label: 'Алексий',              npcId: 'warrior_thrace' },
  { id: 'fire-t1', x: 360,  y: GROUND_Y - 75, w: 26, h: 75, kind: 'fire',  label: '' },
  { id: 'tent-t',  x: 760,  y: GROUND_Y - 92, w: 120,h: 92, kind: 'tent',  label: 'Лагерь фракийцев' },
  { id: 'fire-t2', x: 1080, y: GROUND_Y - 78, w: 28, h: 78, kind: 'fire',  label: '' },
  { id: 'npc-p',   x: 1300, y: GROUND_Y - 52, w: 54, h: 52, kind: 'npc',   label: 'Артемиса',             npcId: 'priestess_thrace' },
  { id: 'col-t1',  x: 1680, y: GROUND_Y - 290,w: 60, h: 290,kind: 'col',   label: 'Святилище Деметры' },
  { id: 'col-t2',  x: 1810, y: GROUND_Y - 250,w: 50, h: 250,kind: 'col',   label: '' },
  { id: 'cave-t',  x: 2300, y: GROUND_Y - 110,w: 96, h: 110,kind: 'cave',  label: 'Тёмная пещера' },
  { id: 'portal2', x: 3450, y: GROUND_Y - 118,w: 120,h: 118,kind: 'portal',label: '← Берег Трои',         portalTo: 'troy' },
]

const LOCATIONS: Record<string, { name: string; width: number; startX: number; plats: Platform[]; objs: LevelObj[] }> = {
  troy:   { name: 'Берег Трои',   width: LEVEL_W_TROY,   startX: 160,  plats: PLATS_TROY,   objs: OBJS_TROY   },
  thrace: { name: 'Берег Фракии', width: LEVEL_W_THRACE, startX: 160,  plats: PLATS_THRACE, objs: OBJS_THRACE },
}

// ─── Geometry helper ─────────────────────────────────────────────────────────
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// ─── Background: Sky ─────────────────────────────────────────────────────────
function drawSky(ctx: CanvasRenderingContext2D, time: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, CH)
  P.sky.forEach((c, i) => grad.addColorStop(i / (P.sky.length - 1), c))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CW, CH)

  // Moon with halo
  ctx.save()
  ctx.shadowBlur = 28; ctx.shadowColor = 'rgba(200,190,150,0.55)'
  ctx.beginPath(); ctx.arc(88, 68, 28, 0, Math.PI * 2)
  ctx.fillStyle = '#cec290'; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  ctx.restore()

  // Stars
  for (let i = 0; i < 55; i++) {
    const sx = (i * 177 + 43) % CW
    const sy = (i * 103 + 12) % (CH * 0.42)
    const br = ((Math.sin(time * 1.5 + i) + 1) / 2) * 0.75
    ctx.globalAlpha = br; ctx.fillStyle = '#d8d4c2'
    ctx.fillRect(sx, sy, i % 3 === 0 ? 2 : 1.5, i % 3 === 0 ? 2 : 1.5)
  }
  ctx.globalAlpha = 1
}

// ─── Background: Burning Troy silhouette ─────────────────────────────────────
function drawTroyBurning(ctx: CanvasRenderingContext2D, cx: number, time: number) {
  const ox = -cx * 0.045

  // Glow behind city
  const gx = CW * 0.6 + ox * 0.4
  const g = ctx.createRadialGradient(gx, CH * 0.36, 0, gx, CH * 0.36, 380)
  g.addColorStop(0,   'rgba(210,70,8,0.32)')
  g.addColorStop(0.45,'rgba(130,30,4,0.14)')
  g.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH)

  const baseY = CH * 0.53
  const fill = P.troyDark

  // Main wall
  const wallX = 180 + ox, wallEnd = wallX + 1280
  if (wallEnd > 0 && wallX < CW) {
    ctx.fillStyle = fill
    ctx.fillRect(Math.max(0, wallX), CH * 0.42, Math.min(CW, wallEnd) - Math.max(0, wallX), baseY - CH * 0.42)
    // Merlons
    for (let i = 0; i < 28; i++) {
      const mx = wallX + 10 + i * 46
      if (mx > -20 && mx < CW + 20)
        ctx.fillRect(mx, CH * 0.42 - 18, 18, 18)
    }
  }

  // Towers
  const towers = [
    { rx: 280, h: 78, w: 48 }, { rx: 490, h: 100, w: 56 },
    { rx: 720, h: 88, w: 52 }, { rx: 960, h: 118, w: 64 },
    { rx: 1150, h: 82, w: 50 }, { rx: 1340, h: 95, w: 56 },
  ]
  for (const t of towers) {
    const tx = t.rx + wallX - 180
    if (tx < -80 || tx > CW + 80) continue
    const tTop = CH * 0.42 - t.h
    ctx.fillStyle = fill
    ctx.fillRect(tx, tTop, t.w, CH * 0.42 - tTop)
    for (let i = 0; i < 3; i++) ctx.fillRect(tx + i * 16, tTop - 14, 11, 14)
    // Fire on tower
    const ph = time * 5 + t.rx * 0.07
    const fh = 18 + Math.sin(ph) * 6
    ctx.fillStyle = P.fire0; ctx.globalAlpha = 0.65
    ctx.beginPath()
    ctx.moveTo(tx + 5, tTop); ctx.quadraticCurveTo(tx + t.w / 2, tTop - fh, tx + t.w - 5, tTop)
    ctx.fill(); ctx.globalAlpha = 1
  }

  // Gate arch (shows through wall)
  const gateX = 660 + ox
  if (gateX > -60 && gateX < CW + 60) {
    ctx.fillStyle = P.sky[3]
    ctx.beginPath(); ctx.arc(gateX + 32, CH * 0.42 + 2, 28, Math.PI, 0)
    ctx.fillRect(gateX + 4, CH * 0.3, 56, 40); ctx.fill()
    const gg = ctx.createRadialGradient(gateX + 32, CH * 0.42, 0, gateX + 32, CH * 0.42, 55)
    gg.addColorStop(0, 'rgba(190,55,4,0.38)'); gg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gg; ctx.fillRect(gateX - 10, CH * 0.3, 84, 60)
  }
}

// ─── Background: Distant mid-ground ruins ────────────────────────────────────
function drawMidRuins(ctx: CanvasRenderingContext2D, cx: number) {
  const ox = -cx * 0.18
  ctx.globalAlpha = 0.25
  ctx.fillStyle = '#0e0a06'
  const cols = [80, 260, 460, 650, 900, 1100, 1350]
  for (const c of cols) {
    const tx = c + ox
    if (tx < -40 || tx > CW + 40) continue
    ctx.fillRect(tx, CH * 0.28, 28, CH * 0.26)
    ctx.fillRect(tx - 6, CH * 0.28, 40, 14)
  }
  ctx.globalAlpha = 1
}

// ─── Sea ──────────────────────────────────────────────────────────────────────
function drawSea(ctx: CanvasRenderingContext2D, cx: number, wave: number) {
  ctx.fillStyle = P.sea; ctx.fillRect(0, CH * 0.38, CW, CH * 0.26)
  for (let i = 0; i < 7; i++) {
    const wy = CH * 0.4 + i * 14
    ctx.beginPath(); ctx.moveTo(0, wy)
    for (let x = 0; x <= CW; x += 12) {
      const wx = x + cx * (0.06 + i * 0.01)
      ctx.lineTo(x, wy + Math.sin((wx + wave * 85 + i * 20) * 0.036) * (2.5 + i * 0.5))
    }
    ctx.strokeStyle = i < 2 ? P.foam : P.seaLine; ctx.lineWidth = i < 2 ? 1.5 : 1; ctx.stroke()
  }
}

// ─── Ground ──────────────────────────────────────────────────────────────────
function drawGround(ctx: CanvasRenderingContext2D, cx: number) {
  ctx.fillStyle = P.gnd; ctx.fillRect(0, GROUND_Y, CW, CH - GROUND_Y)
  ctx.fillStyle = P.gndEdge; ctx.fillRect(0, GROUND_Y, CW, 12)
  ctx.fillStyle = P.sand; ctx.fillRect(0, GROUND_Y, CW, 4)
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(CW, GROUND_Y); ctx.stroke()

  // Ground pebbles/texture
  ctx.fillStyle = P.stoneB
  for (let i = 0; i < 40; i++) {
    const px = ((i * 239 + 50 + Math.floor(cx / 40) * 17) % CW)
    const py = GROUND_Y + 5 + (i * 7) % 10
    ctx.beginPath(); ctx.ellipse(px, py, 3 + (i % 3), 2, 0, 0, Math.PI * 2); ctx.fill()
  }
}

// ─── Platform ────────────────────────────────────────────────────────────────
function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform, cx: number) {
  const x = p.x - cx, y = p.y, w = p.w, h = p.h
  if (x > CW + 50 || x + w < -50) return

  if (p.kind === 'stone') {
    ctx.fillStyle = P.stoneB
    rr(ctx, x, y, w, h, 3); ctx.fill()
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = P.stoneC
    ctx.fillRect(x + 3, y + 2, w - 6, 5)
    // Joint lines
    ctx.strokeStyle = P.stoneA; ctx.lineWidth = 1
    for (let i = 1; i < 3; i++) {
      const jx = x + (w * i) / 3
      ctx.beginPath(); ctx.moveTo(jx, y); ctx.lineTo(jx, y + h); ctx.stroke()
    }
  } else if (p.kind === 'wood') {
    ctx.fillStyle = P.woodA
    rr(ctx, x, y, w, h, 2); ctx.fill()
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
    // Wood grain
    ctx.strokeStyle = P.woodB; ctx.lineWidth = 1
    for (let i = 0; i < Math.floor(w / 20); i++) {
      const bx = x + 4 + i * 20
      ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx, y + h)
      ctx.stroke()
    }
  } else {
    // crate
    ctx.fillStyle = P.woodA
    rr(ctx, x, y, w, h, 2); ctx.fill()
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
    ctx.strokeStyle = P.woodB; ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2)
    ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h)
    ctx.stroke()
  }
}

// ─── Column ──────────────────────────────────────────────────────────────────
function drawColumn(ctx: CanvasRenderingContext2D, o: LevelObj, cx: number) {
  const x = o.x - cx, y = o.y, w = o.w, h = o.h
  const pad = 6
  // Shaft
  ctx.fillStyle = P.stoneA
  ctx.beginPath(); ctx.rect(x + pad, y + 22, w - pad * 2, h - 38); ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  // Highlight
  ctx.fillStyle = P.stoneB; ctx.fillRect(x + pad, y + 22, 7, h - 38)
  // Fluting lines
  ctx.strokeStyle = P.stoneA; ctx.lineWidth = 1
  for (let i = 0; i < 3; i++) {
    const fx = x + pad + 4 + i * ((w - pad * 2 - 4) / 3)
    ctx.beginPath(); ctx.moveTo(fx, y + 22); ctx.lineTo(fx, y + h - 16); ctx.stroke()
  }
  // Capital
  ctx.fillStyle = P.stoneC; ctx.beginPath(); ctx.rect(x, y, w, 22); ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  ctx.fillStyle = P.stoneB; ctx.fillRect(x + 2, y + 2, w - 4, 6)
  // Base
  ctx.fillStyle = P.stoneC; ctx.beginPath(); ctx.rect(x, y + h - 16, w, 16); ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  // Crack
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x + w * 0.35, y + 40); ctx.lineTo(x + w * 0.55, y + 110); ctx.stroke()
}

// ─── Ruined wall ─────────────────────────────────────────────────────────────
function drawWall(ctx: CanvasRenderingContext2D, o: LevelObj, cx: number) {
  const x = o.x - cx, y = o.y, w = o.w, h = o.h
  ctx.fillStyle = P.stoneA; ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.stroke()
  // Stone block courses
  ctx.strokeStyle = P.stoneB; ctx.lineWidth = 1
  for (let row = 0; row < Math.floor(h / 28); row++) {
    const ry = y + row * 28
    ctx.beginPath(); ctx.moveTo(x, ry); ctx.lineTo(x + w, ry); ctx.stroke()
    // Vertical joints alternating
    const off = row % 2 === 0 ? 0 : 30
    for (let col = off; col < w; col += 60) {
      ctx.beginPath(); ctx.moveTo(x + col, ry); ctx.lineTo(x + col, ry + 28); ctx.stroke()
    }
  }
  // Irregular top (ruined)
  ctx.fillStyle = P.gnd
  ctx.beginPath()
  ctx.moveTo(x, y); ctx.lineTo(x, y - 5)
  ctx.lineTo(x + 20, y - 5); ctx.lineTo(x + 20, y - 15)
  ctx.lineTo(x + 45, y - 15); ctx.lineTo(x + 45, y - 8)
  ctx.lineTo(x + 70, y - 8); ctx.lineTo(x + 70, y - 20)
  ctx.lineTo(x + 110, y - 20); ctx.lineTo(x + 110, y - 10)
  ctx.lineTo(x + 140, y - 10); ctx.lineTo(x + 140, y - 5)
  ctx.lineTo(x + w, y - 5); ctx.lineTo(x + w, y)
  ctx.closePath(); ctx.fill()
}

// ─── Fire ─────────────────────────────────────────────────────────────────────
function drawFire(ctx: CanvasRenderingContext2D, o: LevelObj, cx: number, time: number) {
  const fx = o.x - cx + o.w / 2, fy = o.y + o.h
  ctx.save(); ctx.shadowBlur = 32; ctx.shadowColor = P.fire0
  const colors = [P.fire2, P.fire0, P.fire1, P.fireW]
  for (let i = 3; i >= 0; i--) {
    const ph = time * 5 + i * 1.2
    const fh = (46 + Math.sin(ph) * 13) * (1 - i * 0.18)
    const fw = (14 + Math.sin(ph * 1.7) * 5) * (1 - i * 0.22)
    const dx = Math.sin(ph * 0.85) * 5 * (1 - i * 0.3)
    ctx.beginPath()
    ctx.moveTo(fx + dx - fw, fy)
    ctx.quadraticCurveTo(fx + dx - fw * 0.25, fy - fh * 0.58, fx + dx, fy - fh)
    ctx.quadraticCurveTo(fx + dx + fw * 0.25, fy - fh * 0.58, fx + dx + fw, fy)
    ctx.fillStyle = colors[i]; ctx.globalAlpha = 0.9 - i * 0.12; ctx.fill()
  }
  ctx.restore(); ctx.globalAlpha = 1

  // Ground light halo
  const halo = ctx.createRadialGradient(fx, fy, 0, fx, fy, 70)
  halo.addColorStop(0, 'rgba(255,90,0,0.14)'); halo.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = halo; ctx.fillRect(fx - 70, fy - 20, 140, 40)
}

// ─── Tent ─────────────────────────────────────────────────────────────────────
function drawTent(ctx: CanvasRenderingContext2D, o: LevelObj, cx: number) {
  const x = o.x - cx, y = o.y, w = o.w, h = o.h
  ctx.beginPath()
  ctx.moveTo(x, y + h); ctx.lineTo(x + w / 2, y); ctx.lineTo(x + w, y + h); ctx.closePath()
  ctx.fillStyle = '#221604'; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5; ctx.stroke()
  ctx.strokeStyle = '#342010'; ctx.lineWidth = 1
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(x + w / 2, y + 4); ctx.lineTo(x + (w * i) / 4, y + h); ctx.stroke()
  }
  // Crates beside
  for (let i = 0; i < 3; i++) {
    const cx2 = x + w + 5 + i * 22
    rr(ctx, cx2, y + h - 28, 20, 28, 2)
    ctx.fillStyle = '#281604'; ctx.fill()
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.strokeStyle = '#3a2008'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cx2, y + h - 14); ctx.lineTo(cx2 + 20, y + h - 14); ctx.stroke()
  }
}

// ─── Cave ─────────────────────────────────────────────────────────────────────
function drawCave(ctx: CanvasRenderingContext2D, o: LevelObj, cx: number, time: number) {
  const x = o.x - cx, y = o.y, w = o.w, h = o.h
  ctx.beginPath()
  ctx.moveTo(x, y + h); ctx.lineTo(x, y + h * 0.4)
  ctx.quadraticCurveTo(x + 8, y, x + w / 2, y)
  ctx.quadraticCurveTo(x + w - 8, y, x + w, y + h * 0.35)
  ctx.lineTo(x + w, y + h); ctx.closePath()
  ctx.fillStyle = '#120e08'; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  // Arch
  ctx.beginPath(); ctx.arc(x + w / 2, y + h, w * 0.28, Math.PI, 0)
  ctx.lineTo(x + w / 2 - w * 0.28, y + h); ctx.closePath()
  ctx.fillStyle = '#000'; ctx.fill()
  // Interior glow
  const pulse = 0.25 + 0.12 * Math.sin(time * 2.3)
  const glow = ctx.createRadialGradient(x + w / 2, y + h, 0, x + w / 2, y + h, 42)
  glow.addColorStop(0, `rgba(60,20,140,${pulse})`); glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow; ctx.fillRect(x, y + h - 44, w, 44)
}

// ─── Ship ─────────────────────────────────────────────────────────────────────
function drawShip(ctx: CanvasRenderingContext2D, o: LevelObj, cx: number) {
  const x = o.x - cx, y = o.y, w = o.w, h = o.h
  // Hull
  ctx.beginPath()
  ctx.moveTo(x + 18, y + h); ctx.lineTo(x + 4, y + h * 0.6)
  ctx.lineTo(x, y + h * 0.44); ctx.lineTo(x + 15, y + h * 0.33)
  ctx.lineTo(x + w - 15, y + h * 0.33); ctx.lineTo(x + w, y + h * 0.44)
  ctx.lineTo(x + w - 4, y + h * 0.6); ctx.lineTo(x + w - 18, y + h); ctx.closePath()
  ctx.fillStyle = '#1a0e06'; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5; ctx.stroke()
  // Hull planks
  ctx.strokeStyle = '#281806'; ctx.lineWidth = 1
  for (let i = 1; i < 5; i++) {
    const py = y + h * 0.33 + (h * 0.67 * i) / 5
    ctx.beginPath(); ctx.moveTo(x + 6, py); ctx.lineTo(x + w - 6, py); ctx.stroke()
  }
  // Mast
  const mx = x + w * 0.42
  ctx.strokeStyle = '#281806'; ctx.lineWidth = 8
  ctx.beginPath(); ctx.moveTo(mx, y + h * 0.33); ctx.lineTo(mx, y + 4); ctx.stroke()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  // Yard
  ctx.strokeStyle = '#281806'; ctx.lineWidth = 4
  ctx.beginPath(); ctx.moveTo(mx - w * 0.3, y + 22); ctx.lineTo(mx + w * 0.3, y + 22); ctx.stroke()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke()
  // Sail
  ctx.beginPath()
  ctx.moveTo(mx - w * 0.28, y + 23)
  ctx.quadraticCurveTo(mx + 14, y + h * 0.29, mx + w * 0.28, y + h * 0.32)
  ctx.lineTo(mx - w * 0.28, y + h * 0.32); ctx.closePath()
  ctx.fillStyle = '#b89858'; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  // Sail stripe
  ctx.strokeStyle = '#7a0000'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(mx, y + 23); ctx.lineTo(mx, y + h * 0.32); ctx.stroke()
  // Oars
  for (let i = 0; i < 5; i++) {
    const ox = x + 36 + i * Math.floor(w * 0.55 / 5)
    ctx.strokeStyle = '#362010'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(ox, y + h * 0.55); ctx.lineTo(ox - 16, y + h * 0.82); ctx.stroke()
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke()
  }
}

// ─── Portal ───────────────────────────────────────────────────────────────────
function drawPortal(ctx: CanvasRenderingContext2D, o: LevelObj, cx: number, time: number) {
  const x = o.x - cx + o.w / 2, y = o.y + o.h / 2
  const r = Math.min(o.w, o.h) * 0.44
  const pulse = 0.5 + 0.5 * Math.sin(time * 3.2)

  ctx.save()
  ctx.shadowBlur = 40 * pulse; ctx.shadowColor = P.portal1

  // Outer ring
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(150,80,255,${0.6 + 0.4 * pulse})`; ctx.lineWidth = 3; ctx.stroke()

  // Inner glow
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r)
  glow.addColorStop(0, `rgba(100,40,200,${0.18 * pulse})`)
  glow.addColorStop(0.6, `rgba(70,20,150,${0.1 * pulse})`)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()

  // Spinning particles around ring
  for (let i = 0; i < 6; i++) {
    const angle = (time * 2 + i * Math.PI / 3) % (Math.PI * 2)
    const px = x + Math.cos(angle) * r
    const py = y + Math.sin(angle) * r
    ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2)
    ctx.fillStyle = P.portal1; ctx.fill()
  }
  ctx.restore()
}

// ─── NPC ──────────────────────────────────────────────────────────────────────
function drawNPC(ctx: CanvasRenderingContext2D, o: LevelObj, cx: number, time: number) {
  const x = o.x - cx + o.w / 2, y = o.y + o.h
  const bob = Math.sin(time * 1.8) * 2

  ctx.save()
  ctx.globalAlpha = 0.2; ctx.fillStyle = '#000'
  ctx.beginPath(); ctx.ellipse(x, y, 15, 4, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // Legs
  ctx.fillStyle = P.npcRobe
  ctx.fillRect(x - 7, y - 28, 6, 28); ctx.fillRect(x + 1, y - 28, 6, 28)

  // Robe
  rr(ctx, x - 12, y - 52 + bob, 24, 26, 4)
  ctx.fillStyle = P.npcRobe; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()

  // Arms
  ctx.fillStyle = P.npcRobe
  ctx.fillRect(x - 18, y - 50 + bob, 7, 18); ctx.fillRect(x + 11, y - 50 + bob, 7, 18)

  // Head
  ctx.beginPath(); ctx.arc(x, y - 60 + bob, 10, 0, Math.PI * 2)
  ctx.fillStyle = P.npcSkin; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()

  // Hair/headband
  ctx.beginPath(); ctx.arc(x, y - 65 + bob, 10, Math.PI, 0)
  ctx.fillStyle = '#1e1008'; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke()
}

// ─── Dead body ────────────────────────────────────────────────────────────────
function drawBody(ctx: CanvasRenderingContext2D, o: LevelObj, cx: number, done: boolean) {
  if (done) ctx.globalAlpha = 0.42
  const x = o.x - cx, y = o.y + o.h
  // Silhouette
  ctx.beginPath()
  ctx.ellipse(x + o.w * 0.5, y - 16, o.w * 0.48, 15, -0.2, 0, Math.PI * 2)
  ctx.fillStyle = '#0e0a06'; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke()
  // Shield
  ctx.beginPath(); ctx.ellipse(x + 22, y - 20, 19, 18, 0.3, 0, Math.PI * 2)
  ctx.fillStyle = '#1c1208'; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  ctx.beginPath(); ctx.arc(x + 22, y - 20, 8, 0, Math.PI * 2)
  ctx.fillStyle = '#6a1010'; ctx.fill()
  ctx.globalAlpha = 1
}

// ─── Player ───────────────────────────────────────────────────────────────────
function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, cx: number) {
  const px = p.x - cx, py = p.y
  const moving = Math.abs(p.vx) > 20
  const speed = Math.abs(p.vx)
  const wp = p.walkPhase
  const freq = 7 + (speed / MOVE_SPD) * 2
  const legAmp = moving ? 24 + (speed / MOVE_SPD) * 6 : 0
  const armAmp = moving ? 18 + (speed / MOVE_SPD) * 4 : 0
  const leg = Math.sin(wp * freq) * legAmp
  const arm = Math.sin(wp * freq + Math.PI) * armAmp

  // Lean forward when running fast
  const lean = p.onGround ? (p.vx / MOVE_SPD) * p.facing * 0.12 : 0

  // Landing squash
  const sqY = p.landTimer > 0 ? 1 + 0.15 * (p.landTimer / 120) : 1
  const sqX = p.landTimer > 0 ? 1 - 0.1 * (p.landTimer / 120) : 1

  // Jump pose
  const airLeg = !p.onGround ? (p.vy < 0 ? -28 : 14) : 0
  const airArm = !p.onGround ? (p.vy < 0 ? -20 : 8) : 0

  ctx.save()
  ctx.translate(px, py)
  if (p.facing === -1) ctx.scale(-1, 1)
  ctx.rotate(lean)
  ctx.scale(sqX, sqY)

  // Shadow
  ctx.save(); ctx.globalAlpha = 0.2
  ctx.fillStyle = '#000'
  ctx.beginPath(); ctx.ellipse(0, 3 / sqY, 22 / sqX, 5 / sqY, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // Back leg
  ctx.save()
  ctx.rotate((-( moving ? leg : airLeg) * Math.PI) / 180)
  rr(ctx, 4, -10, 11, 46, 3)
  ctx.fillStyle = P.body; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2.2; ctx.stroke()
  // Shin highlight
  ctx.fillStyle = P.stoneD; ctx.fillRect(5, -10, 3, 18)
  ctx.restore()

  // Cape (flowing with movement)
  const capeLean = moving ? -leg * 0.28 : (p.vy < 0 ? -8 : 0)
  ctx.beginPath()
  ctx.moveTo(-5, -62)
  ctx.quadraticCurveTo(-26, -20 + capeLean * 0.5, -24 + capeLean * 0.4, 12)
  ctx.quadraticCurveTo(-12, -4, -5, -34)
  ctx.closePath()
  ctx.fillStyle = P.crimson; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  // Cape highlight edge
  ctx.strokeStyle = P.crimsonLit; ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-5, -62); ctx.quadraticCurveTo(-14, -28, -12 + capeLean * 0.3, 6)
  ctx.stroke()

  // Torso
  rr(ctx, -14, -68, 28, 52, 6)
  ctx.fillStyle = P.body; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2.8; ctx.stroke()

  // Breastplate
  rr(ctx, -11, -66, 22, 26, 4)
  ctx.fillStyle = P.gold; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.8; ctx.stroke()
  // Breastplate detail
  ctx.strokeStyle = '#8a5c00'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, -66); ctx.lineTo(0, -40); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(-11, -54); ctx.lineTo(11, -54); ctx.stroke()

  // Front leg
  ctx.save()
  ctx.rotate(((moving ? leg : airLeg) * Math.PI) / 180)
  rr(ctx, -15, -10, 11, 46, 3)
  ctx.fillStyle = P.body; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2.2; ctx.stroke()
  ctx.fillStyle = P.stoneD; ctx.fillRect(-14, -10, 3, 18)
  ctx.restore()

  // Sword arm (back)
  ctx.save()
  ctx.rotate((-(moving ? arm : airArm) * 0.55 * Math.PI) / 180)
  rr(ctx, 12, -60, 10, 32, 3)
  ctx.fillStyle = P.body; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2.2; ctx.stroke()
  // Sword
  ctx.strokeStyle = P.blade; ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(17, -30); ctx.lineTo(26, 16); ctx.stroke()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke()
  // Crossguard
  rr(ctx, 11, -33, 18, 5, 1)
  ctx.fillStyle = P.gold; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke()
  ctx.restore()

  // Free arm (front)
  ctx.save()
  ctx.rotate(((moving ? arm : airArm) * Math.PI) / 180)
  rr(ctx, -22, -60, 10, 30, 3)
  ctx.fillStyle = P.body; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2.2; ctx.stroke()
  ctx.restore()

  // Head
  ctx.beginPath(); ctx.arc(0, -77, 15, 0, Math.PI * 2)
  ctx.fillStyle = P.skin; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2.8; ctx.stroke()

  // Helmet dome
  ctx.beginPath(); ctx.arc(0, -81, 14, Math.PI + 0.12, Math.PI * 2 - 0.12)
  ctx.fillStyle = P.gold; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2.2; ctx.stroke()
  // Helmet ridge
  ctx.strokeStyle = '#8a5c00'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(-12, -81); ctx.lineTo(12, -81); ctx.stroke()

  // Cheek guard
  ctx.fillStyle = P.gold
  ctx.beginPath(); ctx.rect(-14, -81, 6, 12); ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke()

  // Crest
  ctx.beginPath()
  ctx.moveTo(0, -95); ctx.quadraticCurveTo(15, -103, 18, -86); ctx.quadraticCurveTo(9, -84, 0, -85)
  ctx.closePath()
  ctx.fillStyle = P.crimson; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.8; ctx.stroke()
  ctx.strokeStyle = P.crimsonLit; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(2, -95); ctx.quadraticCurveTo(10, -99, 14, -88); ctx.stroke()

  // Eye
  ctx.fillStyle = '#0a0604'
  ctx.beginPath(); ctx.arc(9, -76, 2.8, 0, Math.PI * 2); ctx.fill()

  ctx.restore()
}

// ─── Particles ────────────────────────────────────────────────────────────────
function spawnEmber(particles: Particle[], x: number, y: number) {
  if (particles.length > 250) return
  particles.push({
    x, y: y - 20 * Math.random(),
    vx: (Math.random() - 0.5) * 45,
    vy: -65 - Math.random() * 45,
    life: 1.0 + Math.random() * 0.6,
    maxLife: 1.0 + Math.random() * 0.6,
    size: 1.5 + Math.random() * 2.5,
    r: 255, g: 100 + Math.random() * 120, b: 0,
  })
}

function spawnDust(particles: Particle[], x: number, y: number, dir: number) {
  for (let i = 0; i < 3; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 12, y,
      vx: -dir * (25 + Math.random() * 40),
      vy: -25 - Math.random() * 35,
      life: 0.45, maxLife: 0.45,
      size: 3 + Math.random() * 4,
      r: 130, g: 100, b: 55,
    })
  }
}

function updateParticles(particles: Particle[], dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx * dt; p.y += p.vy * dt
    p.vy += 120 * dt  // light gravity
    p.vx *= 0.96
    p.life -= dt
    if (p.life <= 0) { particles.splice(i, 1) }
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[], cx: number) {
  for (const p of particles) {
    const t = p.life / p.maxLife
    ctx.globalAlpha = t * 0.9
    ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`
    ctx.beginPath()
    ctx.arc(p.x - cx, p.y, p.size * t, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// ─── Dialogue box ─────────────────────────────────────────────────────────────
function drawDialogue(ctx: CanvasRenderingContext2D, dlg: Dialogue) {
  if (!dlg.show) return
  const bw = 520, bh = 110, bx = (CW - bw) / 2, by = CH - bh - 20
  rr(ctx, bx, by, bw, bh, 6)
  ctx.fillStyle = P.dlgBg; ctx.fill()
  ctx.strokeStyle = P.dlgBorder; ctx.lineWidth = 2; ctx.stroke()
  // Portrait square
  ctx.fillStyle = P.stoneA
  rr(ctx, bx + 12, by + 12, 70, 86, 4); ctx.fill()
  ctx.strokeStyle = P.dlgBorder; ctx.lineWidth = 1.5; ctx.stroke()
  // Stick figure in portrait
  ctx.strokeStyle = P.npcSkin; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(bx + 47, by + 38, 12, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(bx + 47, by + 50); ctx.lineTo(bx + 47, by + 76); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(bx + 30, by + 60); ctx.lineTo(bx + 64, by + 60); ctx.stroke()
  // Text
  ctx.fillStyle = P.dlgBorder
  ctx.font = 'bold 14px Cinzel, serif'
  ctx.fillText(`${dlg.name}  ·  ${dlg.role}`, bx + 96, by + 30)
  ctx.fillStyle = P.dlgText
  ctx.font = '13px "EB Garamond", Georgia, serif'
  // Word wrap
  const words = dlg.line.split(' ')
  let line = '', ly = by + 52
  for (const w of words) {
    const test = line + w + ' '
    if (ctx.measureText(test).width > bw - 108 && line) {
      ctx.fillText(line, bx + 96, ly); line = w + ' '; ly += 18
    } else { line = test }
  }
  if (line) ctx.fillText(line, bx + 96, ly)
  // Dismiss hint
  ctx.fillStyle = P.dlgSub
  ctx.font = '11px "EB Garamond", Georgia, serif'
  ctx.fillText('[E] — закрыть', bx + bw - 110, by + bh - 12)
}

// ─── Prompt ───────────────────────────────────────────────────────────────────
function drawPrompt(ctx: CanvasRenderingContext2D, o: LevelObj) {
  const nx = o.x + o.w / 2
  const ny = o.y - 18
  const sub = o.done ? '— исследовано —' : '[E] — взаимодействовать'
  ctx.font = 'bold 14px "EB Garamond", Georgia, serif'
  const tw = Math.max(ctx.measureText(o.label).width, ctx.measureText(sub).width)
  const bw = tw + 28, bh = 56
  const bx = nx - bw / 2, by = ny - bh

  rr(ctx, bx, by, bw, bh, 5)
  ctx.fillStyle = P.dlgBg; ctx.fill()
  ctx.strokeStyle = o.done ? P.stoneB : P.dlgBorder; ctx.lineWidth = 1.5; ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = o.done ? '#4a3820' : P.dlgText
  ctx.font = 'bold 14px "EB Garamond", Georgia, serif'
  ctx.fillText(o.label, nx, by + 22)
  ctx.fillStyle = o.done ? '#382a10' : P.dlgSub
  ctx.font = '12px "EB Garamond", Georgia, serif'
  ctx.fillText(sub, nx, by + 42)
  ctx.textAlign = 'left'
}

// ─── Component ───────────────────────────────────────────────────────────────
interface Props { onExit: () => void; onTriggerEvent: (id: string) => void }

export function GameCanvas({ onExit, onTriggerEvent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onExitRef = useRef(onExit)
  const onTriggerRef = useRef(onTriggerEvent)
  useLayoutEffect(() => { onExitRef.current = onExit; onTriggerRef.current = onTriggerEvent })

  const completedEvents = useGameStore(s => s.completedEvents)
  const completedRef = useRef(completedEvents)
  useEffect(() => { completedRef.current = completedEvents }, [completedEvents])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const keys = new Set<string>()
    const particles: Particle[] = []
    const dialogue: Dialogue = { show: false, name: '', role: '', line: '' }

    let locKey = 'troy'
    let objs: (LevelObj & { done: boolean })[] = []
    let plats: Platform[] = []
    let locWidth = 0

    function loadLocation(key: string) {
      locKey = key
      const loc = LOCATIONS[key]
      locWidth = loc.width
      plats = [...loc.plats]
      objs = loc.objs.map(o => ({ ...o, done: false }))
      for (const o of objs) {
        if (o.eventId && completedRef.current.includes(o.eventId)) o.done = true
      }
    }

    loadLocation('troy')

    const player: Player = {
      x: 160, y: GROUND_Y, vx: 0, vy: 0, facing: 1,
      onGround: true, wasGround: true,
      walkPhase: 0, coyote: 0, jumpBuf: 0, landTimer: 0,
    }
    let cam = 0, time = 0, wave = 0, lastMs = 0, raf = 0
    let emberTimer = 0

    function onKeyDown(e: KeyboardEvent) {
      if (['Space','ArrowUp','ArrowLeft','ArrowRight','ArrowDown',
           'KeyA','KeyD','KeyW','KeyE'].includes(e.code)) e.preventDefault()
      keys.add(e.code)

      if (e.code === 'Escape') { onExitRef.current(); return }

      if (e.code === 'KeyE' || e.code === 'Enter') {
        if (dialogue.show) { dialogue.show = false; return }

        const near = objs.find(o => {
          if (!o.eventId && !o.isShip && !o.portalTo && o.kind !== 'npc') return false
          return Math.abs(player.x - (o.x + o.w / 2)) < 90
        })
        if (!near) return

        if (near.isShip) { onExitRef.current(); return }
        if (near.portalTo) { player.x = LOCATIONS[near.portalTo].startX; loadLocation(near.portalTo); cam = 0; return }
        if (near.kind === 'npc' && near.npcId) {
          const npc = NPCS[near.npcId]
          if (npc) { dialogue.show = true; dialogue.name = npc.name; dialogue.role = npc.role; dialogue.line = npc.line }
          return
        }
        if (near.eventId && !near.done) { near.done = true; onTriggerRef.current(near.eventId) }
      }
    }
    function onKeyUp(e: KeyboardEvent) { keys.delete(e.code) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function loop(ms: number) {
      const dt = Math.min((ms - lastMs) / 1000, 0.05)
      const dtMs = ms - lastMs
      lastMs = ms; time += dt; wave += dt * 0.46
      emberTimer += dtMs

      const left  = keys.has('ArrowLeft')  || keys.has('KeyA')
      const right = keys.has('ArrowRight') || keys.has('KeyD')
      const jump  = keys.has('ArrowUp')    || keys.has('KeyW') || keys.has('Space')

      if (left)       { player.vx = -MOVE_SPD; player.facing = -1 }
      else if (right) { player.vx =  MOVE_SPD; player.facing =  1 }
      else            { player.vx *= 0.7 }

      // Jump buffering
      if (jump) player.jumpBuf = JUMP_BUF_MS
      if (player.jumpBuf > 0) player.jumpBuf -= dtMs

      // Coyote time
      if (player.wasGround && !player.onGround) player.coyote = COYOTE_MS
      if (player.coyote > 0) player.coyote -= dtMs

      const canJump = player.onGround || player.coyote > 0
      if (player.jumpBuf > 0 && canJump) {
        player.vy = JUMP_VEL
        player.jumpBuf = 0; player.coyote = 0
        player.onGround = false
        spawnDust(particles, player.x, GROUND_Y, player.facing)
      }

      // Gravity
      if (!player.onGround) player.vy += GRAVITY * dt
      player.x += player.vx * dt
      player.y += player.vy * dt

      // Resolve platforms + ground
      player.wasGround = player.onGround
      player.onGround = false

      if (player.y >= GROUND_Y) {
        if (!player.wasGround && player.vy > 100) {
          player.landTimer = 130
          spawnDust(particles, player.x, GROUND_Y, 0)
        }
        player.y = GROUND_Y; player.vy = 0; player.onGround = true
      }

      if (!player.onGround && player.vy >= 0) {
        for (const pl of plats) {
          if (player.x + 14 < pl.x || player.x - 14 > pl.x + pl.w) continue
          const prevY = player.y - player.vy * dt
          if (prevY <= pl.y && player.y >= pl.y) {
            if (!player.wasGround && player.vy > 80) {
              player.landTimer = 100
              spawnDust(particles, player.x, pl.y, 0)
            }
            player.y = pl.y; player.vy = 0; player.onGround = true
            break
          }
        }
      }

      if (player.landTimer > 0) player.landTimer -= dtMs
      player.x = Math.max(50, Math.min(locWidth - 50, player.x))
      if (Math.abs(player.vx) > 20 && player.onGround) player.walkPhase += dt

      // Running dust
      if (Math.abs(player.vx) > 200 && player.onGround && Math.random() < 0.25)
        spawnDust(particles, player.x, player.y, player.facing)

      // Camera smoothing
      const targetCam = player.x - CW / 2.5
      cam += (targetCam - cam) * 10 * dt
      cam = Math.max(0, Math.min(locWidth - CW, cam))

      // Ember particles from fires
      if (emberTimer > 55) {
        emberTimer = 0
        for (const o of objs) {
          if (o.kind !== 'fire') continue
          const sx = o.x - cam
          if (sx > -80 && sx < CW + 80) spawnEmber(particles, o.x + o.w / 2, o.y)
        }
      }

      updateParticles(particles, dt)

      // Near object
      const near = objs.find(o => {
        if (!o.eventId && !o.isShip && !o.portalTo && o.kind !== 'npc') return false
        return Math.abs(player.x - (o.x + o.w / 2)) < 90
      })

      // ── RENDER ────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, CW, CH)

      drawSky(ctx, time)
      drawTroyBurning(ctx, cam, time)
      drawMidRuins(ctx, cam)
      drawSea(ctx, cam, wave)

      // Back-layer objects
      for (const o of objs) {
        const sx = o.x - cam
        if (sx < -340 || sx > CW + 340) continue
        if (o.kind === 'col')  drawColumn(ctx, o, cam)
        if (o.kind === 'wall') drawWall(ctx, o, cam)
        if (o.kind === 'body') drawBody(ctx, o, cam, o.done)
        if (o.kind === 'tent') drawTent(ctx, o, cam)
        if (o.kind === 'cave') drawCave(ctx, o, cam, time)
        if (o.kind === 'ship') drawShip(ctx, o, cam)
        if (o.kind === 'portal') drawPortal(ctx, o, cam, time)
      }

      // Platforms
      for (const pl of plats) drawPlatform(ctx, pl, cam)

      drawGround(ctx, cam)

      // Fires + embers (on top of ground)
      for (const o of objs) {
        if (o.kind !== 'fire') continue
        const sx = o.x - cam
        if (sx > -120 && sx < CW + 120) drawFire(ctx, o, cam, time)
      }

      // NPCs
      for (const o of objs) {
        if (o.kind !== 'npc') continue
        const sx = o.x - cam
        if (sx > -80 && sx < CW + 80) drawNPC(ctx, o, cam, time)
      }

      drawParticles(ctx, particles, cam)
      drawPlayer(ctx, player, cam)

      if (near) drawPrompt(ctx, { ...near, x: near.x - cam, y: near.y })
      drawDialogue(ctx, dialogue)

      // Location name + HUD strip
      ctx.fillStyle = P.hudBg; rr(ctx, 10, 10, 230, 26, 4); ctx.fill()
      ctx.fillStyle = P.dlgBorder; ctx.font = 'bold 13px Cinzel, serif'
      ctx.fillText(LOCATIONS[locKey].name, 18, 28)

      ctx.fillStyle = P.hudBg; rr(ctx, 10, CH - 36, 318, 26, 4); ctx.fill()
      ctx.fillStyle = P.hud; ctx.font = '12px "EB Garamond", Georgia, serif'
      ctx.fillText('A/D — движение   W/Space — прыжок   E — действие', 18, CH - 17)

      ctx.fillStyle = P.hudBg; rr(ctx, CW - 170, CH - 36, 160, 26, 4); ctx.fill()
      ctx.textAlign = 'right'
      ctx.fillText('Esc — на корабль', CW - 16, CH - 17)
      ctx.textAlign = 'left'

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  return (
    <div style={{ width: '100%', background: '#000', display: 'flex', justifyContent: 'center' }}>
      <canvas ref={canvasRef} width={CW} height={CH}
        style={{ width: '100%', maxWidth: CW, display: 'block' }} />
    </div>
  )
}
