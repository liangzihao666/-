import * as XLSX from 'xlsx'
import { rowsToPeople } from './lottery.js'

export async function readPeopleFile(file, previous = []) {
  const name = String(file?.name || '').toLowerCase()
  let workbook
  if (name.endsWith('.csv')) {
    const text = await file.text()
    workbook = XLSX.read(text, { type: 'string' })
  } else {
    const data = await file.arrayBuffer()
    workbook = XLSX.read(data, { type: 'array' })
  }
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return rowsToPeople([], previous)
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: '',
  })
  return rowsToPeople(rows, previous)
}

export function downloadPeopleTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['姓名', '部门'],
    ['林启明', '光学研发'],
    ['周婉清', '光谱应用'],
  ])
  sheet['!cols'] = [{ wch: 16 }, { wch: 16 }]
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, '名单')
  XLSX.writeFile(book, '昊量光电年会名单模板.xlsx')
}
