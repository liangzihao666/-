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
const volley = ref([])
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
  const origins = ['left', 'right', 'center', 'left', 'right']
  for (let wave = 0; wave < 3; wave += 1) {
    origins.forEach((origin) => {
      const count = origin === 'center' ? 28 : 36
      for (let index = 0; index < count; index += 1) pieces.push(salutePiece(origin, index, wave))
    })
  }
  bits.value = pieces
  volley.value = Array.from({ length: 72 }, (_, index) => ({
    id: `v-${Date.now()}-${index}`,
    left: (index * 7.3 + Math.random() * 4) % 100,
    delay: (index % 9) * 0.045,
    duration: 1.7 + (index % 6) * 0.22,
    size: 20 + (index % 5) * 6,
    drift: ((index % 2) ? 1 : -1) * (30 + (index % 8) * 18),
    rotate: -24 + (index % 11) * 5,
  }))
  setTimeout(() => {
    bits.value = []
    volley.value = []
  }, 3800)
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
      <span
        v-for="packet in volley"
        :key="packet.id"
        class="packet volley"
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
      <button class="icon-btn" type="button" :disabled="locked" aria-label="设置" title="设置" @click="settingsOpen = true">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Zm8.2 3.1-.9-.2a7.2 7.2 0 0 0-.5-1.3l.6-.7a1 1 0 0 0 0-1.4l-.9-.9a1 1 0 0 0-1.4 0l-.7.6a7.2 7.2 0 0 0-1.3-.5l-.2-.9a1 1 0 0 0-1-.8h-1.2a1 1 0 0 0-1 .8l-.2.9a7.2 7.2 0 0 0-1.3.5l-.7-.6a1 1 0 0 0-1.4 0l-.9.9a1 1 0 0 0 0 1.4l.6.7a7.2 7.2 0 0 0-.5 1.3l-.9.2a1 1 0 0 0-.8 1v1.2a1 1 0 0 0 .8 1l.9.2c.1.5.3.9.5 1.3l-.6.7a1 1 0 0 0 0 1.4l.9.9a1 1 0 0 0 1.4 0l.7-.6c.4.2.8.4 1.3.5l.2.9a1 1 0 0 0 1 .8h1.2a1 1 0 0 0 1-.8l.2-.9c.5-.1.9-.3 1.3-.5l.7.6a1 1 0 0 0 1.4 0l.9-.9a1 1 0 0 0 0-1.4l-.6-.7c.2-.4.4-.8.5-1.3l.9-.2a1 1 0 0 0 .8-1v-1.2a1 1 0 0 0-.8-1Z" />
        </svg>
      </button>
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
        <button
          class="go stage"
          :class="{ stop: phase === 'spin' || phase === 'stopping', calm: phase === 'reveal' }"
          type="button"
          :disabled="goDisabled"
          :aria-label="goLabel"
          :title="goLabel"
          @click="onGo"
        >
          <svg v-if="phase === 'spin' || phase === 'stopping'" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
          </svg>
          <svg v-else-if="phase === 'reveal'" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M5 12.5 9.2 17 19 7.2l-1.4-1.4-8.4 8.3-2.8-2.8L5 12.5Z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M8 5.8v12.4L19 12 8 5.8Z" />
          </svg>
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
