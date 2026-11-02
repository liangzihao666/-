<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createSphereTargets } from '../sphere.js'
import { makeBrand, setBrandEmissive } from '../brand/makeBrand.js'

const props = defineProps({
  people: { type: Array, default: () => [] },
  pool: { type: Array, default: () => [] },
})

const emit = defineEmits(['ready', 'flash'])

const host = ref(null)
const aura = ref('boot')
const fallback = ref(false)

const RADIUS = 760
let mode = 'boot'
let speed = 0
let elapsed = 0
let lastTick = 0
let shuffleAt = 0
let raf = 0
let disposed = false
let reduceMotion = false

let renderer
let cssRenderer
let badgeRenderer
let badgeScene
let badgeCamera
let badgeHost
let camera
let webglScene
let cssScene
let sphere
let emblem
let logo
let burstPoints
let motes
let shell
let ribbon
const shockRings = []
let burst
let envTarget
let softTexture
let resizeObserver

const cards = []
const burstCapacity = 180

function setMode(next) {
  mode = next
  aura.value = next
}

function sourceList() {
  return props.pool.length ? props.pool : props.people
}

function cardCount() {
  const total = props.people.length
  if (!total) return 0
  return Math.min(96, Math.max(total, 72))
}

function personAt(index) {
  const list = sourceList()
  if (!list.length) return { name: '昊量光电', dept: 'Aunion' }
  return list[index % list.length]
}

function paint(card, person, winner = false) {
  const name = card.element.querySelector('.np-name')
  const dept = card.element.querySelector('.np-dept')
  const prize = card.element.querySelector('.np-prize')
  name.textContent = person?.name || ''
  dept.textContent = person?.dept || ''
  if (prize) {
    prize.textContent = winner ? (person?.prizeName || '') : ''
    prize.hidden = !winner || !person?.prizeName
  }
  card.element.classList.toggle('is-winner', winner)
  card.userData.personId = person?.id || ''
}

function makeCard(person) {
  const element = document.createElement('div')
  element.className = 'nameplate'
  element.innerHTML = '<span class="np-prize" hidden></span><span class="np-name"></span><span class="np-dept"></span>'
  const card = new CSS3DObject(element)
  paint(card, person)
  return card
}

function clearCards() {
  while (cards.length) {
    const card = cards.pop()
    card.removeFromParent()
    card.element.remove()
  }
}

function buildCards() {
  clearCards()
  const count = cardCount()
  if (!count || !sphere) return
  const targets = createSphereTargets(count, RADIUS)
  for (let i = 0; i < count; i += 1) {
    const card = makeCard(personAt(i))
    const target = targets[i]
    card.userData.homePos = target.position.clone()
    card.userData.homeQuat = target.quaternion.clone()
    card.position.copy(target.position)
    card.quaternion.copy(target.quaternion)
    sphere.add(card)
    cards.push(card)
  }
}

function relabel() {
  cards.forEach((card, index) => {
    if (card.userData.locked) return
    paint(card, personAt(index))
    card.element.classList.remove('is-dim', 'is-winner')
  })
}

function reshuffle() {
  const list = sourceList()
  if (!list.length) return
  cards.forEach((card) => {
    if (card.userData.locked) return
    const person = list[Math.floor(Math.random() * list.length)]
    paint(card, person)
  })
}

function tween(duration, ease, onUpdate) {
  const ms = reduceMotion ? Math.min(280, duration) : duration
  return new Promise((resolve) => {
    const start = performance.now()
    const step = (now) => {
      if (disposed) {
        resolve()
        return
      }
      const k = Math.min(1, (now - start) / ms)
      onUpdate(ease(k))
      if (k < 1) requestAnimationFrame(step)
      else resolve()
    }
    requestAnimationFrame(step)
  })
}

function easeOut(t) {
  return 1 - (1 - t) ** 3
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2
}

