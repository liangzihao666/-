<script setup>
import { reactive, ref } from 'vue'
import { downloadPeopleTemplate, readPeopleFile } from '../importPeople.js'
import { mergePeople, parsePeopleText, peopleToText, prizeSlotsLeft, prizeWonCount } from '../lottery.js'

const props = defineProps({
  title: { type: String, default: '' },
  people: { type: Array, default: () => [] },
  prizes: { type: Array, default: () => [] },
  winners: { type: Array, default: () => [] },
  currentPrizeId: { type: String, default: '' },
  onceOnly: { type: Boolean, default: true },
})

const emit = defineEmits(['close', 'save', 'reset-demo', 'clear-winners', 'select-prize', 'toggle-once'])

const draftTitle = ref(props.title)
const draftPeople = ref(peopleToText(props.people))
const draftPrizes = reactive(props.prizes.map(prize => ({ ...prize })))
const error = ref('')
const importReport = ref('')
const pendingImport = ref(null)
const fileInput = ref(null)
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

function pickFile() {
  importReport.value = ''
  pendingImport.value = null
  if (fileInput.value) fileInput.value.value = ''
  fileInput.value?.click()
}

async function onFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const current = parsePeopleText(draftPeople.value, props.people)
    const result = await readPeopleFile(file, current)
    if (!result.imported) {
      const detail = result.skipped.length ? `，${formatSkipped(result.skipped)}` : ''
      importReport.value = `没有读到可用姓名${detail}`
      pendingImport.value = null
      return
    }
    pendingImport.value = result.people
    const skipNote = result.skipped.length ? `，跳过 ${result.skipped.length} 行（${formatSkipped(result.skipped)}）` : ''
    importReport.value = `已识别 ${result.imported} 人${skipNote}。请选择替换或追加，然后点保存。`
  }
  catch {
    importReport.value = '无法读取这个文件，请使用 xlsx、xls 或 csv'
    pendingImport.value = null
  }
}

function formatSkipped(skipped) {
  return skipped.slice(0, 5).map(item => `第 ${item.row} 行${item.reason}`).join('、')
}

function applyImport(mode) {
  if (!pendingImport.value) return
  const current = parsePeopleText(draftPeople.value, props.people)
  const next = mode === 'append' ? mergePeople(current, pendingImport.value) : pendingImport.value
  draftPeople.value = peopleToText(next)
  importReport.value = mode === 'append'
    ? `已追加，当前名单 ${next.length} 人。点保存后写入本机。`
    : `已替换为 ${next.length} 人。点保存后写入本机。`
  pendingImport.value = null
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
        <small>每行一位，格式「姓名,部门」。保存后已不在名单中的中奖记录会去掉。</small>
      </label>

      <div class="field">
        <div class="field-row">
          <span>导入 Excel</span>
          <button class="ghost tiny" type="button" @click="downloadPeopleTemplate">下载模板</button>
        </div>
        <div class="import-actions">
          <button class="ghost" type="button" @click="pickFile">选择 Excel / CSV</button>
          <input
            ref="fileInput"
            class="file-input"
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            @change="onFile"
          />
        </div>
        <p v-if="importReport" class="import-report">{{ importReport }}</p>
        <div v-if="pendingImport" class="import-actions">
          <button class="ghost" type="button" @click="applyImport('replace')">替换当前名单</button>
          <button class="ghost" type="button" @click="applyImport('append')">追加到名单</button>
        </div>
        <small>支持 xlsx、xls、csv。表头认「姓名 / name」，部门可用「部门 / dept」。只有一列时整列当作姓名。</small>
      </div>

      <label class="switch">
        <input type="checkbox" :checked="onceOnly" @change="emit('toggle-once', $event.target.checked)" />
        <span>同一人只中一次</span>
      </label>

      <div class="field">
        <span>当前抽取</span>
        <div class="prize-pick" role="listbox" aria-label="选择奖项">
          <button
            v-for="prize in prizes"
            :key="prize.id"
            type="button"
            class="pick"
            :class="{ active: prize.id === currentPrizeId, done: prizeSlotsLeft(prize, winners) === 0 }"
            @click="emit('select-prize', prize.id)"
          >
            <strong>{{ prize.name }}</strong>
            <em>{{ prizeWonCount(prize, winners) }}/{{ prize.count }}</em>
            <small>{{ prize.gift }}</small>
          </button>
        </div>
      </div>

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
