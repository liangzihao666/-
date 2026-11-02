import assert from 'node:assert/strict'
import test from 'node:test'
import {
  defaultPeople,
  drawBlockReason,
  mergePeople,
  parsePeopleText,
  pickWinners,
  prizeSlotsLeft,
  remainingPeople,
  rowsToPeople,
  sanitizeState,
} from '../src/lottery.js'

test('示例名单覆盖四个奖项名额且没有重复编号', () => {
  const ids = new Set(defaultPeople.map(person => person.id))
  assert.equal(ids.size, defaultPeople.length)
  assert.ok(defaultPeople.length >= 15)
})

test('已中奖的人不会再次被抽中', () => {
  const people = Array.from({ length: 8 }, (_, index) => ({
    id: `p${index}`,
    name: `姓名${index}`,
    dept: '光学研发',
  }))
  const prize = { id: 'third', name: '三等奖', count: 6, perDraw: 3 }
  const winners = []
  const first = pickWinners({ people, winners, prize, rng: () => 0.3 })
  assert.equal(first.length, 3)
  first.forEach(person => winners.push({ personId: person.id, prizeId: prize.id }))
  const second = pickWinners({ people, winners, prize, rng: () => 0.3 })
  const overlap = second.filter(person => first.some(won => won.id === person.id))
  assert.equal(overlap.length, 0)
  assert.equal(remainingPeople(people, winners).length, 5)
})

test('单次抽取不超过剩余名额和剩余人数', () => {
  const people = [{ id: 'a', name: '甲', dept: '销售' }]
  const prize = { id: 'second', name: '二等奖', count: 4, perDraw: 2 }
  const picked = pickWinners({ people, winners: [], prize, rng: () => 0 })
  assert.equal(picked.length, 1)
  assert.equal(prizeSlotsLeft(prize, [{ personId: 'a', prizeId: 'second' }]), 3)
  assert.match(drawBlockReason(prize, people, [{ personId: 'a', prizeId: 'second' }]), /都已中奖/)
})

test('名单文本能保留同名对应的原编号', () => {
  const previous = [{ id: 'staff-01', name: '林启明', dept: '光学研发' }]
  const people = parsePeopleText('林启明,光谱应用\n新人,市场', previous)
  assert.equal(people[0].id, 'staff-01')
  assert.equal(people[0].dept, '光谱应用')
  assert.equal(people[1].dept, '市场')
})

test('Excel 行能识别中文表头，单列则全部当作姓名', () => {
  const headed = rowsToPeople([
    ['姓名', '部门'],
    ['林启明', '光学研发'],
    ['', '销售'],
    ['周婉清', ''],
  ], [{ id: 'staff-01', name: '林启明', dept: '旧部门' }])
  assert.equal(headed.imported, 2)
  assert.equal(headed.people[0].id, 'staff-01')
  assert.equal(headed.people[0].dept, '光学研发')
  assert.equal(headed.people[1].dept, '昊量光电')
  assert.equal(headed.skipped.length, 1)

  const plain = rowsToPeople([
    ['赵一楠'],
    ['孙嘉树'],
  ])
  assert.deepEqual(plain.people.map(person => person.name), ['赵一楠', '孙嘉树'])
  assert.equal(plain.skipped.length, 0)
})

test('追加导入不会重复已有姓名', () => {
  const current = [{ id: 'a', name: '林启明', dept: '光学研发' }]
  const incoming = [
    { id: 'b', name: '林启明', dept: '销售' },
    { id: 'c', name: '周婉清', dept: '市场' },
  ]
  const merged = mergePeople(current, incoming)
  assert.deepEqual(merged.map(person => person.name), ['林启明', '周婉清'])
  assert.equal(merged[0].id, 'a')
})

test('损坏的本地存档会被丢弃', () => {
  assert.equal(sanitizeState({ people: [], prizes: [] }), null)
  const clean = sanitizeState({
    title: '测试',
    people: [{ id: 'a', name: '甲' }],
    prizes: [{ id: 'special', name: '特等奖', count: 1, perDraw: 3 }],
    winners: [{ personId: 'missing', prizeId: 'special' }, { personId: 'a', prizeId: 'special', name: '甲' }],
    currentPrizeId: 'nope',
  })
  assert.equal(clean.prizes[0].perDraw, 1)
  assert.equal(clean.winners.length, 1)
  assert.equal(clean.currentPrizeId, 'special')
})
