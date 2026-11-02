<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import LotteryStage from './components/LotteryStage.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'
import { defaultTitle, drawBlockReason, eligiblePeople, pickWinners, prizeSlotsLeft } from './lottery.js'
import { clearWinners, recordWinners, replaceState, resetDemo, state } from './store.js'

const stageRef = ref(null)
const phase = ref('intro')
const busy = ref(false)
const settingsOpen = ref(false)
const toast = ref('')
const flash = ref(false)
const bits = ref([])
let toastTimer = 0
let revealed = []
let lastGo = 0

const showCustomTitle = computed(() => state.title && state.title !== defaultTitle)
const packets = [
  { id: 1, left: 7, delay: -3, duration: 18, size: 26, drift: 18, rotate: -8 },
  { id: 2, left: 18, delay: -11, duration: 22, size: 22, drift: -14, rotate: 6 },
  { id: 3, left: 29, delay: -7, duration: 20, size: 28, drift: 10, rotate: -4 },
  { id: 4, left: 41, delay: -16, duration: 24, size: 20, drift: -20, rotate: 10 },
  { id: 5, left: 63, delay: -5, duration: 19, size: 24, drift: 16, rotate: -12 },
  { id: 6, left: 74, delay: -13, duration: 23, size: 30, drift: -12, rotate: 4 },
  { id: 7, left: 86, delay: -9, duration: 21, size: 22, drift: 22, rotate: -6 },
  { id: 8, left: 93, delay: -2, duration: 17, size: 26, drift: -18, rotate: 8 },
  { id: 9, left: 12, delay: -1.2, duration: 11, size: 24, drift: 24, rotate: -10, extra: true },
  { id: 10, left: 48, delay: -4, duration: 10, size: 20, drift: -16, rotate: 7, extra: true },
  { id: 11, left: 70, delay: -6, duration: 12, size: 28, drift: 14, rotate: -5, extra: true },
  { id: 12, left: 34, delay: -2.4, duration: 9.5, size: 22, drift: -22, rotate: 11, extra: true },
]
const onceOnly = computed(() => state.onceOnly !== false)
const pool = computed(() => eligiblePeople(state.people, state.winners, onceOnly.value))
const currentPrize = computed(() => state.prizes.find(prize => prize.id === state.currentPrizeId) || state.prizes[0])
const poolCount = computed(() => pool.value.length)
const locked = computed(() => ['intro', 'spin', 'stopping', 'reveal'].includes(phase.value) || busy.value)

const goLabel = computed(() => {
  if (phase.value === 'intro') return '入场中'
  if (phase.value === 'spin') return '停止'
  if (phase.value === 'stopping') return '揭晓中'
  if (phase.value === 'reveal') return '继续'
  if (!currentPrize.value || drawBlockReason(currentPrize.value, state.people, state.winners)) return '无法抽取'
  return '开始抽奖'
})

const goDisabled = computed(() => {
  if (busy.value || phase.value === 'intro') return true
  if (phase.value === 'spin' || phase.value === 'reveal') return false
  return Boolean(drawBlockReason(currentPrize.value, state.people, state.winners, onceOnly.value))
})

const statusText = computed(() => {
  const prize = currentPrize.value
  if (phase.value === 'intro') return '姓名正在汇入光球'
  if (phase.value === 'spin' && prize) return `正在抽取${prize.name}`
  if (phase.value === 'stopping' && prize) return `正在揭晓${prize.name}`
  if (phase.value === 'reveal') {
    const names = revealed.map(person => person.name).join('、')
    return `${prize?.name || '中奖'} · ${names}`
  }
  const reason = drawBlockReason(prize, state.people, state.winners, onceOnly.value)
  if (reason) return reason
  const once = Math.min(prize.perDraw, prizeSlotsLeft(prize, state.winners), pool.value.length)
  return `${prize.name} · 本次 ${once} 人 · ${prize.gift || '现场公布'}`
})

