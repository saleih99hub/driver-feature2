import { useState } from 'react'
import { getWeeklyInvoice } from './driverApi'

function mondayOf(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  date.setDate(date.getDate() + diff)
  return date.toISOString().slice(0, 10)
}
function addDays(d, n) {
  const date = new Date(d)
  date.setDate(date.getDate() + n)
  return date.toISOString().slice(0, 10)
}

// pin = the baker PIN already verified in your existing dashboard —
// pass it in as a prop so the driver doesn't need to re-enter it.
export default function WeeklyInvoice({ pin, onBack }) {
  const thisMonday = mondayOf(new Date())
  const [start, setStart] = useState(thisMonday)
  const [end, setEnd] = useState(addDays(thisMonday, 6))
  const [rate, setRate] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      setRows(await getWeeklyInvoice(pin, start, end))
    } catch {
      setError('Could not load invoice')
    } finally {
      setLoading(false)
    }
  }

  function exportCsv() {
    const header = 'Customer,Phone,Ordered,Returned,Net,Amount\n'
    const body = rows
      .map((r) => {
        const amt = rate ? (r.net_pieces * Number(rate)).toFixed(2) : ''
        return `${r.customer},${r.phone || ''},${r.total_pieces},${r.returned_pieces},${r.net_pieces},${amt}`
      })
      .join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `invoice_${start}_to_${end}.csv`
    a.click()
  }

  const grandNet = rows.reduce((s, r) => s + r.net_pieces, 0)
  const grandAmount = rate ? grandNet * Number(rate) : null

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontFamily: 'Georgia, serif', color: '#8A6A52', margin: 0 }}>Weekly Invoice</h2>
        {onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#8A6A52', textDecoration: 'underline', cursor: 'pointer' }}>
            ← Back
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', margin: '12px 0' }}>
        <label style={lbl}>Start<input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={fld} /></label>
        <label style={lbl}>End<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={fld} /></label>
        <label style={lbl}>$ per piece<input type="number" step="0.01" placeholder="optional" value={rate} onChange={(e) => setRate(e.target.value)} style={{ ...fld, width: 90 }} /></label>
        <button onClick={load} style={btnPrimary}>{loading ? 'Loading…' : 'Run'}</button>
        {rows.length > 0 && <button onClick={exportCsv} style={btnOutline}>Export CSV</button>}
      </div>

      {error && <p style={{ color: '#B3261E' }}>{error}</p>}

      {rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F5EBDD', textAlign: 'left' }}>
              <th style={th}>Customer</th>
              <th style={th}>Ordered</th>
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
                <td style={td}>{r.returned_pieces}</td>
                <td style={{ ...td, fontWeight: 700 }}>{r.net_pieces}</td>
                {rate && <td style={td}>${(r.net_pieces * Number(rate)).toFixed(2)}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, borderTop: '2px solid #E3D5C0' }}>
              <td style={td}>Total</td>
              <td style={td} />
              <td style={td} />
              <td style={td}>{grandNet}</td>
              {rate && <td style={td}>${grandAmount.toFixed(2)}</td>}
            </tr>
          </tfoot>
        </table>
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
