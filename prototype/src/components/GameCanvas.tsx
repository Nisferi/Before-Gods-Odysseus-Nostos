import { useEffect, useLayoutEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

const CW = 960, CH = 540
const GROUND_Y = 430
const GRAVITY = 1380
const JUMP_VEL = -590
const MOVE_SPD = 255
const COYOTE_MS = 110
const JUMP_BUF_MS = 100
const DASH_SPD = 720
const DASH_DUR = 180
const DASH_COOLDOWN = 800
const LEVEL_W_TROY = 5200
const LEVEL_W_THRACE = 3800

const P = {
  sky: ['#020101', '#080428', '#140840', '#220c38', '#3c1408', '#581c05'],
  troyDark: '#060402', seaDeep: '#020c18', sea: '#050f22', seaLine: '#092035', foam: '#102a42',
  gnd: '#3a2808', gndEdge: '#503816', sand: '#806018',
  stoneA: '#181008', stoneB: '#26180c', stoneC: '#382418', stoneD: '#4e3020',
  woodA: '#281408', woodB: '#3c1e0c',
  body: '#0c0806', gold: '#c8941a', goldLit: '#e8b030',
  crimson: '#8a0000', crimsonLit: '#c00000', skin: '#7a4e1e', blade: '#8a8898',
  fire0: '#ff5500', fire1: '#dd2200', fire2: '#ffaa00', fireW: '#fff8e0', ember: '#ff7700',
  portal0: '#5020b0', portal1: '#9050e8',
  npcRobe: '#38280e', npcSkin: '#6a3e14',
  dlgBg: 'rgba(3,2,1,0.95)', dlgBorder: '#c8941a', dlgText: '#d4a030', dlgSub: '#7a5820',
  hud: '#5a4028', hudBg: 'rgba(0,0,0,0.72)',
  starA: '#fffacd', starB: '#ffd700', starC: '#ffb347',
}

interface Player {
  x: number; y: number; vx: number; vy: number
  facing: 1 | -1; onGround: boolean; wasGround: boolean
  walkPhase: number; coyote: number; jumpBuf: number; landTimer: number
  dashTime: number; dashCooldown: number; dashDir: 1 | -1
}

interface Particle {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; size: number; r: number; g: number; b: number
}

interface Pickup { id: string; x: number; y: number; kind: 'food' | 'gold' | 'pitch'; collected: boolean }
interface Platform { x: number; y: number; w: number; h: number; kind: 'stone' | 'wood' | 'crate' }
interface LevelObj {
  id: string; x: number; y: number; w: number; h: number
  kind: 'col' | 'fire' | 'body' | 'tent' | 'cave' | 'ship' | 'portal' | 'npc' | 'wall'
  label: string; eventId?: string; isShip?: boolean; npcId?: string; portalTo?: string; done?: boolean
}
interface Dialogue { show: boolean; name: string; role: string; line: string }

// NPC dialogue data (used for future NPC interaction system)
void (() => ({ warrior_thrace: { name: 'Алексий', role: 'Фракийский воин', line: 'Ахеец? Война закончилась, но море всё ещё гонит трупы на берег. Уходи, пока цел.' }, priestess_thrace: { name: 'Артемиса', role: 'Жрица Деметры', line: 'Боги уходят. Я чувствую это каждый рассвет. Но земля остаётся — и пшеница растёт.' } }))

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
  { id: 'food1', x: 450, y: GROUND_Y - 70, kind: 'food', collected: false },
  { id: 'food2', x: 620, y: GROUND_Y - 60, kind: 'food', collected: false },
  { id: 'gold1', x: 650, y: GROUND_Y - 50, kind: 'gold', collected: false },
  { id: 'pitch1', x: 1250, y: GROUND_Y - 80, kind: 'pitch', collected: false },
  { id: 'gold2', x: 1900, y: GROUND_Y - 40, kind: 'gold', collected: false },
  { id: 'pitch2', x: 2400, y: GROUND_Y - 60, kind: 'pitch', collected: false },
  { id: 'food3', x: 2750, y: GROUND_Y - 70, kind: 'food', collected: false },
  { id: 'gold3', x: 3100, y: GROUND_Y - 50, kind: 'gold', collected: false },
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
  { id: 'ship1',   x: 4200, y: GROUND_Y - 178,w: 340, h: 178, kind: 'ship',   label: 'На корабль',            isShip: true },
  { id: 'portal1', x: 4960, y: GROUND_Y - 118,w: 120, h: 118, kind: 'portal', label: 'Фракия →',              portalTo: 'thrace' },
]

