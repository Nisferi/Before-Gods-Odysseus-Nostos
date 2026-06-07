import { useEffect, useLayoutEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

const CW = 960
const CH = 540
const GROUND_Y = 420
const GRAVITY = 1300
const JUMP_VEL = -600
const MOVE_SPD = 230
const LEVEL_W = 2900

const P = {
  skyTop: '#020101',
  skyBot: '#1c0805',
  glowA: 'rgba(180,55,0,0.28)',
  glowB: 'rgba(100,20,0,0.12)',
  sea: '#050d18',
  seaLine: '#0c1c2e',
  foam: '#142438',
  gnd: '#46300e',
  gndEdge: '#654618',
  sand: '#957018',
  col: '#181008',
  colHi: '#2e2010',
  charBody: '#0e0802',
  charGold: '#c8961c',
  charSkin: '#7a4e1e',
  charCape: '#8b0000',
  charHelm: '#b88818',
  sword: '#8888a0',
  fire0: '#ff6600',
  fire1: '#e02800',
  fire2: '#ffaa00',
  promptBg: 'rgba(6,4,2,0.88)',
  promptBorder: '#c8961c',
  promptDone: '#3a2810',
  promptText: '#c8961c',
  hint: '#5a4028',
  uiBg: 'rgba(0,0,0,0.6)',
}

interface Player {
  x: number; y: number
  vx: number; vy: number
  facing: 1 | -1
  onGround: boolean
  walkPhase: number
}

interface LevelObj {
  id: string
  x: number; y: number; w: number; h: number
  kind: 'col' | 'fire' | 'body' | 'tent' | 'cave' | 'ship'
  label: string
  eventId?: string
  isShip?: boolean
}

const OBJS: LevelObj[] = [
  { id: 'c1',     x: 300,  y: GROUND_Y - 220, w: 54,  h: 220, kind: 'col',  label: '' },
  { id: 'c2',     x: 410,  y: GROUND_Y - 160, w: 42,  h: 160, kind: 'col',  label: '' },
  { id: 'kings',  x: 580,  y: GROUND_Y - 44,  w: 100, h: 44,  kind: 'body', label: 'Тела трёх царей',       eventId: 'three_dead_kings' },
  { id: 'f1',     x: 755,  y: GROUND_Y - 75,  w: 28,  h: 75,  kind: 'fire', label: '' },
  { id: 'c3',     x: 920,  y: GROUND_Y - 250, w: 58,  h: 250, kind: 'col',  label: 'Храм Аполлона',         eventId: 'apollo_temple' },
  { id: 'c4',     x: 1055, y: GROUND_Y - 200, w: 46,  h: 200, kind: 'col',  label: '' },
  { id: 'deser',  x: 1230, y: GROUND_Y - 48,  w: 72,  h: 48,  kind: 'body', label: 'Дезертир',              eventId: 'deserter_encounter' },
  { id: 'tent',   x: 1430, y: GROUND_Y - 88,  w: 110, h: 88,  kind: 'tent', label: 'Финикийский торговец',  eventId: 'phoenician_trader' },
  { id: 'f2',     x: 1640, y: GROUND_Y - 82,  w: 28,  h: 82,  kind: 'fire', label: '' },
  { id: 'cave',   x: 1840, y: GROUND_Y - 105, w: 92,  h: 105, kind: 'cave', label: 'Пещера провидца',       eventId: 'cave_of_seer' },
  { id: 'ship',   x: 2280, y: GROUND_Y - 155, w: 290, h: 155, kind: 'ship', label: 'Вернуться на корабль',  isShip: true },
]

// ─── helpers ────────────────────────────────────────────────────────────────

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

// ─── draw functions ──────────────────────────────────────────────────────────

function drawSky(ctx: CanvasRenderingContext2D, time: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, CH * 0.58)
  grad.addColorStop(0, P.skyTop)
  grad.addColorStop(1, P.skyBot)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CW, CH * 0.58)

  // Troy burning glow
  const g1 = ctx.createRadialGradient(CW * 0.72, CH * 0.32, 0, CW * 0.72, CH * 0.32, 330)
  g1.addColorStop(0, P.glowA)
  g1.addColorStop(0.6, P.glowB)
  g1.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g1
  ctx.fillRect(0, 0, CW, CH * 0.58)

  // Moon
  ctx.save()
  ctx.shadowBlur = 20
  ctx.shadowColor = 'rgba(220,210,170,0.5)'
  ctx.beginPath()
  ctx.arc(90, 62, 26, 0, Math.PI * 2)
  ctx.fillStyle = '#d8cc98'
  ctx.fill()
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()

  // Stars
  for (let i = 0; i < 48; i++) {
    const sx = (i * 191 + 63) % CW
    const sy = (i * 109 + 18) % (CH * 0.38)
    const br = ((Math.sin(time * 1.6 + i) + 1) / 2) * 0.7
    ctx.globalAlpha = br
    ctx.fillStyle = '#dcd8c4'
    ctx.fillRect(sx, sy, 1.5, 1.5)
  }
  ctx.globalAlpha = 1
}

