import { useState } from 'react'
import { getWeeklyInvoice } from './driverApi'
import { fetchOrders } from './supabase.js'

// Local calendar dates (toISOString would switch to UTC and shift the day in the evening)
const localIso = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
function mondayOf(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  date.setDate(date.getDate() + diff)
  return localIso(date)
}
function addDays(d, n) {
  const [y, m, day] = String(d).split('-').map(Number)
  return localIso(new Date(y, m - 1, day + n))
}

// Every date from start to end (YYYY-MM-DD), using local dates
function datesBetween(start, end) {
  const out = []
  const [y1, m1, d1] = start.split('-').map(Number)
  const [y2, m2, d2] = end.split('-').map(Number)
  const cur = new Date(y1, m1 - 1, d1)
  const last = new Date(y2, m2 - 1, d2)
  while (cur <= last && out.length < 93) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`)
    cur.setDate(cur.getDate() + 1)
  }
  return out
}
const prettyDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
// Highlight when the delivered amount differs from what was ordered
const diffStyle = (r) => ((r.delivered_pieces ?? r.total_pieces) !== r.total_pieces ? { color: '#B3261E', fontWeight: 700 } : {})

const piecesOf = (o) =>
  (o.bag5white || 0) * 5 + (o.bag5brown || 0) * 5 + (o.bag10white || 0) * 10 +
  (o.bag10brown || 0) * 10 + (o.bag20white || 0) * 20 + (o.bag20brown || 0) * 20

// pin = the baker PIN already verified in your existing dashboard —
// pass it in as a prop so the driver doesn't need to re-enter it.
export default function WeeklyInvoice({ pin, onBack }) {
  const thisMonday = mondayOf(new Date())
  const [start, setStart] = useState(thisMonday)
  const [end, setEnd] = useState(addDays(thisMonday, 6))
  const [rate, setRate] = useState('')
  const [mode, setMode] = useState('weekly') // 'weekly' or 'daily'
  const [rows, setRows] = useState([])
  const [days, setDays] = useState([]) // daily detail: [{ date, rows: [...] }]
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      if (mode === 'weekly') {
        setRows(await getWeeklyInvoice(pin, start, end))
      } else {
        const dates = datesBetween(start, end)
        if (dates.length === 0) throw new Error('range')
        const perDay = await Promise.all(dates.map((d) => fetchOrders(pin, d)))
        setDays(
          dates
            .map((date, i) => ({
              date,
              rows: perDay[i]
                .map((o) => {
                  const total = piecesOf(o)
                  const delivered = o.delivered_qty ?? total
                  const returned = o.returned_qty || 0
                  return { id: o.id, customer: o.customer, phone: o.phone, total_pieces: total, delivered_pieces: delivered, returned_pieces: returned, net_pieces: delivered - returned }
                })
                .sort((a, b) => a.customer.localeCompare(b.customer))
            }))
            .filter((d) => d.rows.length > 0)
        )
      }
    } catch {
      setError(mode === 'daily' ? 'Could not load daily detail. Check the dates and try again.' : 'Could not load invoice')
    } finally {
      setLoading(false)
    }
  }

  const csvCell = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const amountOf = (net) => (rate ? (net * Number(rate)).toFixed(2) : '')

  function exportCsv() {
    let csv
    let name
    if (mode === 'weekly') {
      csv = 'Customer,Phone,Ordered,Delivered,Returned,Net,Amount\n' + rows
        .map((r) => [r.customer, r.phone || '', r.total_pieces, r.delivered_pieces ?? r.total_pieces, r.returned_pieces, r.net_pieces, amountOf(r.net_pieces)].map(csvCell).join(','))
        .join('\n')
      name = `invoice_${start}_to_${end}.csv`
    } else {
      csv = 'Date,Customer,Phone,Ordered,Delivered,Returned,Net,Amount\n' + days
        .flatMap((d) => d.rows.map((r) => [d.date, r.customer, r.phone || '', r.total_pieces, r.delivered_pieces, r.returned_pieces, r.net_pieces, amountOf(r.net_pieces)].map(csvCell).join(',')))
        .join('\n')
      name = `daily_detail_${start}_to_${end}.csv`
    }
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
  }

  const grandNet = rows.reduce((s, r) => s + r.net_pieces, 0)
  const grandAmount = rate ? grandNet * Number(rate) : null
  const sum = (list, k) => list.reduce((s, r) => s + r[k], 0)
  const allDaily = days.flatMap((d) => d.rows)
  const hasData = mode === 'weekly' ? rows.length > 0 : days.length > 0

  const switchMode = (m) => { setMode(m); setError('') }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontFamily: 'Georgia, serif', color: '#8A6A52', margin: 0 }}>{mode === 'weekly' ? 'Weekly Invoice' : 'Daily Detail'}</h2>
        {onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#8A6A52', textDecoration: 'underline', cursor: 'pointer' }}>
            ← Back
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <button onClick={() => switchMode('weekly')} style={mode === 'weekly' ? btnPrimary : btnOutline}>Weekly summary</button>
        <button onClick={() => switchMode('daily')} style={mode === 'daily' ? btnPrimary : btnOutline}>Daily detail</button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', margin: '12px 0' }}>
        <label style={lbl}>Start<input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={fld} /></label>
        <label style={lbl}>End<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={fld} /></label>
        <label style={lbl}>$ per piece<input type="number" step="0.01" placeholder="optional" value={rate} onChange={(e) => setRate(e.target.value)} style={{ ...fld, width: 90 }} /></label>
        <button onClick={load} style={btnPrimary}>{loading ? 'Loading…' : 'Run'}</button>
        {hasData && <button onClick={exportCsv} style={btnOutline}>Export CSV</button>}
      </div>

      {error && <p style={{ color: '#B3261E' }}>{error}</p>}

      {mode === 'weekly' && rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
          <thead>
            <tr style={{ background: '#F5EBDD', textAlign: 'left' }}>
              <th style={th}>Customer</th>
              <th style={th}>Ordered</th>
              <th style={th}>Delivered</th>
              <th style={th}>Returned</th>
              <th style={th}>Net</th>
              {rate && <th style={th}>Amount</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.customer + (r.phone || '')}>
                <td style={td}>{r.customer}</td>
                <td style={td}>{r.total_pieces}</td>
                <td style={{ ...td, ...diffStyle(r) }}>{r.delivered_pieces ?? r.total_pieces}</td>
                <td style={td}>{r.returned_pieces}</td>
                <td style={{ ...td, fontWeight: 700 }}>{r.net_pieces}</td>
                {rate && <td style={td}>${(r.net_pieces * Number(rate)).toFixed(2)}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, borderTop: '2px solid #E3D5C0' }}>
              <td style={td}>Total</td>
              <td style={td}>{sum(rows, 'total_pieces')}</td>
              <td style={td}>{rows.reduce((t, r) => t + (r.delivered_pieces ?? r.total_pieces), 0)}</td>
              <td style={td}>{sum(rows, 'returned_pieces')}</td>
              <td style={td}>{grandNet}</td>
              {rate && <td style={td}>${grandAmount.toFixed(2)}</td>}
            </tr>
          </tfoot>
        </table>
        </div>
      )}

      {mode === 'daily' && !loading && days.length === 0 && !error && (
        <p style={{ color: '#8A6A52' }}>Pick a date range and press Run to see each day's orders.</p>
      )}

      {mode === 'daily' && days.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
          <thead>
            <tr style={{ background: '#F5EBDD', textAlign: 'left' }}>
              <th style={th}>Customer</th>
              <th style={th}>Ordered</th>
              <th style={th}>Delivered</th>
              <th style={th}>Returned</th>
              <th style={th}>Net</th>
              {rate && <th style={th}>Amount</th>}
            </tr>
          </thead>
          {days.map((d) => (
            <tbody key={d.date}>
              <tr style={{ background: '#FBF5EC' }}>
                <td colSpan={rate ? 6 : 5} style={{ ...td, fontWeight: 700, color: '#8A6A52' }}>{prettyDay(d.date)} · {d.rows.length} order{d.rows.length > 1 ? 's' : ''}</td>
              </tr>
              {d.rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...td, paddingLeft: 16 }}>{r.customer}</td>
                  <td style={td}>{r.total_pieces}</td>
                  <td style={{ ...td, ...diffStyle(r) }}>{r.delivered_pieces}</td>
                  <td style={td}>{r.returned_pieces}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{r.net_pieces}</td>
                  {rate && <td style={td}>${amountOf(r.net_pieces)}</td>}
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}>
                <td style={{ ...td, paddingLeft: 16, color: '#8A6A52' }}>Day total</td>
                <td style={td}>{sum(d.rows, 'total_pieces')}</td>
                <td style={td}>{sum(d.rows, 'delivered_pieces')}</td>
                <td style={td}>{sum(d.rows, 'returned_pieces')}</td>
                <td style={td}>{sum(d.rows, 'net_pieces')}</td>
                {rate && <td style={td}>${amountOf(sum(d.rows, 'net_pieces'))}</td>}
              </tr>
            </tbody>
          ))}
          <tfoot>
            <tr style={{ fontWeight: 800, borderTop: '2px solid #E3D5C0' }}>
              <td style={td}>Total ({days.length} day{days.length > 1 ? 's' : ''})</td>
              <td style={td}>{sum(allDaily, 'total_pieces')}</td>
              <td style={td}>{sum(allDaily, 'delivered_pieces')}</td>
              <td style={td}>{sum(allDaily, 'returned_pieces')}</td>
              <td style={td}>{sum(allDaily, 'net_pieces')}</td>
              {rate && <td style={td}>${amountOf(sum(allDaily, 'net_pieces'))}</td>}
            </tr>
          </tfoot>
        </table>
        </div>
      )}
    </div>
  )
}

const lbl = { fontSize: 12.5, color: '#8A6A52', fontWeight: 700, display: 'flex', flexDirection: 'column', gap: 4 }
const fld = { padding: '6px 8px', border: '1.5px solid #E3D5C0', borderRadius: 6, fontSize: 14 }
const btnPrimary = { background: '#8A6A52', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }
const btnOutline = { background: '#fff', color: '#8A6A52', border: '1.5px solid #8A6A52', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }
const th = { padding: 8, borderBottom: '2px solid #E3D5C0' }
const td = { padding: 8, borderBottom: '1px solid #F0E6D6' }
