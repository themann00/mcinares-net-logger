'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format, differenceInMinutes } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Printer, Download, Check, X } from 'lucide-react'
import { normalizeSirenId } from '@/lib/sirenLocations'
import type { Net, Station, LogEntry } from '@/types'

function NA() {
  return <span className="text-gray-400">N/A</span>
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex gap-2 py-1.5 border-b border-gray-200 print:border-gray-300 last:border-0">
      <span className="text-gray-500 w-44 flex-shrink-0 text-sm">{label}</span>
      <span className="text-gray-900 text-sm font-medium">{value ?? <NA />}</span>
    </div>
  )
}

const NET_LABELS: Record<string, string> = {
  ares: 'Marion County ARES Net (Weekly)',
  skywarn: 'Marion County Skywarn Severe Weather Net',
  siren: 'Marion County Siren Check Net',
}

const LOG_TYPE_LABELS: Record<string, string> = {
  net_open: 'NET OPEN',
  checkin: 'CHECK-IN',
  report: 'REPORT',
  traffic: 'TRAFFIC',
  announcement: 'ANNOUNCEMENT',
  liaison: 'LIAISON',
  alt_nc: 'ALT NC',
  continuity: 'CONTINUITY',
  circle_back: 'UPDATE',
  station_moved: 'MOVED',
  late_checkin: 'LATE CHECK-IN',
  net_close: 'NET CLOSE',
  note: 'NOTE',
}

interface SirenResult {
  siren: string
  sound: boolean | null
  rotation: boolean | null
  visual: boolean | null
}

/**
 * One row per siren reported this net, numerically ordered. Multiple reports
 * for the same siren merge with the latest non-null value per field winning.
 */
function deriveSirenReports(log: LogEntry[]): SirenResult[] {
  const map = new Map<string, SirenResult>()
  for (const e of log) {
    if (e.entry_type !== 'report') continue
    const meta = e.metadata as Record<string, unknown> | null
    if (!meta || typeof meta.siren_number !== 'string' || !meta.siren_number.trim()) continue
    const key = normalizeSirenId(meta.siren_number).toUpperCase()
    const prev = map.get(key) || { siren: normalizeSirenId(meta.siren_number), sound: null, rotation: null, visual: null }
    map.set(key, {
      siren: prev.siren,
      sound: typeof meta.sound === 'boolean' ? meta.sound : prev.sound,
      rotation: typeof meta.rotation === 'boolean' ? meta.rotation : prev.rotation,
      visual: typeof meta.visual === 'boolean' ? meta.visual : prev.visual,
    })
  }
  return Array.from(map.values()).sort((a, b) => {
    const na = /^\d+$/.test(a.siren) ? parseInt(a.siren, 10) : null
    const nb = /^\d+$/.test(b.siren) ? parseInt(b.siren, 10) : null
    if (na !== null && nb !== null) return na - nb
    if (na !== null) return -1
    if (nb !== null) return 1
    return a.siren.localeCompare(b.siren)
  })
}

interface WeatherReportRow {
  time: string
  callsign: string
  type: string
  content: string
}

/**
 * Skywarn: one row per report entry in log order. Type comes from structured
 * metadata when present (reports logged since 0.16.0); older entries show the
 * raw text only.
 */
function deriveWeatherReports(log: LogEntry[]): WeatherReportRow[] {
  return log
    .filter(e => e.entry_type === 'report')
    .map(e => {
      const meta = e.metadata as Record<string, unknown> | null
      const callsign = e.station?.callsign || (e.content.match(/^([A-Z0-9/]+):/)?.[1] ?? '')
      let content = e.content
      if (callsign && content.toUpperCase().startsWith(`${callsign.toUpperCase()}:`)) {
        content = content.slice(callsign.length + 1).trim()
      }
      return {
        time: e.timestamp,
        callsign,
        type: typeof meta?.report_type === 'string' ? meta.report_type : '',
        content,
      }
    })
}