function drawSea(ctx: CanvasRenderingContext2D, cx: number, wave: number) {
  ctx.fillStyle = P.sea
  ctx.fillRect(0, CH * 0.38, CW, CH * 0.28)
  for (let i = 0; i < 6; i++) {
    const wy = CH * 0.4 + i * 15
    ctx.beginPath()
    ctx.moveTo(0, wy)
    for (let x = 0; x <= CW; x += 14) {
      const wx = x + cx * (0.07 + i * 0.012)
      ctx.lineTo(x, wy + Math.sin((wx + wave * 80 + i * 22) * 0.038) * (3 + i * 0.6))
    }
    ctx.strokeStyle = i < 2 ? P.foam : P.seaLine
    ctx.lineWidth = i < 2 ? 1.5 : 1
    ctx.stroke()
  }
}

function drawGround(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = P.gnd
  ctx.fillRect(0, GROUND_Y, CW, CH - GROUND_Y)
  ctx.fillStyle = P.gndEdge
  ctx.fillRect(0, GROUND_Y, CW, 13)
  ctx.fillStyle = P.sand
  ctx.fillRect(0, GROUND_Y, CW, 5)
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, GROUND_Y)
  ctx.lineTo(CW, GROUND_Y)
  ctx.stroke()
}

function drawColumn(ctx: CanvasRenderingContext2D, o: LevelObj, cx: number) {
  const x = o.x - cx, y = o.y, w = o.w, h = o.h, pad = 5
  // shaft
  ctx.fillStyle = P.col
  ctx.beginPath()
  ctx.rect(x + pad, y + 20, w - pad * 2, h - 34)
  ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  ctx.fillStyle = P.colHi
  ctx.fillRect(x + pad, y + 20, 6, h - 34)
  // capital
  ctx.fillStyle = P.colHi
  ctx.beginPath(); ctx.rect(x, y, w, 21); ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  // base
  ctx.beginPath(); ctx.rect(x, y + h - 15, w, 15); ctx.fill()
  ctx.stroke()
  // crack
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x + w * 0.38, y + 35)
  ctx.lineTo(x + w * 0.56, y + 100)
  ctx.stroke()
}

function drawBody(ctx: CanvasRenderingContext2D, o: LevelObj, cx: number, done: boolean) {
  if (done) ctx.globalAlpha = 0.4
  const x = o.x - cx, y = o.y + o.h - 26
  ctx.beginPath()
  ctx.ellipse(x + o.w / 2, y + 13, o.w / 2, 13, -0.22, 0, Math.PI * 2)
  ctx.fillStyle = '#0c0802'; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke()
  // shield
  ctx.beginPath(); ctx.arc(x + 22, y, 18, 0, Math.PI * 2)
  ctx.fillStyle = '#1a1006'; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  ctx.beginPath(); ctx.arc(x + 22, y, 8, 0, Math.PI * 2)
  ctx.fillStyle = '#6b0e0e'; ctx.fill()
  ctx.globalAlpha = 1
}

