/** 抽奖纯逻辑：名单、奖项、不重复抽取。界面与三维场景不放在这里。 */

export const STORAGE_KEY = 'aunion-gala-lottery-2027'

export const defaultTitle = '昊量光电 2027 年会'

export const defaultPrizes = [
  { id: 'special', name: '特等奖', count: 1, perDraw: 1, gift: '旗舰光谱仪体验名额' },
  { id: 'first', name: '一等奖', count: 2, perDraw: 1, gift: '光学实验礼盒' },
  { id: 'second', name: '二等奖', count: 4, perDraw: 2, gift: '品牌降噪耳机' },
  { id: 'third', name: '三等奖', count: 8, perDraw: 4, gift: '昊量定制保温杯' },
]

const roster = [
  ['林启明', '光学研发'], ['周婉清', '光学研发'], ['陈景行', '光学研发'], ['吴思远', '光学研发'],
  ['郑晓荷', '光谱应用'], ['赵一楠', '光谱应用'], ['孙嘉树', '光谱应用'], ['李明哲', '光谱应用'],
  ['王诗涵', '精密机械'], ['张博文', '精密机械'], ['黄子墨', '精密机械'], ['刘欣然', '精密机械'],
  ['何俊杰', '销售'], ['高峰', '销售'], ['罗雨桐', '销售'], ['马天宇', '销售'],
  ['许清越', '市场'], ['丁一凡', '市场'], ['冯雪松', '市场'], ['蔡文博', '市场'],
  ['邓可欣', '供应链'], ['潘俊豪', '供应链'], ['袁梦琪', '供应链'], ['蒋承志', '供应链'],
  ['韩立', '财务'], ['曹雅静', '财务'], ['彭浩然', '财务'], ['谢安然', '财务'],
  ['董方', '人力资源'], ['魏子轩', '人力资源'], ['苏晚晴', '人力资源'], ['贾一鸣', '人力资源'],
  ['沈知夏', '光学研发'], ['陆景深', '光谱应用'], ['叶清和', '销售'], ['杜星河', '市场'],
]

export const defaultPeople = roster.map(([name, dept], index) => ({
  id: `staff-${String(index + 1).padStart(2, '0')}`,
  name,
  dept,
}))

export function peopleToText(people) {
  return people.map(person => `${person.name},${person.dept || '昊量光电'}`).join('\n')
}

export function parsePeopleText(text, previous = []) {
  const used = new Set()
  const people = []
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const parts = line.split(/[,，|]/).map(part => part.trim()).filter(Boolean)
    const name = parts[0]
    if (!name) continue
    const dept = parts[1] || '昊量光电'
    people.push(personFromRow(name, dept, previous, used, people.length))
  }
  return people
}

const NAME_HEADERS = new Set(['姓名', '名字', '名称', 'name', '人员', '员工', '参与人', '人员姓名', '员工姓名'])
const DEPT_HEADERS = new Set(['部门', 'dept', 'department', '科室', '单位', '所属部门', '部门名称'])

function headerKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '')
}

function personFromRow(name, dept, previous, used, index) {
  const existing = previous.find(person => person.name === name && !used.has(person.id))
  const id = existing?.id || `p-${index}-${Math.random().toString(36).slice(2, 8)}`
  if (existing) used.add(existing.id)
  return { id, name, dept: dept || '昊量光电' }
}

/**
 * 把表格行转成人员。首行若出现常见表头（姓名 / name、部门 / dept）则跳过。
 * 只有一列时整列当作姓名。
 */
export function rowsToPeople(rows, previous = []) {
  const skipped = []
  const matrix = (rows || [])
    .map(row => (Array.isArray(row) ? row : Object.values(row || {})))
    .filter(row => row.some(cell => String(cell ?? '').trim()))
  if (!matrix.length) return { people: [], imported: 0, skipped }

  const header = matrix[0].map(headerKey)
  let nameIndex = header.findIndex(cell => NAME_HEADERS.has(cell))
  let deptIndex = header.findIndex(cell => DEPT_HEADERS.has(cell))
  const hasHeader = nameIndex >= 0 || deptIndex >= 0
  const start = hasHeader ? 1 : 0
  if (!hasHeader) {
    nameIndex = 0
    deptIndex = matrix.some(row => String(row[1] ?? '').trim()) ? 1 : -1
  } else if (nameIndex < 0) {
    nameIndex = header.findIndex((_, index) => index !== deptIndex)
    if (nameIndex < 0) nameIndex = 0
  }

  const used = new Set()
  const people = []
  for (let index = start; index < matrix.length; index += 1) {
    const row = matrix[index]
    const name = String(row[nameIndex] ?? '').trim()
    const sourceRow = index + 1
    if (!name || NAME_HEADERS.has(headerKey(name))) {
      skipped.push({ row: sourceRow, reason: '缺少姓名' })
      continue
    }
    const dept = deptIndex >= 0 ? String(row[deptIndex] ?? '').trim() : ''
    people.push(personFromRow(name, dept, previous, used, people.length))
  }
  return { people, imported: people.length, skipped }
}

