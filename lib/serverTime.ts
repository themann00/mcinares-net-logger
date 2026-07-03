import type { NextRequest } from 'next/server'

/**
 * "Now" for a request, honoring the TIME SET offset header the client sends
 * while a super admin has an adjusted clock active. Falls back to real time.
 */
export function requestNow(req: NextRequest): Date {
  const raw = req.headers.get('x-time-offset-ms')
  const offset = raw ? parseInt(raw, 10) : 0
  return new Date(Date.now() + (Number.isFinite(offset) ? offset : 0))
}