function drawFire(ctx: CanvasRenderingContext2D, o: LevelObj, cx: number, time: number) {
  const fx = o.x - cx + o.w / 2, fy = o.y + o.h
  ctx.save()
  ctx.shadowBlur = 28; ctx.shadowColor = P.fire0
  const colors = [P.fire2, P.fire0, P.fire1]
  for (let i = 2; i >= 0; i--) {
    const ph = time * 4.5 + i * 1.3
    const fh = 48 + Math.sin(ph) * 14 - i * 7
    const fw = 15 + Math.sin(ph * 1.6) * 5 - i * 3
    const dx = Math.sin(ph * 0.9) * 5
    ctx.beginPath()
    ctx.moveTo(fx + dx - fw, fy)
    ctx.quadraticCurveTo(fx + dx - fw * 0.3, fy - fh * 0.55, fx + dx, fy - fh)
    ctx.quadraticCurveTo(fx + dx + fw * 0.3, fy - fh * 0.55, fx + dx + fw, fy)
    ctx.fillStyle = colors[i]; ctx.globalAlpha = 0.9 - i * 0.1; ctx.fill()
  }
  ctx.restore(); ctx.globalAlpha = 1
}

function drawTent(ctx: CanvasRenderingContext2D, o: LevelObj, cx: number, done: boolean) {
  if (done) ctx.globalAlpha = 0.45
  const x = o.x - cx, y = o.y, w = o.w, h = o.h
  ctx.beginPath()
  ctx.moveTo(x, y + h); ctx.lineTo(x + w / 2, y); ctx.lineTo(x + w, y + h); ctx.closePath()
  ctx.fillStyle = '#241804'; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5; ctx.stroke()
  ctx.strokeStyle = '#382410'; ctx.lineWidth = 1
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(x + w / 2, y + 5); ctx.lineTo(x + (w * i) / 4, y + h); ctx.stroke()
  }
  for (let i = 0; i < 3; i++) {
    rr(ctx, x + w + 5 + i * 20, y + h - 26, 17, 26, 2)
    ctx.fillStyle = '#281a06'; ctx.fill()
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + w + 5 + i * 20, y + h - 15)
    ctx.lineTo(x + w + 22 + i * 20, y + h - 15)
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawCave(ctx: CanvasRenderingContext2D, o: LevelObj, cx: number, time: number, done: boolean) {
  if (done) ctx.globalAlpha = 0.45
  const x = o.x - cx, y = o.y, w = o.w, h = o.h
  ctx.beginPath()
  ctx.moveTo(x, y + h); ctx.lineTo(x, y + h * 0.42)
  ctx.quadraticCurveTo(x + 6, y, x + w / 2, y)
  ctx.quadraticCurveTo(x + w - 6, y, x + w, y + h * 0.36)
  ctx.lineTo(x + w, y + h); ctx.closePath()
  ctx.fillStyle = '#141008'; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + w / 2, y + h, w * 0.27, Math.PI, 0)
  ctx.lineTo(x + w / 2 - w * 0.27, y + h); ctx.closePath()
  ctx.fillStyle = '#000'; ctx.fill()
  if (!done) {
    const pulse = 0.28 + 0.14 * Math.sin(time * 2.2)
    const glow = ctx.createRadialGradient(x + w / 2, y + h - 4, 0, x + w / 2, y + h - 4, 38)
    glow.addColorStop(0, `rgba(70,25,150,${pulse})`)
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(x, y + h - 42, w, 42)
  }
  ctx.globalAlpha = 1
}

