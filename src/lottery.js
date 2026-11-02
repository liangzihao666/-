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
    const existing = previous.find(person => person.name === name && !used.has(person.id))
    const id = existing?.id || `p-${people.length}-${Math.random().toString(36).slice(2, 8)}`
    if (existing) used.add(existing.id)
    people.push({ id, name, dept })
  }
  return people
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

export function pickWinners({ people, winners, prize, rng = Math.random }) {
  if (!prize) return []
  const pool = remainingPeople(people, winners)
  const slots = prizeSlotsLeft(prize, winners)
  const count = Math.min(Math.max(1, Number(prize.perDraw) || 1), slots, pool.length)
  if (count <= 0) return []
  return shuffle(pool, rng).slice(0, count)
}

export function drawBlockReason(prize, people, winners) {
  if (!prize) return '请先配置奖项'
  if (!people.length) return '请先添加参与人员'
  if (!remainingPeople(people, winners).length) return '所有人员都已中奖'
  if (prizeSlotsLeft(prize, winners) <= 0) return `${prize.name}名额已满，请切换奖项`
  return ''
}

export function freshState() {
  return {
    title: defaultTitle,
    people: defaultPeople.map(person => ({ ...person })),
    prizes: defaultPrizes.map(prize => ({ ...prize })),
    winners: [],
    currentPrizeId: defaultPrizes[0].id,
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
    title: String(data.title || defaultTitle),
    people,
    prizes,
    winners,
    currentPrizeId,
  }
}