const PLATS_THRACE: Platform[] = [
  { x: 280, y: 398, w: 100, h: 32, kind: 'stone' },
  { x: 780, y: 388, w: 85,  h: 20, kind: 'stone' },
  { x: 1650, y: 370, w: 200, h: 25, kind: 'stone' },
  { x: 1700, y: 345, w: 200, h: 25, kind: 'stone' },
  { x: 2100, y: 400, w: 90,  h: 30, kind: 'crate' },
]

const PICKUPS_THRACE: Pickup[] = [
  { id: 'food_t1', x: 350, y: GROUND_Y - 60, kind: 'food', collected: false },
  { id: 'pitch_t1', x: 900, y: GROUND_Y - 50, kind: 'pitch', collected: false },
  { id: 'gold_t1', x: 1400, y: GROUND_Y - 40, kind: 'gold', collected: false },
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

const LOCATIONS: Record<string, { name: string; width: number; startX: number; plats: Platform[]; pickups: Pickup[]; objs: LevelObj[] }> = {
  troy:   { name: 'Берег Трои',   width: LEVEL_W_TROY,   startX: 160,  plats: PLATS_TROY,   pickups: PICKUPS_TROY,   objs: OBJS_TROY   },
  thrace: { name: 'Берег Фракии', width: LEVEL_W_THRACE, startX: 160,  plats: PLATS_THRACE, pickups: PICKUPS_THRACE, objs: OBJS_THRACE },
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

export function GameCanvas({ onExit, onTriggerEvent }: { onExit: () => void; onTriggerEvent: (id: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { odysseus, resources, dcs, crewTrust, athenaFavor, goToShip } = useGameStore()

  const stateRef = useRef({
    player: { x: 160, y: GROUND_Y - 40, vx: 0, vy: 0, facing: 1 as const, onGround: false, wasGround: false, walkPhase: 0, coyote: 0, jumpBuf: 0, landTimer: 0, dashTime: 0, dashCooldown: 0, dashDir: 1 as const } as Player,
    location: 'troy' as 'troy' | 'thrace',
    plats: PLATS_TROY,
    pickups: PICKUPS_TROY.map(p => ({ ...p })),
    objs: OBJS_TROY,
    particles: [] as Particle[],
    emberTimer: 0,
    dialogue: { show: false, name: '', role: '', line: '' } as Dialogue,
    camX: 160,
    time: 0,
  })

  const keysRef = useRef({ a: false, d: false, w: false, s: false, space: false, e: false, shift: false })

  useLayoutEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === 'a') keysRef.current.a = true
      if (key === 'd') keysRef.current.d = true
      if (key === 'w') keysRef.current.w = true
      if (key === 's') keysRef.current.s = true
      if (key === ' ') { keysRef.current.space = true; e.preventDefault() }
      if (key === 'e' || key === 'enter') keysRef.current.e = true
      if (key === 'shift') keysRef.current.shift = true
      if (key === 'escape') onExit()
      if (e.key === 'ArrowLeft') keysRef.current.a = true
      if (e.key === 'ArrowRight') keysRef.current.d = true
      if (e.key === 'ArrowUp') { keysRef.current.space = true; e.preventDefault() }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === 'a') keysRef.current.a = false
      if (key === 'd') keysRef.current.d = false
      if (key === 'w') keysRef.current.w = false
      if (key === 's') keysRef.current.s = false
      if (key === ' ') keysRef.current.space = false
      if (key === 'e' || key === 'enter') keysRef.current.e = false
      if (key === 'shift') keysRef.current.shift = false
      if (e.key === 'ArrowLeft') keysRef.current.a = false
      if (e.key === 'ArrowRight') keysRef.current.d = false
      if (e.key === 'ArrowUp') keysRef.current.space = false
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [onExit])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const gameLoop = () => {
      const state = stateRef.current
      const keys = keysRef.current
      const player = state.player
      const dt = 1 / 60

      // Physics
      player.vy += GRAVITY * dt
      let moveVel = 0
      if (keys.a) moveVel = -MOVE_SPD; else if (keys.d) moveVel = MOVE_SPD
      if (moveVel !== 0) player.facing = moveVel > 0 ? 1 : -1

      // Dash (A1)
      if (keys.shift && player.dashCooldown <= 0 && player.onGround) {
        player.dashTime = DASH_DUR
        player.dashDir = player.facing
        player.dashCooldown = DASH_COOLDOWN
      }
      if (player.dashTime > 0) {
        moveVel = DASH_SPD * player.dashDir
        player.dashTime -= dt * 1000
        for (let i = 0; i < 3; i++) {
          const p = { x: player.x - 15 + Math.random() * 30, y: player.y - 20 + Math.random() * 40, vx: Math.random() * 100 - 50, vy: Math.random() * 80 - 40, life: 0.15, maxLife: 0.15, size: 2 + Math.random() * 3, r: 200, g: 150, b: 50 }
          state.particles.push(p)
        }
      }
      player.dashCooldown -= dt * 1000

      player.vx = moveVel
      player.x += player.vx * dt
      player.y += player.vy * dt

      // Collision
      player.wasGround = player.onGround
      player.onGround = false
      for (const plat of state.plats) {
        if (player.x + 10 < plat.x || player.x - 10 > plat.x + plat.w) continue
        if (player.y > plat.y - 25 && player.y < plat.y + plat.h && player.vy >= 0) {
          player.y = plat.y
          player.vy = 0
          player.onGround = true
          player.coyote = COYOTE_MS
        }
      }

      player.coyote = Math.max(0, player.coyote - dt * 1000)
      player.jumpBuf = Math.max(0, player.jumpBuf - dt * 1000)

      if (keys.space) player.jumpBuf = JUMP_BUF_MS
      if (player.jumpBuf > 0 && (player.onGround || player.coyote > 0)) {
        player.vy = JUMP_VEL
        player.jumpBuf = 0
        player.coyote = 0
        player.onGround = false
        state.particles.push({ x: player.x, y: player.y + 20, vx: (Math.random() - 0.5) * 200, vy: -100, life: 0.3, maxLife: 0.3, size: 2, r: 100, g: 80, b: 60 })
      }

      if (player.onGround && !player.wasGround) player.landTimer = 150
      player.landTimer = Math.max(0, player.landTimer - dt * 1000)

      if (player.onGround) {
        player.walkPhase += dt * 8
        if (player.walkPhase > Math.PI * 2) player.walkPhase -= Math.PI * 2
      } else {
        player.walkPhase *= 0.9
      }

      // Bounds
      const levelW = LOCATIONS[state.location].width
      if (player.x < 0) player.x = 0
      if (player.x > levelW) player.x = levelW

      // Pickups (A4)
      for (const pickup of state.pickups) {
        if (pickup.collected) continue
        const dx = player.x - pickup.x, dy = player.y - pickup.y
        if (dx * dx + dy * dy < 40 * 40) {
          pickup.collected = true
          const eff: any = {}
          if (pickup.kind === 'food') eff.food = 1
          if (pickup.kind === 'gold') eff.gold = 1
          if (pickup.kind === 'pitch') eff.pitch = 1
          const choice = { text: 'Подобрано', effects: eff, result: '' } as any
          useGameStore.getState().makeChoice(choice)
        }
      }

      // Event trigger
      if (keys.e) {
        for (const obj of state.objs) {
          if (!obj.eventId) continue
          const dx = player.x - (obj.x + obj.w / 2), dy = player.y - (obj.y + obj.h / 2)
          if (dx * dx + dy * dy < 80 * 80) {
            onTriggerEvent(obj.eventId)
            keys.e = false
            break
          }
        }
      }

      // Portal
      for (const obj of state.objs) {
        if (obj.kind !== 'portal') continue
        const dx = player.x - (obj.x + obj.w / 2), dy = player.y - (obj.y + obj.h / 2)
        if (dx * dx + dy * dy < 70 * 70) {
          const newLoc = obj.portalTo as 'troy' | 'thrace'
          const newLocation = LOCATIONS[newLoc]
          state.location = newLoc
          state.plats = newLocation.plats
          state.pickups = newLocation.pickups.map(p => ({ ...p }))
          state.objs = newLocation.objs
          player.x = newLocation.startX
          player.y = GROUND_Y - 40
          player.vx = 0
          player.vy = 0
        }
      }

      // Ship
      for (const obj of state.objs) {
        if (!obj.isShip) continue
        const dx = player.x - (obj.x + obj.w / 2), dy = player.y - (obj.y + obj.h / 2)
        if (dx * dx + dy * dy < 100 * 100) {
          goToShip()
          return
        }
      }

      // Embers
      state.emberTimer -= dt * 1000
      if (state.emberTimer < 0) {
        for (const obj of state.objs) {
          if (obj.kind === 'fire') {
            state.particles.push({ x: obj.x + obj.w / 2 + (Math.random() - 0.5) * 20, y: obj.y + obj.h * 0.3, vx: (Math.random() - 0.5) * 150, vy: -100 - Math.random() * 150, life: 1.2, maxLife: 1.2, size: 3, r: 255, g: 100, b: 0 })
          }
        }
        state.emberTimer = 55
      }

      // Particle update
      state.particles = state.particles.filter(p => {
        p.life -= dt
        p.x += p.vx * dt; p.y += p.vy * dt
        p.vy += 600 * dt
        return p.life > 0
      })

      state.camX = player.x - CW / 6
      state.camX = Math.max(0, Math.min(LOCATIONS[state.location].width - CW, state.camX))
      state.time += dt

      // Draw
      ctx.fillStyle = P.troyDark
      ctx.fillRect(0, 0, CW, CH)

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, CH)
      for (let i = 0; i < P.sky.length; i++) {
        sky.addColorStop(i / (P.sky.length - 1), P.sky[i])
      }
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, CW, CH * 0.5)

      // Stars fade with DCS (B3)
      ctx.globalAlpha = dcs / 100
      for (let i = 0; i < 55; i++) {
        const x = (((i * 7) % 1200) - state.camX) % CW; const y = 40 + (i * 11) % 120
        const size = 0.5 + ((i * 3) % 2)
        ctx.fillStyle = [P.starA, P.starB, P.starC][i % 3]
        ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1

      // Parallax mid
      ctx.globalAlpha = 0.08 + (100 - dcs) * 0.0002
      for (let i = 0; i < 4; i++) {
        const xx = (i * 1200 - state.camX * 0.18) % 1200
        ctx.fillStyle = P.stoneA; ctx.fillRect(xx, 120, 300, 150)
        ctx.strokeStyle = P.stoneB; ctx.lineWidth = 2; ctx.strokeRect(xx + 20, 130, 70, 120)
      }
      ctx.globalAlpha = 1

      // Sea
      ctx.fillStyle = P.seaDeep; ctx.fillRect(0, CH * 0.55, CW, CH * 0.45)
      for (let w = 0; w < 7; w++) {
        const waveX = (w * 160 - state.camX * 0.08 + state.time * 80) % 1600
        ctx.strokeStyle = P.seaLine; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(waveX - 1600, CH * 0.6 + Math.sin(state.time * 1 + w) * 8); ctx.quadraticCurveTo(waveX - 800, CH * 0.62, waveX, CH * 0.6)
        ctx.stroke()
      }

      // Ground
      ctx.fillStyle = P.gnd; ctx.fillRect(0, GROUND_Y, CW, CH - GROUND_Y)
      ctx.fillStyle = P.gndEdge
      for (let i = 0; i < CW; i += 30) {
        ctx.fillRect(i + ((Math.sin(i * 0.1 + state.camX) * 5) % 10), GROUND_Y - 3, 20, 3)
      }

      // Platforms
      for (const plat of state.plats) {
        const px = plat.x - state.camX
        if (px > -100 && px < CW + 100) {
          if (plat.kind === 'stone') {
            ctx.fillStyle = Math.random() > 0.5 ? P.stoneC : P.stoneD
            ctx.fillRect(px, plat.y, plat.w, plat.h)
            ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(px, plat.y, plat.w, plat.h)
          } else if (plat.kind === 'wood') {
            ctx.fillStyle = P.woodA; ctx.fillRect(px, plat.y, plat.w, plat.h)
            for (let x = 0; x < plat.w; x += 15) {
              ctx.strokeStyle = P.woodB; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px + x, plat.y); ctx.lineTo(px + x, plat.y + plat.h); ctx.stroke()
            }
          } else {
            ctx.fillStyle = '#6b5b4a'; ctx.fillRect(px, plat.y, plat.w, plat.h)
            ctx.strokeStyle = '#3d2f1f'; ctx.lineWidth = 2; ctx.strokeRect(px, plat.y, plat.w, plat.h)
          }
        }
      }

      // Pickups (A4)
      for (const p of state.pickups) {
        if (p.collected) continue
        const px = p.x - state.camX
        if (px > -30 && px < CW + 30) {
          const icon = p.kind === 'food' ? '🌾' : p.kind === 'gold' ? '🪙' : '🔥'
          ctx.globalAlpha = 0.7 + Math.sin(state.time * 4) * 0.3
          ctx.font = 'bold 20px Arial'; ctx.fillStyle = '#ffd700'; ctx.textAlign = 'center'; ctx.fillText(icon, px, p.y - 10)
          ctx.globalAlpha = 1
        }
      }

      // Objects
      for (const obj of state.objs) {
        const ox = obj.x - state.camX
        if (ox < -200 || ox > CW + 200) continue

        if (obj.kind === 'col') {
          ctx.fillStyle = P.stoneA; rr(ctx, ox, obj.y, obj.w, obj.h, 4); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5; ctx.stroke()
          for (let i = 0; i < 5; i++) {
            ctx.strokeStyle = P.stoneB; ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(ox + obj.w / 2 - 8 + i * 4, obj.y); ctx.lineTo(ox + obj.w / 2 - 8 + i * 4, obj.y + obj.h); ctx.stroke()
          }
        } else if (obj.kind === 'fire') {
          for (let layer = 0; layer < 3; layer++) {
            const amp = (3 - layer) * 8; const phase = state.time * (2 - layer * 0.3)
            ctx.fillStyle = [P.fire0, P.fire1, P.fire2][layer]; ctx.globalAlpha = 0.7 - layer * 0.2
            ctx.beginPath(); ctx.moveTo(ox + obj.w / 2 - 8, obj.y + obj.h)
            ctx.quadraticCurveTo(ox + obj.w / 2 - amp + Math.sin(phase) * 6, obj.y + obj.h / 2, ox + obj.w / 2 - 12 + Math.sin(phase + 1) * 4, obj.y)
            ctx.quadraticCurveTo(ox + obj.w / 2 + 12 + Math.sin(phase + 1) * 4, obj.y, ox + obj.w / 2 + amp + Math.sin(phase) * 6, obj.y + obj.h / 2)
            ctx.lineTo(ox + obj.w / 2 + 8, obj.y + obj.h); ctx.fill()
          }
          ctx.globalAlpha = 0.15; ctx.fillStyle = P.fireW; ctx.beginPath(); ctx.arc(ox + obj.w / 2, obj.y + obj.h - 20, 35, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = 1
        } else if (obj.kind === 'tent') {
          ctx.fillStyle = '#9b6b3a'; ctx.beginPath(); ctx.moveTo(ox + obj.w / 2, obj.y); ctx.lineTo(ox, obj.y + obj.h); ctx.lineTo(ox + obj.w, obj.y + obj.h); ctx.closePath(); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
          ctx.strokeStyle = '#5d3a1a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ox + obj.w / 2, obj.y); ctx.lineTo(ox + obj.w / 2, obj.y + obj.h); ctx.stroke()
        } else if (obj.kind === 'cave') {
          ctx.fillStyle = 'rgba(100, 30, 180, 0.8 + Math.sin(state.time * 1.5) * 0.2)'
          ctx.fillRect(ox, obj.y, obj.w, obj.h)
          ctx.strokeStyle = '#401060'; ctx.lineWidth = 2.5; ctx.strokeRect(ox, obj.y, obj.w, obj.h)
        } else if (obj.kind === 'portal') {
          const pulseScale = 1 + Math.sin(state.time * 3) * 0.15
          ctx.strokeStyle = P.portal0; ctx.lineWidth = 3; ctx.globalAlpha = 0.6 + Math.sin(state.time * 2) * 0.4
          ctx.beginPath(); ctx.arc(ox + obj.w / 2, obj.y + obj.h / 2, 40 * pulseScale, 0, Math.PI * 2); ctx.stroke()
          ctx.strokeStyle = P.portal1; ctx.beginPath(); ctx.arc(ox + obj.w / 2, obj.y + obj.h / 2, 50 * pulseScale, 0, Math.PI * 2); ctx.stroke()
          ctx.globalAlpha = 1
        } else if (obj.kind === 'npc') {
          ctx.fillStyle = P.npcRobe; rr(ctx, ox, obj.y, obj.w, obj.h, 3); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
          ctx.beginPath(); ctx.arc(ox + obj.w / 2, obj.y - 8, 12, 0, Math.PI * 2); ctx.fillStyle = P.npcSkin; ctx.fill(); ctx.stroke()
        } else if (obj.kind === 'ship') {
          ctx.fillStyle = P.woodA; ctx.fillRect(ox, obj.y + obj.h - 40, obj.w, 40)
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(ox, obj.y + obj.h - 40, obj.w, 40)
          ctx.fillStyle = P.stoneC; ctx.fillRect(ox + obj.w / 2 - 8, obj.y + 20, 16, 80)
          ctx.fillStyle = '#fff8dc'; ctx.fillRect(ox + obj.w / 2 - 50, obj.y + 10, 100, 60)
        }
      }

      // Player
      const px = player.x
      ctx.save(); ctx.translate(px, player.y)
      const squash = 1 - (player.landTimer / 150) * 0.15
      ctx.scale(player.facing, squash)

      if (player.dashTime > 0) ctx.globalAlpha = 0.6 + Math.sin(state.time * 30) * 0.4

      // Cape
      const capePhase = Math.sin(player.walkPhase + state.time) * 15
      ctx.strokeStyle = P.crimson; ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(-5, -62); ctx.quadraticCurveTo(-14, -28, -12 + capePhase * 0.3, 6)
      ctx.stroke()

      // Body
      rr(ctx, -14, -68, 28, 52, 6); ctx.fillStyle = P.body; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2.8; ctx.stroke()

      // Breastplate
      rr(ctx, -11, -66, 22, 26, 4); ctx.fillStyle = P.gold; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.8; ctx.stroke()
      ctx.strokeStyle = '#8a5c00'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, -66); ctx.lineTo(0, -40); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(-11, -54); ctx.lineTo(11, -54); ctx.stroke()

      // Legs & arms (simplified)
      ctx.fillStyle = P.body; rr(ctx, -14, -10, 11, 46, 3); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2.2; ctx.stroke()

      // Sword arm
      ctx.save(); ctx.rotate(-Math.sin(player.walkPhase) * 0.3)
      ctx.fillStyle = P.body; rr(ctx, 12, -60, 10, 32, 3); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2.2; ctx.stroke()
      ctx.strokeStyle = P.blade; ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(17, -30); ctx.lineTo(26, 16); ctx.stroke()
      ctx.restore()

      // Head & helmet
      ctx.beginPath(); ctx.arc(0, -77, 15, 0, Math.PI * 2); ctx.fillStyle = P.skin; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2.8; ctx.stroke()
      ctx.beginPath(); ctx.arc(0, -81, 14, Math.PI + 0.12, Math.PI * 2 - 0.12); ctx.fillStyle = P.gold; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2.2; ctx.stroke()
      ctx.strokeStyle = '#8a5c00'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-12, -81); ctx.lineTo(12, -81); ctx.stroke()

      // Crest
      ctx.beginPath(); ctx.moveTo(0, -95); ctx.quadraticCurveTo(15, -103, 18, -86); ctx.quadraticCurveTo(9, -84, 0, -85); ctx.closePath()
      ctx.fillStyle = P.crimson; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.8; ctx.stroke()

      ctx.globalAlpha = 1
      ctx.restore()

      // Particles
      for (const p of state.particles) {
        const ppx = p.x - state.camX
        ctx.globalAlpha = p.life / p.maxLife
        ctx.fillStyle = `rgb(${Math.round(p.r)}, ${Math.round(p.g)}, ${Math.round(p.b)})`
        ctx.beginPath(); ctx.arc(ppx, p.y, p.size, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1

      // Dialogue
      if (state.dialogue.show) {
        ctx.fillStyle = state.dialogue.show ? P.dlgBg : 'transparent'
        ctx.fillRect(20, CH - 140, CW - 40, 120)
        ctx.strokeStyle = P.dlgBorder; ctx.lineWidth = 3; ctx.strokeRect(20, CH - 140, CW - 40, 120)
        ctx.fillStyle = P.dlgText; ctx.font = 'bold 14px Cinzel'; ctx.textAlign = 'left'
        ctx.fillText(state.dialogue.name, 30, CH - 115); ctx.fillStyle = P.dlgSub; ctx.font = '12px Cinzel'
        ctx.fillText(state.dialogue.role, 30, CH - 102)
        ctx.fillStyle = P.dlgText; ctx.font = '12px Georgia'; ctx.fillText(state.dialogue.line, 30, CH - 70)
      }

      requestAnimationFrame(gameLoop)
    }

    gameLoop()
  }, [onExit, onTriggerEvent, dcs, odysseus, resources, crewTrust, athenaFavor])

  return <canvas ref={canvasRef} width={CW} height={CH} style={{ border: '2px solid #c8941a', display: 'block', margin: '0 auto', imageRendering: 'crisp-edges' }} />
}