function showToast(message) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 2800)
}

function onReady() {
  if (phase.value === 'intro') phase.value = 'idle'
}

const saluteColors = ['#0869ac', '#079bb8', '#5ec4d8', '#ffffff', '#d7f4fa', '#e9f8fb']

function salutePiece(origin, index, wave) {
  const spread = origin === 'center' ? 80 : 38
  const base = origin === 'left' ? -72 : origin === 'right' ? -108 : -90
  const angle = (base + (Math.random() - 0.5) * spread) * Math.PI / 180
  const dist = origin === 'center' ? 140 + Math.random() * 260 : 380 + Math.random() * 520
  const lift = 80 + Math.random() * 160
  return {
    id: `${origin}-${wave}-${index}-${Date.now()}`,
    origin,
    shape: ['dot', 'ribbon', 'diamond', 'ring'][index % 4],
    color: saluteColors[(index + wave) % saluteColors.length],
    dx: Math.cos(angle) * dist,
    dy: Math.sin(angle) * dist + lift * 0.15,
    lift,
    delay: wave * 0.16 + index * 0.008,
    duration: 1.45 + Math.random() * 0.7,
    rot: (Math.random() - 0.5) * 320,
    size: origin === 'center' ? 6 + Math.random() * 8 : 7 + Math.random() * 10,
  }
}

function burstConfetti() {
  const pieces = []
  for (const wave of [0, 1]) {
    for (let index = 0; index < 22; index += 1) pieces.push(salutePiece('left', index, wave))
    for (let index = 0; index < 22; index += 1) pieces.push(salutePiece('right', index, wave))
    for (let index = 0; index < 16; index += 1) pieces.push(salutePiece('center', index, wave))
  }
  bits.value = pieces
  setTimeout(() => {
    bits.value = []
  }, 3200)
}

function flashOn() {
  flash.value = false
  requestAnimationFrame(() => {
    flash.value = true
  })
  burstConfetti()
}

async function onGo() {
  const now = performance.now()
  if (now - lastGo < 280) return
  lastGo = now
  if (busy.value || phase.value === 'intro') return
  const prize = currentPrize.value
  if (phase.value === 'idle') {
    const reason = drawBlockReason(prize, state.people, state.winners, onceOnly.value)
    if (reason) {
      showToast(reason)
      return
    }
    revealed = []
    phase.value = 'spin'
    stageRef.value?.spin()
    return
  }
  if (phase.value === 'spin') {
    const picked = pickWinners({ people: state.people, winners: state.winners, prize, onceOnly: onceOnly.value })
    if (!picked.length) {
      phase.value = 'idle'
      showToast(drawBlockReason(prize, state.people, state.winners, onceOnly.value) || '没有可抽取的人员')
      return
    }
    busy.value = true
    recordWinners(prize, picked)
    revealed = picked
    phase.value = 'stopping'
    await stageRef.value?.reveal(picked)
    phase.value = 'reveal'
    busy.value = false
    return
  }
  if (phase.value === 'reveal') {
    busy.value = true
    await stageRef.value?.restore()
    revealed = []
    phase.value = 'idle'
    busy.value = false
    const reason = drawBlockReason(prize, state.people, state.winners, onceOnly.value)
    if (reason && pool.value.length && state.prizes.some(item => !drawBlockReason(item, state.people, state.winners, onceOnly.value))) {
      const next = state.prizes.find(item => prizeSlotsLeft(item, state.winners) > 0)
      if (next) state.currentPrizeId = next.id
    }
  }
}

function onKey(event) {
  if (settingsOpen.value) {
    if (event.key === 'Escape') settingsOpen.value = false
    return
  }
  const tag = event.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (event.code !== 'Space') return
  event.preventDefault()
  onGo()
}