function YesNo({ value }: { value: boolean | null }) {
  if (value === true) return <Check className="w-4 h-4 text-green-600 inline-block" />
  if (value === false) return <X className="w-4 h-4 text-red-600 inline-block" />
  return <span className="text-gray-400">&mdash;</span>
}

function getSuffix(cs: string) {
  const m = cs.match(/\d([A-Z]+)$/)
  return m ? m[1] : cs
}

/** "KD9ABC" -> ["KD9", "ABC"]; falls back to everything in the suffix cell */
function splitCallsign(cs: string): [string, string] {
  const m = cs.match(/^(.*\d)([A-Z]+)$/)
  return m ? [m[1], m[2]] : ['', cs]
}

/** mm_dd_yyyy prefix + per-net-type name, per the club's file conventions */
function exportBaseName(netType: string, openedAt: Date | null): string {
  const d = openedAt || new Date()
  const date = `${String(d.getMonth() + 1).padStart(2, '0')}_${String(d.getDate()).padStart(2, '0')}_${d.getFullYear()}`
  if (netType === 'ares') return `${date} CheckinList`
  if (netType === 'skywarn') return `${date} SKYWARN Net`
  return `${date} SIREN TEST NET`
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function parseCallsignFromLog(content: string): string {
  const m = content.match(/^(?:MANUAL:\s*)?([A-Z0-9/]+)\s/)
  return m ? m[1] : ''
}

function deriveFromLogs(log: LogEntry[]) {
  const openEntry = log.find(e => e.entry_type === 'net_open')
  const closeEntry = [...log].reverse().find(e => e.entry_type === 'net_close')

  const openedAt = openEntry ? new Date(openEntry.timestamp) : null
  const closedAt = closeEntry ? new Date(closeEntry.timestamp) : null

  const checkinEntries = log.filter(e => e.entry_type === 'checkin' || e.entry_type === 'late_checkin')
  const callsignSet = new Set<string>()
  const checkedInCallsigns: string[] = []
  let baseCount = 0
  let mobileCount = 0

  for (const e of checkinEntries) {
    const cs = e.station?.callsign || parseCallsignFromLog(e.content)
    if (cs && !callsignSet.has(cs)) {
      callsignSet.add(cs)
      checkedInCallsigns.push(cs)
      if (e.content.includes('(base)')) baseCount++
      else if (e.content.includes('(mobile)')) mobileCount++
    }
  }

  const sortedCallsigns = [...checkedInCallsigns].sort((a, b) => getSuffix(a).localeCompare(getSuffix(b)))
  const reportCount = log.filter(e => e.entry_type === 'report').length

  const ncEntry = log.find(e => e.entry_type === 'net_open')
  const ncMatch = ncEntry?.content.match(/by\s+([A-Z0-9/]+)/)
  const netController = ncMatch ? ncMatch[1] : null

  const altNcEntry = log.find(e => e.entry_type === 'alt_nc')
  const altNc = altNcEntry ? altNcEntry.content.replace(/^Alternate net control:\s*/i, '').trim() : null

  const liaisonEntry = log.find(e => e.entry_type === 'liaison')
  const liaison = liaisonEntry ? liaisonEntry.content.replace(/^(?:NTS )?Liaison(?: station)?:\s*/i, '').trim() : null

  return {
    openedAt,
    closedAt,
    sortedCallsigns,
    totalStations: callsignSet.size,
    baseCount,
    mobileCount,
    reportCount,
    netController,
    altNc,
    liaison,
  }
}

export default function ReportPage() {
  const params = useParams()
  const router = useRouter()
  const netId = params.id as string
  const deletedRef = useRef(false)

  const [net, setNet] = useState<Net | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [testingDeleted, setTestingDeleted] = useState(false)

  const fetchAll = useCallback(async () => {
    const [netRes, logRes] = await Promise.all([
      fetch(`/api/nets/${netId}`),
      fetch(`/api/nets/${netId}/log`),
    ])
    const netData = await netRes.json()
    setNet(netData)
    setLog(await logRes.json())

    if (netData.testing && !deletedRef.current) {
      deletedRef.current = true
      await fetch(`/api/nets/${netId}`, { method: 'DELETE' })
      setTestingDeleted(true)
    }
  }, [netId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  if (!net) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading report...</div>
      </div>
    )
  }

  const derived = deriveFromLogs(log)
  const sirenReports = deriveSirenReports(log)
  const weatherReports = net.type === 'skywarn' ? deriveWeatherReports(log) : []
  const isAres = net.type === 'ares'
  const isSiren = net.type === 'siren'
  const isSkywarn = net.type === 'skywarn'

  const openedAt = derived.openedAt
  const closedAt = derived.closedAt
  const duration = openedAt && closedAt
    ? `${differenceInMinutes(closedAt, openedAt)} minutes`
    : 'Net still open'
  // Handoffs mid-net: opened-by from the net_open entry, final NC from the
  // net record. Shown as "opener → final" when they differ.
  const openerNc = derived.netController || net.net_controller
  const nc = openerNc.toUpperCase() !== net.net_controller.toUpperCase()
    ? `${openerNc} → ${net.net_controller}`
    : openerNc

  // Extra derivations for the exports: stations with names in suffix order,
  // the specific liaison roles, and per-type entry counts.
  const checkinStations = (() => {
    const seen = new Set<string>()
    const list: { callsign: string; first_name: string }[] = []
    for (const e of log) {
      if (e.entry_type !== 'checkin' && e.entry_type !== 'late_checkin') continue
      const meta = e.metadata as Record<string, unknown> | null
      const cs = e.station?.callsign || (typeof meta?.callsign === 'string' ? meta.callsign : parseCallsignFromLog(e.content))
      if (!cs || seen.has(cs)) continue
      seen.add(cs)
      const metaFirst = typeof meta?.first_name === 'string' ? meta.first_name : ''
      list.push({ callsign: cs, first_name: e.station?.first_name || metaFirst })
    }
    return list.sort((a, b) => getSuffix(a.callsign).localeCompare(getSuffix(b.callsign)))
  })()

  const liaisonValue = (prefix: string) => {
    const e = log.find(x => x.entry_type === 'liaison' && x.content.toUpperCase().startsWith(prefix.toUpperCase()))
    return e ? e.content.slice(prefix.length).trim() : ''
  }
  const ntsLiaison = liaisonValue('NTS Liaison:')
  const oesStation = liaisonValue('OES Station:')
  const questionCount = log.filter(e => e.content.includes('[Question]')).length
  const commentCount = log.filter(e => e.content.includes('[Comment]')).length
  const trafficHandled = log.filter(e => e.entry_type === 'traffic').length
  const announcementCount = log.filter(
    e => e.entry_type === 'announcement' && !e.content.includes('prepared weekly announcements')
  ).length
  const altNc = derived.altNc
  const liaison = derived.liaison

  function downloadCsv() {
    if (!net) return

    const summary = [
      'NET SUMMARY',
      `Net Type,${NET_LABELS[net.type] || net.type}`,
      `Net Controller,${nc}`,
      `Alt Net Control,${altNc || ''}`,
      `Liaison,${liaison || ''}`,
      `Opened,"${openedAt ? format(openedAt, 'yyyy-MM-dd HH:mm') : ''}"`,
      `Closed,"${closedAt ? format(closedAt, 'yyyy-MM-dd HH:mm') : 'Still open'}"`,
      `Duration,${duration}`,
      `Total Stations,${derived.totalStations}`,
      `Base Stations,${derived.baseCount}`,
      `Mobile Stations,${derived.mobileCount}`,
      `Reports,${derived.reportCount}`,
      '',
      'STATIONS',
      'Callsign',
      ...derived.sortedCallsigns,
      ...(sirenReports.length > 0
        ? [
            '',
            'SIREN REPORTS',
            'Siren,Sound,Rotation,Visual',
            ...sirenReports.map(r =>
              [r.siren, ...[r.sound, r.rotation, r.visual].map(v => (v === true ? 'Yes' : v === false ? 'No' : ''))].join(',')
            ),
          ]
        : []),
      ...(weatherReports.length > 0
        ? [
            '',
            'WEATHER REPORTS',
            'Time,Callsign,Type,Report',
            ...weatherReports.map(r =>
              [
                format(new Date(r.time), 'HH:mm:ss'),
                r.callsign,
                r.type,
                `"${r.content.replace(/"/g, '""')}"`,
              ].join(',')
            ),
          ]
        : []),
      '',
      'DETAILED LOG',
      'Timestamp,Type,Content',
      ...log.map(e => [
        format(new Date(e.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        LOG_TYPE_LABELS[e.entry_type] || e.entry_type.toUpperCase(),
        `"${e.content.replace(/"/g, '""')}"`,
      ].join(',')),
    ]

    const csv = summary.join('\n')
    saveBlob(new Blob([csv], { type: 'text/csv' }), `net-log-${netId.slice(0, 8)}.csv`)
  }

  // True PDF export (no print dialog), named by the club's file conventions.
  async function downloadPdf() {
    if (!net) return
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const left = 54
    const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

    let y = 60
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Net Summary Report', left, y)
    y += 20
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(NET_LABELS[net.type] || net.type, left, y)
    y += 15
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(`Generated ${format(new Date(), 'MMMM d, yyyy HH:mm')}`, left, y)
    doc.setTextColor(0)
    y += 8

    const summaryRows: string[][] = [
      ['Net Controller', nc],
      ...(altNc ? [['Alternate Net Control', altNc]] : []),
      ...(liaison ? [['Liaison', liaison]] : []),
      ['Net Opened', openedAt ? format(openedAt, 'MMMM d, yyyy HH:mm') : 'N/A'],
      ['Net Closed', closedAt ? format(closedAt, 'MMMM d, yyyy HH:mm') : 'Still open'],
      ['Duration', duration],
      ['Total Unique Stations', String(derived.totalStations)],
      ...(net.type !== 'ares' ? [['Base / Mobile', `${derived.baseCount} / ${derived.mobileCount}`]] : []),
      ...(net.type === 'ares' ? [['Traffic / Announcements', `${trafficHandled} / ${announcementCount}`]] : []),
      ...(net.type !== 'ares'
        ? [[net.type === 'siren' ? 'Siren Reports' : 'Weather Reports', String(derived.reportCount)]]
        : []),
    ]
    autoTable(doc, {
      startY: y,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 170 } },
      body: summaryRows,
      margin: { left },
    })
    y = lastY() + 18

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(`Stations Checked In (${derived.totalStations})`, left, y)
    y += 6
    const perCol = Math.ceil(derived.sortedCallsigns.length / 4) || 1
    const stationRows: string[][] = []
    for (let r = 0; r < perCol; r++) {
      stationRows.push([0, 1, 2, 3].map(c => derived.sortedCallsigns[c * perCol + r] || ''))
    }
    autoTable(doc, {
      startY: y,
      theme: 'plain',
      styles: { fontSize: 10, font: 'courier', cellPadding: 3 },
      body: stationRows,
      margin: { left },
    })
    y = lastY() + 18

    if (sirenReports.length > 0) {
      doc.setFontSize(11)
      doc.text(`Siren Reports (${sirenReports.length})`, left, y)
      y += 6
      autoTable(doc, {
        startY: y,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [240, 240, 240], textColor: 40 },
        head: [['Siren', 'Sound', 'Rotation', 'Visual Insp.']],
        body: sirenReports.map(r => [
          r.siren,
          ...[r.sound, r.rotation, r.visual].map(v => (v === true ? 'Yes' : v === false ? 'No' : '')),
        ]),
        margin: { left },
      })
      y = lastY() + 18
    }

    if (weatherReports.length > 0) {
      doc.setFontSize(11)
      doc.text(`Weather Reports (${weatherReports.length})`, left, y)
      y += 6
      autoTable(doc, {
        startY: y,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [240, 240, 240], textColor: 40 },
        head: [['Time', 'Callsign', 'Type', 'Report']],
        body: weatherReports.map(r => [format(new Date(r.time), 'HH:mm:ss'), r.callsign, r.type, r.content]),
        margin: { left },
      })
      y = lastY() + 18
    }

    doc.setFontSize(11)
    doc.text(`Detailed Log (${log.length} entries)`, left, y)
    y += 6
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [240, 240, 240], textColor: 40 },
      columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 90 } },
      head: [['Time', 'Type', 'Entry']],
      body: log.map(e => [
        format(new Date(e.timestamp), 'HH:mm:ss'),
        LOG_TYPE_LABELS[e.entry_type] || e.entry_type.toUpperCase(),
        e.content,
      ]),
      margin: { left },
    })

    doc.save(`${exportBaseName(net.type, openedAt)}.pdf`)
  }

  // ARES check-in list workbook, matching the club's weekly spreadsheet:
  // date, summary block, then the roster in two side-by-side blocks sorted
  // by suffix with the callsign split prefix/suffix.
  async function downloadXlsx() {
    if (!net) return
    const ExcelJS = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Sheet1')
    ws.columns = [
      { width: 5 }, { width: 8 }, { width: 8 }, { width: 18 },
      { width: 5 }, { width: 8 }, { width: 8 }, { width: 18 }, { width: 5 },
    ]

    const d = openedAt || new Date(net.created_at)
    const dateCell = ws.getCell('B1')
    dateCell.value = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
    dateCell.font = { bold: true }

    const put = (labelCell: string, text: string, valueCell: string, value: string | number) => {
      const l = ws.getCell(labelCell)
      l.value = text
      l.alignment = { horizontal: 'right' }
      ws.getCell(valueCell).value = value
    }
    put('C3', 'Net Control', 'D3', openerNc)
    put('C4', 'Alternate NC', 'D4', altNc || '')
    put('C5', 'Check-ins', 'D5', checkinStations.length)
    put('C6', 'Questions', 'D6', questionCount)
    put('C7', 'Scout Check-ins', 'D7', 0)
    put('G3', 'Announcements', 'H3', announcementCount)
    put('G4', 'Time', 'H4', duration)
    put('G5', 'Comments', 'H5', commentCount)
    put('G6', 'Traffic Handled', 'H6', trafficHandled)
    put('G7', 'NTS Liaison', 'H7', ntsLiaison || '')
    put('G8', 'OES Check-in', 'H8', oesStation || 'none')

    const startRow = 10
    const half = Math.ceil(checkinStations.length / 2)
    checkinStations.forEach((s, i) => {
      const [prefix, suffix] = splitCallsign(s.callsign)
      const row = startRow + (i % half)
      const colOffset = i < half ? 0 : 4 // A..D left block, E..H right block
      ws.getCell(row, 1 + colOffset).value = i + 1
      const pre = ws.getCell(row, 2 + colOffset)
      pre.value = prefix
      pre.alignment = { horizontal: 'right' }
      ws.getCell(row, 3 + colOffset).value = suffix
      ws.getCell(row, 4 + colOffset).value = s.first_name
    })

    const buf = await wb.xlsx.writeBuffer()
    saveBlob(
      new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${exportBaseName(net.type, openedAt)}.xlsx`
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <div className="bg-gray-900 px-4 py-3 flex items-center justify-end gap-3 print:hidden">
        {net.type === 'ares' && (
          <Button
            size="sm"
            onClick={downloadXlsx}
            className="bg-green-700 hover:bg-green-600 gap-1"
          >
            <Download className="w-4 h-4" />
            Check-in List (.xlsx)
          </Button>
        )}
        <Button
          size="sm"
          onClick={downloadCsv}
          className="bg-gray-700 hover:bg-gray-600 gap-1"
        >
          <Download className="w-4 h-4" />
          Download CSV
        </Button>
        <Button
          size="sm"
          onClick={downloadPdf}
          className="bg-blue-700 hover:bg-blue-600 gap-1"
        >
          <Download className="w-4 h-4" />
          Export PDF
        </Button>
        <Button
          size="sm"
          onClick={() => window.print()}
          className="bg-gray-700 hover:bg-gray-600 gap-1"
        >
          <Printer className="w-4 h-4" />
          Print
        </Button>
      </div>

      {testingDeleted && (
        <div className="bg-yellow-900 border-b border-yellow-700 px-4 py-2 text-yellow-200 text-sm text-center print:hidden">
          TESTING net data has been automatically deleted. This report is for review only.
        </div>
      )}

      <div className="max-w-3xl mx-auto p-6 print:p-0 print:max-w-none">
        <div className="bg-white rounded-xl shadow-sm print:shadow-none p-8">
          <div className="border-b-2 border-gray-900 pb-4 mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Net Summary Report</h1>
            <h2 className="text-lg text-gray-700 mt-1">{NET_LABELS[net.type]}</h2>
            <p className="text-gray-500 text-sm mt-1">
              Generated: {format(new Date(), 'MMMM d, yyyy HH:mm')}
            </p>
          </div>

          <div className="mb-8">
            <h3 className="font-semibold text-gray-800 mb-3 uppercase tracking-wide text-xs">
              Net Summary
            </h3>
            <div className="divide-y divide-gray-100">
              <Field label="Net Type" value={NET_LABELS[net.type]} />
              <Field label="Net Controller" value={nc} />
              {(isAres || altNc) && <Field label="Alternate Net Control" value={altNc} />}
              {(isAres || isSkywarn || liaison) && <Field label="Liaison" value={liaison} />}
              <Field label="Net Opened" value={openedAt ? format(openedAt, 'MMMM d, yyyy HH:mm') : null} />
              <Field label="Net Closed" value={closedAt ? format(closedAt, 'MMMM d, yyyy HH:mm') : 'Still open'} />
              <Field label="Duration" value={duration} />
              <Field label="Total Unique Stations" value={derived.totalStations} />
              {!isAres && <Field label="Base Stations" value={derived.baseCount} />}
              {!isAres && <Field label="Mobile Stations" value={derived.mobileCount} />}
              {(isSkywarn || isSiren) && (
                <Field
                  label={isSiren ? 'Siren Reports' : 'Weather Reports'}
                  value={derived.reportCount}
                />
              )}
            </div>
          </div>

          <div className="mb-8">
            <h3 className="font-semibold text-gray-800 mb-3 uppercase tracking-wide text-xs">
              Stations Checked In ({derived.totalStations})
            </h3>
            {derived.sortedCallsigns.length === 0 ? (
              <p className="text-gray-500 text-sm">No stations logged.</p>
            ) : (() => {
              const list = derived.sortedCallsigns
              const colSize = Math.ceil(list.length / 4)
              const cols = [
                list.slice(0, colSize),
                list.slice(colSize, colSize * 2),
                list.slice(colSize * 2, colSize * 3),
                list.slice(colSize * 3),
              ]
              return (
                <div className="grid grid-cols-4 gap-4 text-sm">
                  {cols.map((col, ci) => (
                    <div key={ci} className="space-y-0">
                      {col.map(cs => (
                        <div key={cs} className="py-0.5 font-mono text-gray-900">{cs}</div>
                      ))}
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          {sirenReports.length > 0 && (
            <div className="mb-8">
              <h3 className="font-semibold text-gray-800 mb-3 uppercase tracking-wide text-xs">
                Siren Reports ({sirenReports.length})
              </h3>
              <table className="w-full max-w-md text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="py-2 px-3 font-semibold text-gray-600 border border-gray-200">Siren</th>
                    <th className="py-2 px-3 font-semibold text-gray-600 border border-gray-200 w-20 text-center">Sound</th>
                    <th className="py-2 px-3 font-semibold text-gray-600 border border-gray-200 w-20 text-center">Rotation</th>
                    <th className="py-2 px-3 font-semibold text-gray-600 border border-gray-200 w-28 text-center">Visual Insp.</th>
                  </tr>
                </thead>
                <tbody>
                  {sirenReports.map(r => (
                    <tr key={r.siren} className="border-b border-gray-50">
                      <td className="py-1.5 px-3 border border-gray-200 font-mono text-gray-900">{r.siren}</td>
                      <td className="py-1.5 px-3 border border-gray-200 text-center"><YesNo value={r.sound} /></td>
                      <td className="py-1.5 px-3 border border-gray-200 text-center"><YesNo value={r.rotation} /></td>
                      <td className="py-1.5 px-3 border border-gray-200 text-center"><YesNo value={r.visual} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {weatherReports.length > 0 && (
            <div className="mb-8">
              <h3 className="font-semibold text-gray-800 mb-3 uppercase tracking-wide text-xs">
                Weather Reports ({weatherReports.length})
              </h3>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="py-2 px-3 font-semibold text-gray-600 border border-gray-200 w-20">Time</th>
                    <th className="py-2 px-3 font-semibold text-gray-600 border border-gray-200 w-28">Callsign</th>
                    <th className="py-2 px-3 font-semibold text-gray-600 border border-gray-200 w-32">Type</th>
                    <th className="py-2 px-3 font-semibold text-gray-600 border border-gray-200">Report</th>
                  </tr>
                </thead>
                <tbody>
                  {weatherReports.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-1.5 px-3 border border-gray-200 font-mono text-gray-500">
                        {format(new Date(r.time), 'HH:mm:ss')}
                      </td>
                      <td className="py-1.5 px-3 border border-gray-200 font-mono text-gray-900">{r.callsign || <NA />}</td>
                      <td className="py-1.5 px-3 border border-gray-200 text-gray-700">{r.type || <span className="text-gray-400">&mdash;</span>}</td>
                      <td className="py-1.5 px-3 border border-gray-200 text-gray-800">{r.content}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <h3 className="font-semibold text-gray-800 mb-3 uppercase tracking-wide text-xs">
              Detailed Log ({log.length} entries)
            </h3>
            {log.length === 0 ? (
              <p className="text-gray-500 text-sm">No log entries.</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="py-2 px-3 font-semibold text-gray-600 border border-gray-200 w-20">Time</th>
                    <th className="py-2 px-3 font-semibold text-gray-600 border border-gray-200 w-28">Type</th>
                    <th className="py-2 px-3 font-semibold text-gray-600 border border-gray-200">Entry</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map(entry => (
                    <tr key={entry.id} className="border-b border-gray-50">
                      <td className="py-1.5 px-3 border border-gray-200 font-mono text-gray-500">
                        {format(new Date(entry.timestamp), 'HH:mm:ss')}
                      </td>
                      <td className="py-1.5 px-3 border border-gray-200 text-xs font-semibold text-gray-600">
                        {LOG_TYPE_LABELS[entry.entry_type] || entry.entry_type.toUpperCase()}
                      </td>
                      <td className="py-1.5 px-3 border border-gray-200 text-gray-800">
                        {entry.content}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 text-center">
            Marion County ARES Net Logger &mdash; mcinares.org
          </div>
        </div>
      </div>
    </div>
  )
}
