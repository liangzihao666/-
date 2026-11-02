<script setup>
import { reactive, ref } from 'vue'
import { parsePeopleText, peopleToText } from '../lottery.js'

const props = defineProps({
  title: { type: String, default: '' },
  people: { type: Array, default: () => [] },
  prizes: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'save', 'reset-demo', 'clear-winners'])

const draftTitle = ref(props.title)
const draftPeople = ref(peopleToText(props.people))
const draftPrizes = reactive(props.prizes.map(prize => ({ ...prize })))
const error = ref('')
const confirmClear = ref(false)
const confirmDemo = ref(false)

function addPrize() {
  draftPrizes.push({
    id: `prize-${Date.now().toString(36)}`,
    name: '新奖项',
    count: 1,
    perDraw: 1,
    gift: '',
  })
}

function removePrize(index) {
  draftPrizes.splice(index, 1)
}

function save() {
  const people = parsePeopleText(draftPeople.value, props.people)
  if (!people.length) {
    error.value = '请至少填写一位参与人员'
    return
  }
  if (!draftPrizes.length) {
    error.value = '请至少保留一个奖项'
    return
  }
  const prizes = draftPrizes.map(prize => {
    const count = Math.max(1, Math.round(Number(prize.count) || 1))
    let perDraw = Math.max(1, Math.round(Number(prize.perDraw) || 1))
    if (perDraw > count) perDraw = count
    return {
      id: prize.id,
      name: String(prize.name || '').trim() || '未命名奖项',
      count,
      perDraw,
      gift: String(prize.gift || '').trim(),
    }
  })
  emit('save', {
    title: draftTitle.value.trim() || '昊量光电 2027 年会',
    people,
    prizes,
  })
}

function onKey(event) {
  if (event.key === 'Escape') emit('close')
}
</script>

<template>
  <div class="drawer-mask" @click.self="emit('close')" @keydown="onKey">
    <aside class="drawer" role="dialog" aria-labelledby="settings-title">
      <header class="drawer-head">
        <div>
          <p class="eyebrow">SETTINGS</p>
          <h2 id="settings-title">名单与奖项</h2>
        </div>
        <button class="ghost" type="button" @click="emit('close')">关闭</button>
      </header>

      <label class="field">
        <span>活动标题</span>
        <input v-model="draftTitle" maxlength="40" />
      </label>

      <label class="field">
        <span>参与人员</span>
        <textarea v-model="draftPeople" rows="10" spellcheck="false" placeholder="林启明,光学研发"></textarea>
        <small>每行一位，格式「姓名,部门」。保存后已不在名单中的中奖记录会去掉，其余中奖者不会重复中奖。</small>
      </label>

      <div class="field">
        <div class="field-row">
          <span>奖项</span>
          <button class="ghost tiny" type="button" @click="addPrize">添加奖项</button>
        </div>
        <div class="prize-table">
          <div class="prize-head">
            <span>名称</span><span>名额</span><span>每次</span><span>礼品</span><span></span>
          </div>
          <div v-for="(prize, index) in draftPrizes" :key="prize.id" class="prize-row">
            <input v-model="prize.name" aria-label="奖项名称" />
            <input v-model.number="prize.count" type="number" min="1" max="500" aria-label="名额" />
            <input v-model.number="prize.perDraw" type="number" min="1" max="50" aria-label="每次抽取" />
            <input v-model="prize.gift" aria-label="礼品" />
            <button class="ghost tiny danger" type="button" @click="removePrize(index)">删除</button>
          </div>
        </div>
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>

      <div class="drawer-actions">
        <button class="go slim" type="button" @click="save">保存</button>
        <button class="ghost" type="button" @click="confirmClear = !confirmClear">
          {{ confirmClear ? '确认清空中奖记录' : '清空中奖记录' }}
        </button>
        <button v-if="confirmClear" class="ghost danger" type="button" @click="emit('clear-winners')">执行清空</button>
        <button class="ghost" type="button" @click="confirmDemo = !confirmDemo">
          {{ confirmDemo ? '确认恢复示例数据' : '恢复示例数据' }}
        </button>
        <button v-if="confirmDemo" class="ghost danger" type="button" @click="emit('reset-demo')">执行恢复</button>
      </div>
    </aside>
  </div>
</template>