function onSave(next) {
  replaceState({
    ...next,
    winners: state.winners,
    onceOnly: state.onceOnly !== false,
    currentPrizeId: next.prizes.some(prize => prize.id === state.currentPrizeId)
      ? state.currentPrizeId
      : next.prizes[0].id,
  })
  settingsOpen.value = false
  showToast('已保存，并写入本机浏览器')
}

function onResetDemo() {
  resetDemo()
  settingsOpen.value = false
  showToast('已恢复昊量光电示例名单')
}

function onClearWinners() {
  clearWinners()
  settingsOpen.value = false
  showToast('中奖记录已清空，全员回到抽奖池')
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearTimeout(toastTimer)
})
</script>

<template>
  <div class="app">
    <LotteryStage
      ref="stageRef"
      :people="state.people"
      :pool="pool"
      @ready="onReady"
      @flash="flashOn"
    />
    <div class="packets" :class="{ festive: phase === 'reveal' || phase === 'stopping' }" aria-hidden="true">
      <span
        v-for="packet in packets"
        :key="packet.id"
        class="packet"
        :class="{ extra: packet.extra }"
        :style="{
          left: `${packet.left}%`,
          animationDelay: `${packet.delay}s`,
          animationDuration: `${packet.duration}s`,
          '--w': `${packet.size}px`,
          '--drift': `${packet.drift}px`,
          '--rot': `${packet.rotate}deg`,
        }"
      ></span>
    </div>
    <div class="flash" :class="{ on: flash }"></div>
    <span
      v-for="bit in bits"
      :key="bit.id"
      class="cannon"
      :class="[bit.origin, bit.shape]"
      :style="{
        background: bit.color,
        animationDelay: `${bit.delay}s`,
        animationDuration: `${bit.duration}s`,
        '--dx': `${bit.dx}px`,
        '--dy': `${bit.dy}px`,
        '--lift': `${bit.lift}px`,
        '--rot': `${bit.rot}deg`,
        '--size': `${bit.size}px`,
      }"
    ></span>

    <header class="top">
      <div class="brand-lockup">
        <div id="brand-stage" class="brand-stage" aria-hidden="true"></div>
        <div class="lockup">
          <p class="eyebrow">AUNION</p>
          <h1><span class="year">2027</span><span class="name">年会抽奖</span></h1>
          <p v-if="showCustomTitle" class="custom-title">{{ state.title }}</p>
        </div>
      </div>
      <button class="ghost nav" type="button" :disabled="locked" @click="settingsOpen = true">设置</button>
    </header>

    <aside v-if="state.winners.length" class="history" aria-label="中奖记录">
      <h2>已揭晓</h2>
      <ol>
        <li v-for="winner in [...state.winners].reverse()" :key="`${winner.personId}-${winner.at}`">
          <span class="who">{{ winner.name }}</span>
          <span class="meta">{{ winner.prizeName }} · {{ winner.dept }}</span>
        </li>
      </ol>
    </aside>

    <footer class="dock">
      <div class="action">
        <p class="status" aria-live="polite">{{ statusText }}</p>
        <button class="go" :class="{ stop: phase === 'spin', calm: phase === 'reveal' || phase === 'stopping' }" type="button" :disabled="goDisabled" @click="onGo">
          {{ goLabel }}
        </button>
        <p class="hint">空格键{{ phase === 'spin' ? '停止' : '抽取' }} · 还可抽取 {{ poolCount }} 人</p>
      </div>
    </footer>

    <SettingsDrawer
      v-if="settingsOpen"
      :title="state.title"
      :people="state.people"
      :prizes="state.prizes"
      :winners="state.winners"
      :current-prize-id="state.currentPrizeId"
      :once-only="onceOnly"
      @select-prize="(id) => { state.currentPrizeId = id }"
      @toggle-once="(value) => { state.onceOnly = value }"
      @close="settingsOpen = false"
      @save="onSave"
      @reset-demo="onResetDemo"
      @clear-winners="onClearWinners"
    />
    <p v-if="toast" class="toast" role="status">{{ toast }}</p>
  </div>
</template>
