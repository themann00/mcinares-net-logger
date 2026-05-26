'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { format, differenceInMinutes } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Printer, Download, Home } from 'lucide-react'
import Link from 'next/link'
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
  late_checkin: 'LATE CHECK-IN',
  net_close: 'NET CLOSE',
  note: 'NOTE',
}

export default function ReportPage() {
  const params = useParams()
  const netId = params.id as string

  const [net, setNet] = useState<Net | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [log, setLog] = useState<LogEntry[]>([])

  const fetchAll = useCallback(async () => {
    const [netRes, stationsRes, logRes] = await Promise.all([
      fetch(`/api/nets/${netId}`),
      fetch(`/api/nets/${netId}/stations`),
      fetch(`/api/nets/${netId}/log`),
    ])
    setNet(await netRes.json())
    setStations(await stationsRes.json())
    setLog(await logRes.json())
  }, [netId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  function downloadCsv() {
    if (!net) return
    const headers = ['Timestamp', 'Type', 'Callsign', 'Content']
    const rows = log.map(e => {
      const station = stations.find(s => s.id === e.station_id)
      return [
        format(new Date(e.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        LOG_TYPE_LABELS[e.entry_type] || e.entry_type.toUpperCase(),
        station?.callsign || '',
        `"${e.content.replace(/"/g, '""')}"`,
      ].join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `net-log-${netId.slice(0, 8)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!net) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading report...</div>
      </div>
    )
  }

  const startedAt = new Date(net.started_at)
  const closedAt = net.closed_at ? new Date(net.closed_at) : null
  const duration = closedAt
    ? `${differenceInMinutes(closedAt, startedAt)} minutes`
    : 'Net still open'

  const baseStations = stations.filter(s => s.station_type === 'base').length
  const mobileStations = stations.filter(s => s.station_type === 'mobile').length
  const reportCount = log.filter(e => e.entry_type === 'report').length
  const isAres = net.type === 'ares'
  const isSiren = net.type === 'siren'
  const isSkywarn = net.type === 'skywarn'

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Print toolbar — hidden when printing */}
      <div className="bg-gray-900 px-4 py-3 flex items-center justify-end gap-3 print:hidden">
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
          onClick={() => window.print()}
          className="bg-blue-700 hover:bg-blue-600 gap-1"
        >
          <Printer className="w-4 h-4" />
          Print / Save PDF
        </Button>
        <Link href="/">
          <Button size="sm" variant="outline" className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white gap-1">
            <Home className="w-4 h-4" />
            Home
          </Button>
        </Link>
      </div>

      {/* Report content */}
      <div className="max-w-3xl mx-auto p-6 print:p-0 print:max-w-none">
        <div className="bg-white rounded-xl shadow-sm print:shadow-none p-8">
          {/* Header */}
          <div className="border-b-2 border-gray-900 pb-4 mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Net Summary Report</h1>
            <h2 className="text-lg text-gray-700 mt-1">{NET_LABELS[net.type]}</h2>
            <p className="text-gray-500 text-sm mt-1">
              Generated: {format(new Date(), 'MMMM d, yyyy HH:mm')}
            </p>
          </div>

          {/* Summary */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-800 mb-3 uppercase tracking-wide text-xs">
              Net Summary
            </h3>
            <div className="divide-y divide-gray-100">
              <Field label="Net Type" value={NET_LABELS[net.type]} />
              <Field label="Net Controller" value={net.net_controller} />
              <Field
                label="Alternate Net Control"
                value={isAres ? net.alt_net_controller : undefined}
              />
              <Field
                label="Liaison"
                value={isAres || isSkywarn ? net.liaison : undefined}
              />
              {isSkywarn && (
                <Field
                  label="Weather Status"
                  value={
                    net.weather_status
                      ? net.weather_status.charAt(0).toUpperCase() + net.weather_status.slice(1)
                      : null
                  }
                />
              )}
              <Field label="Net Opened" value={format(startedAt, 'MMMM d, yyyy HH:mm')} />
              <Field
                label="Net Closed"
                value={closedAt ? format(closedAt, 'MMMM d, yyyy HH:mm') : 'Still open'}
              />
              <Field label="Duration" value={duration} />
              <Field label="Total Unique Stations" value={stations.length} />
              <Field label="Base Stations" value={isAres ? undefined : baseStations} />
              <Field label="Mobile Stations" value={isAres ? undefined : mobileStations} />
              {(isSkywarn || isSiren) && (
                <Field
                  label={isSiren ? 'Siren Reports' : 'Weather Reports'}
                  value={reportCount}
                />
              )}
            </div>
          </div>

          {/* Station list */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-800 mb-3 uppercase tracking-wide text-xs">
              Stations Checked In ({stations.length})
            </h3>
            {stations.length === 0 ? (
              <p className="text-gray-500 text-sm">No stations logged.</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="py-2 px-3 font-semibold text-gray-600 border border-gray-200">#</th>
                    <th className="py-2 px-3 font-semibold text-gray-600 border border-gray-200">Callsign</th>
                    <th className="py-2 px-3 font-semibold text-gray-600 border border-gray-200">Name</th>
                    {!isAres && (
                      <th className="py-2 px-3 font-semibold text-gray-600 border border-gray-200">Type</th>
                    )}
                    {(isSkywarn || isSiren) && (
                      <th className="py-2 px-3 font-semibold text-gray-600 border border-gray-200">Location</th>
                    )}
                    {isSkywarn && (
                      <th className="py-2 px-3 font-semibold text-gray-600 border border-gray-200">Quadrant</th>
                    )}
                    <th className="py-2 px-3 font-semibold text-gray-600 border border-gray-200">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {stations.map((station, i) => (
                    <tr key={station.id} className="border-b border-gray-100">
                      <td className="py-1.5 px-3 border border-gray-200 text-gray-500">{i + 1}</td>
                      <td className="py-1.5 px-3 border border-gray-200 font-mono font-semibold">{station.callsign}</td>
                      <td className="py-1.5 px-3 border border-gray-200 text-gray-700">
                        {[station.first_name, station.last_name].filter(Boolean).join(' ') || '—'}
                      </td>
                      {!isAres && (
                        <td className="py-1.5 px-3 border border-gray-200">
                          {station.station_type
                            ? station.station_type.charAt(0).toUpperCase() + station.station_type.slice(1)
                            : '—'}
                        </td>
                      )}
                      {(isSkywarn || isSiren) && (
                        <td className="py-1.5 px-3 border border-gray-200 text-gray-700">
                          {station.location || '—'}
                        </td>
                      )}
                      {isSkywarn && (
                        <td className="py-1.5 px-3 border border-gray-200">{station.quadrant || '—'}</td>
                      )}
                      <td className="py-1.5 px-3 border border-gray-200 text-gray-500 font-mono">
                        {format(new Date(station.checked_in_at), 'HH:mm')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Detailed log */}
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