function waitUntil(predicate, timeout) {
  return new Promise((resolve) => {
    const start = performance.now()
    const step = () => {
      if (disposed || predicate() || performance.now() - start > timeout) {
        resolve()
        return
      }
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

async function playIntro() {
  setMode('intro')
  if (emblem) emblem.scale.setScalar(0.12)
  cards.forEach((card) => {
    card.position.set((Math.random() - 0.5) * 3600, (Math.random() - 0.5) * 2200, (Math.random() - 0.5) * 2400)
    card.rotation.set(Math.random() * 0.8, Math.random() * 1.4, Math.random() * 0.4)
  })
  const starts = cards.map(card => ({
    pos: card.position.clone(),
    quat: card.quaternion.clone(),
  }))
  await tween(1600, easeInOut, (k) => {
    cards.forEach((card, index) => {
      card.position.lerpVectors(starts[index].pos, card.userData.homePos, k)
      card.quaternion.slerpQuaternions(starts[index].quat, card.userData.homeQuat, k)
    })
    if (emblem) emblem.scale.setScalar(THREE.MathUtils.lerp(0.12, 1, k))
  })
  if (emblem) emblem.scale.setScalar(1)
  setMode('idle')
  emit('ready')
}

function spin() {
  if (mode === 'boot' || mode === 'intro') return
  cards.forEach((card) => {
    card.userData.locked = false
    card.element.classList.remove('is-dim', 'is-winner')
  })
  setMode('spin')
}

async function reveal(winners) {
  if (!winners?.length) {
    setMode('idle')
    return
  }
  setMode('brake')
  await waitUntil(() => speed < 0.05, 3600)
  speed = 0
  setMode('reveal')
  const ranked = cards
    .map(card => ({ card, z: card.getWorldPosition(new THREE.Vector3()).z }))
    .sort((a, b) => b.z - a.z)
  const chosen = ranked.slice(0, winners.length).map(item => item.card)
  cards.forEach(card => card.element.classList.add('is-dim'))
  const n = chosen.length
  const scale = n >= 6 ? 0.78 : n >= 4 ? 0.9 : 1
  const span = n >= 6 ? 150 : n >= 4 ? 176 : 0
  const lookTarget = new THREE.Vector3(0, -50, 0)
  const aim = lookTarget.sub(camera.position).normalize()
  const center = camera.position.clone().addScaledVector(aim, 1180)
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
  await Promise.all(chosen.map(async (card, index) => {
    const person = winners[index]
    card.userData.locked = true
    paint(card, person, true)
    card.element.classList.remove('is-dim')
    cssScene.attach(card)
    const from = card.position.clone()
    const fromQuat = card.quaternion.clone()
    const to = center.clone().addScaledVector(right, (index - (n - 1) / 2) * span)
    const identity = new THREE.Quaternion()
    const blended = new THREE.Quaternion()
    const flip = new THREE.Quaternion()
    const axis = new THREE.Vector3(1, 0, 0)
    await tween(1100, easeOut, (k) => {
      card.position.lerpVectors(from, to, k)
      card.position.y += Math.sin(k * Math.PI) * 48 * (1 - k)
      blended.slerpQuaternions(fromQuat, identity, k)
      flip.setFromAxisAngle(axis, Math.PI * 0.85 * (1 - k))
      card.quaternion.copy(blended).multiply(flip)
      card.scale.setScalar(THREE.MathUtils.lerp(1, scale, k))
    })
  }))
  emit('flash')
}

async function restore() {
  const jobs = cards.map(async (card) => {
    card.userData.locked = false
    sphere.attach(card)
    const from = card.position.clone()
    const fromQuat = card.quaternion.clone()
    const fromScale = card.scale.x
    await tween(860, easeInOut, (k) => {
      card.position.lerpVectors(from, card.userData.homePos, k)
      card.quaternion.slerpQuaternions(fromQuat, card.userData.homeQuat, k)
      card.scale.setScalar(THREE.MathUtils.lerp(fromScale, 1, k))
    })
    card.element.classList.remove('is-dim', 'is-winner')
  })
  await Promise.all(jobs)
  relabel()
  setMode('idle')
}

function makeSoftTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.45)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeMotes(texture) {
  const count = 96
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  for (let index = 0; index < count; index += 1) {
    const radius = 520 + Math.random() * 980
    const theta = Math.random() * Math.PI * 2
    positions[index * 3] = Math.cos(theta) * radius
    positions[index * 3 + 1] = (Math.random() - 0.45) * 1500
    positions[index * 3 + 2] = Math.sin(theta) * radius * 0.55
    const tint = index % 2 === 0 ? [0.72, 0.93, 0.98] : [0.45, 0.82, 0.92]
    colors.set(tint, index * 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const material = new THREE.PointsMaterial({
    size: 20,
    map: texture,
    vertexColors: true,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    sizeAttenuation: true,
  })
  return new THREE.Points(geometry, material)
}

function makeBurst(texture) {
  const positions = new Float32Array(burstCapacity * 3)
  const colors = new Float32Array(burstCapacity * 3)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setDrawRange(0, 0)
  const material = new THREE.PointsMaterial({
    size: 34,
    map: texture,
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    sizeAttenuation: true,
  })
  burst = []
  return new THREE.Points(geometry, material)
}

function spawnBurst() {
  burst = []
  for (let i = 0; i < 42; i += 1) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const fast = 360 + Math.random() * 980
    burst.push({
      x: (Math.random() - 0.5) * 360,
      y: 80,
      z: 1200,
      vx: Math.sin(phi) * Math.cos(theta) * fast,
      vy: Math.abs(Math.cos(phi)) * fast * 0.65 + 40,
      vz: Math.sin(phi) * Math.sin(theta) * fast * 0.3,
      life: 1,
      decay: 0.28 + Math.random() * 0.45,
      color: i % 2 === 0 ? [0.93, 0.98, 1] : [0.62, 0.9, 0.96],
    })
  }
}

function updateBurst(dt) {
  if (!burstPoints) return
  const positions = burstPoints.geometry.attributes.position
  const colors = burstPoints.geometry.attributes.color
  let alive = 0
  for (const dot of burst) {
    if (dot.life <= 0) continue
    dot.life -= dt * dot.decay
    dot.vy -= 280 * dt
    dot.x += dot.vx * dt
    dot.y += dot.vy * dt
    dot.z += dot.vz * dt
    positions.setXYZ(alive, dot.x, dot.y, dot.z)
    const fade = Math.max(dot.life, 0)
    colors.setXYZ(alive, dot.color[0], dot.color[1], dot.color[2] * fade + 0.2)
    alive += 1
  }
  burstPoints.geometry.setDrawRange(0, alive)
  positions.needsUpdate = true
  colors.needsUpdate = true
}

function layout() {
  const element = host.value
  if (!element || !camera) return
  const width = element.clientWidth || window.innerWidth
  const height = element.clientHeight || window.innerHeight
  camera.aspect = width / Math.max(height, 1)
  camera.updateProjectionMatrix()
  renderer?.setSize(width, height)
  cssRenderer?.setSize(width, height)
  if (badgeHost && badgeRenderer && badgeCamera) {
    const badgeWidth = badgeHost.clientWidth || 480
    const badgeHeight = badgeHost.clientHeight || 150
    badgeCamera.aspect = badgeWidth / Math.max(badgeHeight, 1)
    badgeCamera.updateProjectionMatrix()
    badgeRenderer.setSize(badgeWidth, badgeHeight, false)
    frameBrand()
  }
}

function frameBrand() {
  if (!badgeCamera) return
  const aspect = badgeCamera.aspect || 1
  const vertical = 4.7
  const horizontal = 11.6
  const half = THREE.MathUtils.degToRad(35 / 2)
  const distance = Math.max(vertical, horizontal / aspect) / (2 * Math.tan(half))
  badgeCamera.fov = 35
  badgeCamera.position.set(distance * 0.1, distance * 0.07, distance)
  badgeCamera.lookAt(0, 0, 0)
  badgeCamera.updateProjectionMatrix()
}

function frame(now) {
  if (disposed) return
  raf = requestAnimationFrame(frame)
  const dt = Math.min(0.05, (now - lastTick) / 1000 || 0)
  lastTick = now
  elapsed += dt
  const spinTarget = mode === 'spin' ? (reduceMotion ? 0.7 : 2.8) : mode === 'brake' ? 0 : 0.12
  const lambda = mode === 'brake' ? 1.15 : mode === 'spin' ? 1.6 : 1.4
  speed = THREE.MathUtils.damp(speed, spinTarget, lambda, dt)
  if (sphere) {
    sphere.rotation.y += speed * dt
    const drift = mode === 'spin' ? 0.14 : 0.08
    sphere.rotation.x = Math.sin(elapsed * 0.32) * drift
    sphere.rotation.z = Math.sin(elapsed * 0.18) * (mode === 'idle' ? 0.05 : 0.02)
  }
  if (motes) motes.rotation.y += dt * (mode === 'spin' ? 0.18 : 0.04)
  if (mode === 'spin' && now - shuffleAt > (reduceMotion ? 220 : 90)) {
    reshuffle()
    shuffleAt = now
  }
  if (mode === 'spin') {
    cards.forEach((card, index) => {
      if (card.userData.locked || card.parent !== sphere) return
      card.scale.setScalar(1 + Math.sin(elapsed * 5.5 + index * 0.45) * 0.045)
    })
  }
  shockRings.forEach((ring) => {
    const spinning = mode === 'spin'
    const cycle = ((elapsed * 0.42) + ring.userData.offset) % 1
    ring.visible = spinning
    ring.scale.setScalar(90 + cycle * 980)
    ring.material.opacity = spinning ? (1 - cycle) * 0.42 : 0
    ring.lookAt(camera.position)
  })
  if (shell) {
    const breath = 0.045 + Math.sin(elapsed * 1.3) * 0.02
    shell.material.opacity = mode === 'spin' ? breath + 0.06 : breath
    shell.rotation.y += dt * 0.05
  }
  if (ribbon) {
    ribbon.rotation.z += dt * (mode === 'spin' ? 0.35 : 0.08)
    ribbon.material.opacity = mode === 'spin' ? 0.55 : 0.28
  }
  if (emblem) emblem.rotation.y = Math.sin(elapsed * 0.4) * 0.12
  if (logo) setBrandEmissive(logo, mode === 'spin' ? 0.34 : 0.22)
  updateBurst(dt)
  cssRenderer?.render(cssScene, camera)
  renderer?.render(webglScene, camera)
  badgeRenderer?.render(badgeScene, badgeCamera)
}

function addFlatLogo() {
  const texture = new THREE.TextureLoader().load('/brand/aunion-logo.png')
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true })
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 2.5), material)
  plane.position.y = 0.2
  return plane
}

