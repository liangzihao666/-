<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import LotteryStage from './components/LotteryStage.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'
import { drawBlockReason, pickWinners, prizeSlotsLeft, prizeWonCount, remainingPeople } from './lottery.js'
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

const pool = computed(() => remainingPeople(state.people, state.winners))
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
  return Boolean(drawBlockReason(currentPrize.value, state.people, state.winners))
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
  const reason = drawBlockReason(prize, state.people, state.winners)
  if (reason) return reason
  const once = Math.min(prize.perDraw, prizeSlotsLeft(prize, state.winners), pool.value.length)
  return `${prize.name} · 本次 ${once} 人 · ${prize.gift || '现场公布'}`
})

function leftOf(prize) {
  return prizeSlotsLeft(prize, state.winners)
}

function wonOf(prize) {
  return prizeWonCount(prize, state.winners)
}

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

function burstConfetti() {
  bits.value = Array.from({ length: 42 }, (_, index) => ({
    id: `${Date.now()}-${index}`,
    left: Math.random() * 100,
    delay: Math.random() * 0.18,
    duration: 1.5 + Math.random() * 1.3,
    color: ['#0869ac', '#079bb8', '#ffffff', '#9fd8ea', '#d7f3f8'][index % 5],
    drift: (Math.random() - 0.5) * 140,
  }))
  setTimeout(() => {
    bits.value = []
  }, 3000)
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
    const reason = drawBlockReason(prize, state.people, state.winners)
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
    const picked = pickWinners({ people: state.people, winners: state.winners, prize })
    if (!picked.length) {
      phase.value = 'idle'
      showToast(drawBlockReason(prize, state.people, state.winners) || '没有可抽取的人员')
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
    const reason = drawBlockReason(prize, state.people, state.winners)
    if (reason && pool.value.length && state.prizes.some(item => !drawBlockReason(item, state.people, state.winners))) {
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
    <div class="flash" :class="{ on: flash }"></div>
    <span
      v-for="bit in bits"
      :key="bit.id"
      class="bit"
      :style="{
        left: `${bit.left}%`,
        background: bit.color,
        animationDelay: `${bit.delay}s`,
        animationDuration: `${bit.duration}s`,
        '--drift': `${bit.drift}px`,
      }"
    ></span>

    <header class="top">
      <img class="wordmark" src="/brand/aunion-logo.png" alt="昊量光电 aunion" />
      <div class="titles">
        <p class="eyebrow">AUNION · ANNUAL GALA 2027</p>
        <h1>{{ state.title }}</h1>
      </div>
      <div class="top-actions">
        <span class="pill">同一人只中一次</span>
        <button class="ghost" type="button" :disabled="locked" @click="settingsOpen = true">名单与奖项</button>
      </div>
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
      <div class="chips" role="tablist" aria-label="奖项">
        <button
          v-for="prize in state.prizes"
          :key="prize.id"
          type="button"
          class="chip"
          :class="{ active: prize.id === currentPrize?.id, done: leftOf(prize) === 0 }"
          :disabled="locked"
          @click="state.currentPrizeId = prize.id"
        >
          <strong>{{ prize.name }}</strong>
          <span>{{ wonOf(prize) }}/{{ prize.count }}</span>
          <small>{{ prize.gift }}</small>
        </button>
      </div>
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
      @close="settingsOpen = false"
      @save="onSave"
      @reset-demo="onResetDemo"
      @clear-winners="onClearWinners"
    />
    <p v-if="toast" class="toast" role="status">{{ toast }}</p>
  </div>
</template>
