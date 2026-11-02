import { reactive, watch } from 'vue'
import { STORAGE_KEY, freshState, sanitizeState } from './lottery.js'

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return sanitizeState(JSON.parse(raw))
  }
  catch {
    return null
  }
}

export const state = reactive(readStored() || freshState())

watch(state, () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }
  catch {
    // 隐私模式或配额不足时仍可继续当场抽奖。
  }
}, { deep: true })

export function replaceState(next) {
  const clean = sanitizeState(next) || freshState()
  state.title = clean.title
  state.people = clean.people
  state.prizes = clean.prizes
  state.winners = clean.winners
  state.currentPrizeId = clean.currentPrizeId
}

export function recordWinners(prize, picked) {
  const at = Date.now()
  picked.forEach((person, index) => {
    state.winners.push({
      personId: person.id,
      name: person.name,
      dept: person.dept,
      prizeId: prize.id,
      prizeName: prize.name,
      gift: prize.gift,
      at: at + index,
    })
  })
}

export function clearWinners() {
  state.winners = []
}

export function resetDemo() {
  replaceState(freshState())
}