function mountScene() {
  const element = host.value
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.domElement.style.position = 'absolute'
  renderer.domElement.style.inset = '0'
  renderer.domElement.style.zIndex = '1'
  renderer.domElement.style.pointerEvents = 'none'
  renderer.setSize(element.clientWidth || window.innerWidth, element.clientHeight || window.innerHeight)
  element.appendChild(renderer.domElement)

  cssRenderer = new CSS3DRenderer()
  cssRenderer.domElement.style.position = 'absolute'
  cssRenderer.domElement.style.inset = '0'
  cssRenderer.domElement.style.zIndex = '2'
  cssRenderer.domElement.style.pointerEvents = 'none'
  cssRenderer.domElement.style.overflow = 'hidden'
  element.appendChild(cssRenderer.domElement)

  webglScene = new THREE.Scene()
  cssScene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(40, 1, 1, 12000)
  camera.position.set(0, 30, 2620)
  camera.lookAt(0, -50, 0)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  envTarget = pmrem.fromScene(room, 0.04)
  webglScene.environment = envTarget.texture
  room.dispose()
  pmrem.dispose()

  webglScene.add(new THREE.HemisphereLight(0xffffff, 0x9eb4c2, 1.2))
  const key = new THREE.DirectionalLight(0xffffff, 1.7)
  key.position.set(-4, 7, 8)
  webglScene.add(key)
  const rim = new THREE.DirectionalLight(0x079bb8, 1.05)
  rim.position.set(5, 1, -4)
  webglScene.add(rim)

  emblem = new THREE.Group()
  try {
    logo = makeBrand()
  }
  catch (error) {
    console.warn(error)
    logo = addFlatLogo()
  }
  emblem.add(logo)

  softTexture = makeSoftTexture()

  badgeHost = document.createElement('div')
  badgeHost.className = 'logo-badge'
  const anchor = document.getElementById('brand-stage')
  ;(anchor || element).appendChild(badgeHost)
  badgeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: false })
  badgeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  badgeRenderer.setClearColor(0x000000, 0)
  badgeRenderer.outputColorSpace = THREE.SRGBColorSpace
  badgeRenderer.toneMapping = THREE.ACESFilmicToneMapping
  badgeRenderer.toneMappingExposure = 1.42
  badgeHost.appendChild(badgeRenderer.domElement)
  badgeScene = new THREE.Scene()
  badgeScene.environment = envTarget.texture
  badgeScene.add(new THREE.HemisphereLight(0xffffff, 0xd5e8f0, 1.85))
  const badgeKey = new THREE.DirectionalLight(0xffffff, 2.6)
  badgeKey.position.set(-2, 6, 9)
  badgeScene.add(badgeKey)
  const badgeFill = new THREE.DirectionalLight(0xf4fbff, 1.35)
  badgeFill.position.set(0, 1.5, 8)
  badgeScene.add(badgeFill)
  const badgeRim = new THREE.DirectionalLight(0x9fe7f4, 1.15)
  badgeRim.position.set(5, 2, -2)
  badgeScene.add(badgeRim)
  badgeCamera = new THREE.PerspectiveCamera(35, 480 / 150, 0.1, 80)
  frameBrand()
  emblem.position.y = -0.35
  badgeScene.add(emblem)

  burstPoints = makeBurst(softTexture)
  webglScene.add(burstPoints)
  motes = makeMotes(softTexture)
  webglScene.add(motes)
  shell = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS + 36, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x7fd4ea, transparent: true, opacity: 0.06, side: THREE.BackSide, depthWrite: false }),
  )
  webglScene.add(shell)
  ribbon = new THREE.Mesh(
    new THREE.TorusGeometry(RADIUS + 18, 3.2, 10, 180),
    new THREE.MeshBasicMaterial({ color: 0x079bb8, transparent: true, opacity: 0.28, depthWrite: false }),
  )
  ribbon.rotation.x = 1.15
  webglScene.add(ribbon)
  for (let index = 0; index < 3; index += 1) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 1, 96),
      new THREE.MeshBasicMaterial({
        color: index === 1 ? 0x079bb8 : 0x0869ac,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    ring.userData.offset = index / 3
    webglScene.add(ring)
    shockRings.push(ring)
  }

  sphere = new THREE.Group()
  cssScene.add(sphere)
  buildCards()
  layout()
}

