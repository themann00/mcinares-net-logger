import { NextResponse } from 'next/server'

const DOCS_URL = 'https://www.mcinares.org/documents/'
const PDF_BASE = 'https://www.mcinares.org/wsda/'
const XLSX_BASE = 'https://www.mcinares.org/wsda/'
const ANNOUNCEMENT_PATTERN = /(\d{2}_\d{2}_\d{2})_Announcements\.pdf/g
const CHECKLIST_PATTERN = /(\d{2}_\d{2}_\d{2,4})[ _]Checkin[s a-zA-Z-]*\.xlsx/g

function parseDate(dateStr: string) {
  const parts = dateStr.split('_')
  const month = parseInt(parts[0])
  const day = parseInt(parts[1])
  const rawYear = parseInt(parts[2])
  const year = rawYear < 100 ? 2000 + rawYear : rawYear
  return {
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    label: `${month}/${day}/${year}`,
  }
}

export async function GET() {
  try {
    const res = await fetch(DOCS_URL, { next: { revalidate: 300 } })
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch documents page' }, { status: 502 })

    const html = await res.text()

    const annMatches = [...html.matchAll(ANNOUNCEMENT_PATTERN)]
    const announcements = annMatches.map(m => {
      const { date, label } = parseDate(m[1])
      return {
        filename: m[0],
        url: `${PDF_BASE}${m[0]}`,
        date,
        label,
      }
    })
    announcements.sort((a, b) => b.date.localeCompare(a.date))

    const clMatches = [...html.matchAll(CHECKLIST_PATTERN)]
    const checklists = clMatches.map(m => {
      const { date, label } = parseDate(m[1])
      return {
        filename: m[0],
        url: `${XLSX_BASE}${encodeURIComponent(m[0])}`,
        date,
        label,
      }
    })
    checklists.sort((a, b) => b.date.localeCompare(a.date))

    return NextResponse.json({ announcements, checklists })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}