export function mergePeople(current, incoming) {
  const names = new Set(current.map(person => person.name))
  const extra = incoming.filter(person => !names.has(person.name))
  return current.concat(extra)
}

export function shuffle(list, rng = Math.random) {
  const arr = list.slice()
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function remainingPeople(people, winners) {
  const taken = new Set(winners.map(winner => winner.personId))
  return people.filter(person => !taken.has(person.id))
}

export function prizeWonCount(prize, winners) {
  return winners.filter(winner => winner.prizeId === prize.id).length
}

export function prizeSlotsLeft(prize, winners) {
  return Math.max(0, Number(prize.count) - prizeWonCount(prize, winners))
}

export function eligiblePeople(people, winners, onceOnly = true) {
  return onceOnly ? remainingPeople(people, winners) : people
}

export function pickWinners({ people, winners, prize, onceOnly = true, rng = Math.random }) {
  if (!prize) return []
  const pool = eligiblePeople(people, winners, onceOnly)
  const slots = prizeSlotsLeft(prize, winners)
  const count = Math.min(Math.max(1, Number(prize.perDraw) || 1), slots, pool.length)
  if (count <= 0) return []
  return shuffle(pool, rng).slice(0, count)
}

export function drawBlockReason(prize, people, winners, onceOnly = true) {
  if (!prize) return '请先配置奖项'
  if (!people.length) return '请先添加参与人员'
  if (!eligiblePeople(people, winners, onceOnly).length) return '所有人员都已中奖'
  if (prizeSlotsLeft(prize, winners) <= 0) return `${prize.name}名额已满，请到设置里切换奖项`
  return ''
}

export function freshState() {
  return {
    title: defaultTitle,
    people: defaultPeople.map(person => ({ ...person })),
    prizes: defaultPrizes.map(prize => ({ ...prize })),
    winners: [],
    currentPrizeId: defaultPrizes[0].id,
    onceOnly: true,
  }
}

export function sanitizeState(data) {
  if (!data || typeof data !== 'object') return null
  if (!Array.isArray(data.people) || !Array.isArray(data.prizes)) return null
  const people = data.people
    .filter(person => person && person.id && person.name)
    .map(person => ({
      id: String(person.id),
      name: String(person.name),
      dept: String(person.dept || '昊量光电'),
    }))
  const prizes = data.prizes
    .filter(prize => prize && prize.id && prize.name)
    .map(prize => ({
      id: String(prize.id),
      name: String(prize.name),
      count: Math.max(1, Math.round(Number(prize.count) || 1)),
      perDraw: Math.max(1, Math.round(Number(prize.perDraw) || 1)),
      gift: String(prize.gift || ''),
    }))
  if (!people.length || !prizes.length) return null
  prizes.forEach(prize => {
    if (prize.perDraw > prize.count) prize.perDraw = prize.count
  })
  const knownPeople = new Set(people.map(person => person.id))
  const winners = (Array.isArray(data.winners) ? data.winners : [])
    .filter(winner => winner && knownPeople.has(winner.personId) && winner.prizeId)
    .map(winner => ({
      personId: String(winner.personId),
      name: String(winner.name || people.find(person => person.id === winner.personId)?.name || ''),
      dept: String(winner.dept || ''),
      prizeId: String(winner.prizeId),
      prizeName: String(winner.prizeName || ''),
      gift: String(winner.gift || ''),
      at: Number(winner.at) || 0,
    }))
  const currentPrizeId = prizes.some(prize => prize.id === data.currentPrizeId)
    ? data.currentPrizeId
    : prizes[0].id
  return {
    onceOnly: data.onceOnly !== false,
    title: String(data.title || defaultTitle),
    people,
    prizes,
    winners,
    currentPrizeId,
  }
}