function disposeMaterial(material) {
  if (!material) return
  if (material.map && material.map !== softTexture) material.map.dispose()
  material.dispose()
}

onMounted(async () => {
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  try {
    mountScene()
  }
  catch (error) {
    console.error(error)
    fallback.value = true
    emit('ready')
    return
  }
  resizeObserver = new ResizeObserver(() => layout())
  resizeObserver.observe(host.value)
  lastTick = performance.now()
  raf = requestAnimationFrame(frame)
  await playIntro()
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(raf)
  resizeObserver?.disconnect()
  clearCards()
  ;[webglScene, badgeScene].forEach((scene) => {
    scene?.traverse((object) => {
      if (object.geometry) object.geometry.dispose()
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach(disposeMaterial)
      }
    })
  })
  softTexture?.dispose()
  envTarget?.dispose()
  renderer?.dispose()
  badgeRenderer?.dispose()
  renderer?.domElement.remove()
  badgeHost?.remove()
  cssRenderer?.domElement.remove()
})

watch(() => props.people.map(person => `${person.id}:${person.name}:${person.dept}`).join('|'), () => {
  if (!sphere || mode === 'spin' || mode === 'brake' || mode === 'reveal' || mode === 'intro') return
  buildCards()
  relabel()
})

watch(() => props.pool.map(person => person.id).join('|'), () => {
  if (mode === 'idle') relabel()
})

defineExpose({ spin, reveal, restore })
</script>

<template>
  <div ref="host" class="stage-host" :class="aura">
    <div class="aura" :class="aura"></div>
    <div class="sweep"></div>
    <img v-if="fallback" class="fallback-logo" src="/brand/aunion-logo.png" alt="昊量光电 aunion" />
  </div>
</template>