function drawShip(ctx: CanvasRenderingContext2D, o: LevelObj, cx: number) {
  const x = o.x - cx, y = o.y, w = o.w, h = o.h
  // hull
  ctx.beginPath()
  ctx.moveTo(x + 15, y + h)
  ctx.lineTo(x + 4, y + h * 0.62); ctx.lineTo(x, y + h * 0.48)
  ctx.lineTo(x + 14, y + h * 0.36); ctx.lineTo(x + w - 14, y + h * 0.36)
  ctx.lineTo(x + w, y + h * 0.48); ctx.lineTo(x + w - 4, y + h * 0.62)
  ctx.lineTo(x + w - 15, y + h); ctx.closePath()
  ctx.fillStyle = '#1c1006'; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5; ctx.stroke()
  // planks
  ctx.strokeStyle = '#2a1a08'; ctx.lineWidth = 1
  for (let i = 1; i < 4; i++) {
    const py = y + h * 0.36 + (h * 0.64 * i) / 4
    ctx.beginPath(); ctx.moveTo(x + 8, py); ctx.lineTo(x + w - 8, py); ctx.stroke()
  }
  // mast
  const mx = x + w / 2
  ctx.strokeStyle = '#2a1808'; ctx.lineWidth = 7
  ctx.beginPath(); ctx.moveTo(mx, y + h * 0.36); ctx.lineTo(mx, y + 5); ctx.stroke()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  // yard
  ctx.strokeStyle = '#2a1808'; ctx.lineWidth = 4
  ctx.beginPath(); ctx.moveTo(mx - w * 0.27, y + 24); ctx.lineTo(mx + w * 0.27, y + 24); ctx.stroke()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke()
  // sail
  ctx.beginPath()
  ctx.moveTo(mx - w * 0.25, y + 25)
  ctx.quadraticCurveTo(mx + 12, y + h * 0.3, mx + w * 0.25, y + h * 0.34)
  ctx.lineTo(mx - w * 0.25, y + h * 0.34); ctx.closePath()
  ctx.fillStyle = '#bfa060'; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  ctx.strokeStyle = '#7b0000'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(mx, y + 25); ctx.lineTo(mx, y + h * 0.34); ctx.stroke()
  // oars
  for (let i = 0; i < 5; i++) {
    const ox = x + 38 + i * 44
    ctx.strokeStyle = '#382008'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(ox, y + h * 0.58); ctx.lineTo(ox - 14, y + h * 0.84); ctx.stroke()
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke()
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, cx: number) {
  const px = p.x - cx, py = p.y
  const moving = Math.abs(p.vx) > 20
  const wp = p.walkPhase
  const leg = moving ? Math.sin(wp * 7) * 22 : 0
  const arm = moving ? Math.sin(wp * 7 + Math.PI) * 16 : 0

  ctx.save()
  ctx.translate(px, py)
  if (p.facing === -1) ctx.scale(-1, 1)

  // shadow
  ctx.save(); ctx.globalAlpha = 0.22
  ctx.fillStyle = '#000'
  ctx.beginPath(); ctx.ellipse(0, 2, 20, 5, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // back leg
  ctx.save(); ctx.rotate((-leg * Math.PI) / 180)
  rr(ctx, 4, -10, 10, 44, 3)
  ctx.fillStyle = P.charBody; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  ctx.restore()

  // cape
  ctx.beginPath()
  ctx.moveTo(-4, -60)
  ctx.quadraticCurveTo(-24, -22, -22 + leg * 0.24, 10)
  ctx.quadraticCurveTo(-10, -8, -4, -32)
  ctx.closePath()
  ctx.fillStyle = P.charCape; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()

  // torso
  rr(ctx, -13, -65, 26, 50, 5)
  ctx.fillStyle = P.charBody; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5; ctx.stroke()

  // breastplate
  rr(ctx, -10, -63, 20, 24, 3)
  ctx.fillStyle = P.charGold; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke()
  ctx.strokeStyle = '#a07010'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, -63); ctx.lineTo(0, -39); ctx.stroke()

  // front leg
  ctx.save(); ctx.rotate((leg * Math.PI) / 180)
  rr(ctx, -14, -10, 10, 44, 3)
  ctx.fillStyle = P.charBody; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  ctx.restore()

  // sword arm (back)
  ctx.save(); ctx.rotate((-arm * 0.55 * Math.PI) / 180)
  rr(ctx, 11, -58, 9, 30, 3)
  ctx.fillStyle = P.charBody; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  ctx.strokeStyle = P.sword; ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.moveTo(15, -30); ctx.lineTo(24, 14); ctx.stroke()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke()
  ctx.beginPath(); ctx.rect(10, -32, 16, 5)
  ctx.fillStyle = P.charGold; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke()
  ctx.restore()

  // free arm (front)
  ctx.save(); ctx.rotate((arm * Math.PI) / 180)
  rr(ctx, -20, -57, 9, 28, 3)
  ctx.fillStyle = P.charBody; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
  ctx.restore()

  // head
  ctx.beginPath(); ctx.arc(0, -74, 14, 0, Math.PI * 2)
  ctx.fillStyle = P.charSkin; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5; ctx.stroke()

  // helmet dome
  ctx.beginPath(); ctx.arc(0, -78, 13, Math.PI + 0.15, Math.PI * 2 - 0.15)
  ctx.fillStyle = P.charHelm; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()

  // cheek guard
  ctx.fillStyle = P.charHelm
  ctx.beginPath(); ctx.rect(-13, -78, 5, 11); ctx.fill(); ctx.stroke()

  // crest
  ctx.beginPath()
  ctx.moveTo(0, -91); ctx.quadraticCurveTo(13, -99, 16, -84); ctx.quadraticCurveTo(8, -82, 0, -83)
  ctx.closePath()
  ctx.fillStyle = P.charCape; ctx.fill()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke()

  // eye
  ctx.fillStyle = '#000'
  ctx.beginPath(); ctx.arc(8, -73, 2.5, 0, Math.PI * 2); ctx.fill()

  ctx.restore()
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  onExit: () => void
  onTriggerEvent: (eventId: string) => void
}

export function GameCanvas({ onExit, onTriggerEvent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onExitRef = useRef(onExit)
  const onTriggerRef = useRef(onTriggerEvent)

  useLayoutEffect(() => {
    onExitRef.current = onExit
    onTriggerRef.current = onTriggerEvent
  })

  const completedEvents = useGameStore(s => s.completedEvents)
  const completedRef = useRef(completedEvents)
  useEffect(() => { completedRef.current = completedEvents }, [completedEvents])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const keys = new Set<string>()

    const player: Player = { x: 160, y: GROUND_Y, vx: 0, vy: 0, facing: 1, onGround: true, walkPhase: 0 }
    const objs: (LevelObj & { done: boolean })[] = OBJS.map(o => ({ ...o, done: false }))

    // sync already-completed events
    for (const o of objs) {
      if (o.eventId && completedRef.current.includes(o.eventId)) o.done = true
    }

    let cam = 0, time = 0, wave = 0, lastMs = 0, raf = 0

    function onKeyDown(e: KeyboardEvent) {
      keys.add(e.code)
      if (['Space', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown',
           'KeyA', 'KeyD', 'KeyW', 'KeyE'].includes(e.code)) e.preventDefault()

      if (e.code === 'Escape') { onExitRef.current(); return }

      if (e.code === 'KeyE' || e.code === 'Enter') {
        const near = objs.find(o => {
          if (!o.eventId && !o.isShip) return false
          return Math.abs(player.x - (o.x + o.w / 2)) < 90
        })
        if (!near) return
        if (near.isShip) { onExitRef.current(); return }
        if (near.eventId && !near.done) {
          near.done = true
          onTriggerRef.current(near.eventId)
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) { keys.delete(e.code) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function loop(ms: number) {
      const dt = Math.min((ms - lastMs) / 1000, 0.05)
      lastMs = ms; time += dt; wave += dt * 0.48

      const left  = keys.has('ArrowLeft')  || keys.has('KeyA')
      const right = keys.has('ArrowRight') || keys.has('KeyD')
      const jump  = keys.has('ArrowUp')    || keys.has('KeyW') || keys.has('Space')

      if (left)       { player.vx = -MOVE_SPD; player.facing = -1 }
      else if (right) { player.vx =  MOVE_SPD; player.facing =  1 }
      else            { player.vx *= 0.72 }

      if (jump && player.onGround) { player.vy = JUMP_VEL; player.onGround = false }

      if (!player.onGround) player.vy += GRAVITY * dt
      player.x += player.vx * dt
      player.y += player.vy * dt

      if (player.y >= GROUND_Y) { player.y = GROUND_Y; player.vy = 0; player.onGround = true }
      player.x = Math.max(50, Math.min(LEVEL_W - 50, player.x))
      if (Math.abs(player.vx) > 20 && player.onGround) player.walkPhase += dt

      const target = player.x - CW / 2.5
      cam += (target - cam) * 10 * dt
      cam = Math.max(0, Math.min(LEVEL_W - CW, cam))

      const near = objs.find(o => {
        if (!o.eventId && !o.isShip) return false
        return Math.abs(player.x - (o.x + o.w / 2)) < 90
      })

      // ── render ────────────────────────────────────────
      ctx.clearRect(0, 0, CW, CH)

      drawSky(ctx, time)
      drawSea(ctx, cam, wave)

      for (const o of objs) {
        const sx = o.x - cam
        if (sx < -320 || sx > CW + 320) continue
        if (o.kind === 'col')  drawColumn(ctx, o, cam)
        if (o.kind === 'body') drawBody(ctx, o, cam, o.done)
        if (o.kind === 'tent') drawTent(ctx, o, cam, o.done)
        if (o.kind === 'cave') drawCave(ctx, o, cam, time, o.done)
        if (o.kind === 'ship') drawShip(ctx, o, cam)
      }

      drawGround(ctx)

      for (const o of objs) {
        if (o.kind !== 'fire') continue
        const sx = o.x - cam
        if (sx > -120 && sx < CW + 120) drawFire(ctx, o, cam, time)
      }

      drawPlayer(ctx, player, cam)

      // interaction prompt
      if (near) {
        const nx = near.x + near.w / 2 - cam
        const ny = near.y - 18
        const sub = near.done ? '— исследовано —' : '[E] — взаимодействовать'
        ctx.font = 'bold 14px "EB Garamond", Georgia, serif'
        const tw = Math.max(ctx.measureText(near.label).width, ctx.measureText(sub).width)
        const bw = tw + 26, bh = 54
        const bx = nx - bw / 2, by = ny - bh

        ctx.fillStyle = P.promptBg; rr(ctx, bx, by, bw, bh, 4); ctx.fill()
        ctx.strokeStyle = near.done ? P.promptDone : P.promptBorder
        ctx.lineWidth = 1.5; rr(ctx, bx, by, bw, bh, 4); ctx.stroke()

        ctx.textAlign = 'center'
        ctx.fillStyle = near.done ? '#4a3018' : P.promptText
        ctx.font = 'bold 14px "EB Garamond", Georgia, serif'
        ctx.fillText(near.label, nx, by + 22)
        ctx.fillStyle = near.done ? '#38280e' : '#7a6030'
        ctx.font = '12px "EB Garamond", Georgia, serif'
        ctx.fillText(sub, nx, by + 40)
        ctx.textAlign = 'left'
      }

      // controls hint
      ctx.fillStyle = P.uiBg; rr(ctx, 10, CH - 36, 316, 26, 4); ctx.fill()
      ctx.fillStyle = P.hint
      ctx.font = '12px "EB Garamond", Georgia, serif'
      ctx.fillText('A/D — движение   W/Space — прыжок   E — действие', 18, CH - 17)

      ctx.fillStyle = P.uiBg; rr(ctx, CW - 168, CH - 36, 158, 26, 4); ctx.fill()
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
      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        style={{ width: '100%', maxWidth: CW, display: 'block' }}
      />
    </div>
  )
}
