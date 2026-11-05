import { useState, useEffect } from 'react'
import { verifyDriverPin, getOrdersForDelivery, markDelivered } from './driverApi'

const todayStr = () => new Date().toISOString().slice(0, 10)

function pieceCount(o) {
  return (o.bag5white || 0) * 5 + (o.bag5brown || 0) * 5
       + (o.bag10white || 0) * 10 + (o.bag10brown || 0) * 10
       + (o.bag20white || 0) * 20 + (o.bag20brown || 0) * 20
}

export default function DriverView({ onBack }) {
  const [pin, setPin] = useState('')
  const [driver, setDriver] = useState(null)
  const [error, setError] = useState('')
  const [date, setDate] = useState(todayStr())
  const [orders, setOrders] = useState([])
  const [returns, setReturns] = useState({}) // { [orderId]: { qty, note, delivered } }
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(null)

  async function signIn(e) {
    e.preventDefault()
    setError('')
    try {
      const d = await verifyDriverPin(pin)
      if (!d) { setError('PIN not recognized'); return }
      setDriver(d)
    } catch {
      setError('Could not sign in — try again')
    }
  }

  async function loadOrders(d) {
    setLoading(true)
    setError('')
    try {
      const rows = await getOrdersForDelivery(pin, d)
      setOrders(rows)
    } catch {
      setError('Could not load orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (driver) loadOrders(date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, date])

  function currentEntry(o) {
    return returns[o.id] || {
      qty: o.returned_qty || '',
      note: o.return_note || '',
      delivered: o.delivered_qty ?? ''
    }
  }

  function setReturn(o, field, value) {
    setReturns((prev) => ({ ...prev, [o.id]: { ...currentEntry(o), ...prev[o.id], [field]: value } }))
  }

  async function handleDeliver(order) {
    const r = currentEntry(order)
    const ordered = pieceCount(order)
    let deliveredQty = null
    if (r.delivered !== '' && r.delivered !== null && r.delivered !== undefined) {
      const n = Number(r.delivered)
      if (!Number.isInteger(n) || n < 0) { setError('Delivered pieces must be a whole number, 0 or more'); return }
      if (n > ordered && !window.confirm(`Delivered ${n} is more than the ${ordered} ordered. Save anyway?`)) return
      deliveredQty = n === ordered ? null : n
    }
    setSaving(order.id)
    setError('')
    try {
      await markDelivered(pin, order.id, Number(r.qty) || 0, r.note || '', deliveredQty)
      setReturns((prev) => { const next = { ...prev }; delete next[order.id]; return next })
      await loadOrders(date)
    } catch {
      setError('Could not save — try again')
    } finally {
      setSaving(null)
    }
  }

  if (!driver) {
    return (
      <div style={page}>
        <div style={card}>
          <h2 style={h2}>Driver Sign-in</h2>
          <form onSubmit={signIn}>
            <input
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              style={input}
              autoFocus
            />
            <button type="submit" style={btnPrimary}>Sign in</button>
          </form>
          {error && <p style={errText}>{error}</p>}
          {onBack && <button onClick={onBack} style={btnLink}>← Back</button>}
        </div>
      </div>
    )
  }

  return (
    <div style={page}>
      <div style={{ ...card, maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={h2}>Deliveries — {driver.name}</h2>
          <button onClick={() => { setDriver(null); setPin('') }} style={btnLink}>Sign out</button>
        </div>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ ...input, maxWidth: 180 }}
        />

        {loading && <p style={{ color: '#8A6A52' }}>Loading…</p>}
        {!loading && orders.length === 0 && (
          <p style={{ color: '#8A6A52' }}>No orders for this date.</p>
        )}

        {orders.map((o) => {
          const delivered = o.delivery_status === 'delivered'
          const r = currentEntry(o)
          const ordered = pieceCount(o)
          const changed = o.delivered_qty != null && o.delivered_qty !== ordered
          return (
            <div key={o.id} style={{ ...row, borderColor: delivered ? '#3F7D4F' : '#C9A227' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{o.customer}</strong>
                <span style={{ color: delivered ? '#3F7D4F' : '#C9A227', fontWeight: 700, fontSize: 13 }}>
                  {delivered
                    ? `Delivered ${new Date(o.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Pending'}
                </span>
              </div>
              {o.phone && <div style={{ color: '#8A6A52', fontSize: 13 }}>{o.phone}</div>}
              <div style={{ fontSize: 14, margin: '4px 0' }}>
                {ordered} pieces ordered
                {changed && <span style={{ color: '#B3261E', fontWeight: 700 }}> · {o.delivered_qty} delivered</span>}
              </div>

              <label style={label}>Delivered (pieces)</label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder={`${ordered} (full order)`}
                value={r.delivered}
                onChange={(e) => setReturn(o, 'delivered', e.target.value)}
                style={{ ...input, maxWidth: 160 }}
              />
              <div style={{ fontSize: 12, color: '#8A6A52', margin: '-6px 0 10px' }}>Leave empty if the customer took the full order.</div>

              <label style={label}>Returned from last order (pieces)</label>
              <input
                type="number"
                min="0"
                value={r.qty}
                onChange={(e) => setReturn(o, 'qty', e.target.value)}
                style={{ ...input, maxWidth: 90 }}
              />
              <input
                type="text"
                placeholder="Note (optional)"
                value={r.note}
                onChange={(e) => setReturn(o, 'note', e.target.value)}
                style={input}
              />

              <button
                onClick={() => handleDeliver(o)}
                disabled={saving === o.id}
                style={delivered ? btnSecondary : btnPrimary}
              >
                {saving === o.id ? 'Saving…' : delivered ? 'Update' : 'Mark Delivered'}
              </button>
            </div>
          )
        })}
        {error && <p style={errText}>{error}</p>}
      </div>
    </div>
  )
}

const page = { minHeight: '100vh', background: '#FFFBF4', padding: 20, fontFamily: 'system-ui, sans-serif' }
const card = { background: '#fff', borderRadius: 14, padding: 20, margin: '0 auto', maxWidth: 420 }
const h2 = { fontFamily: 'Georgia, serif', color: '#8A6A52', margin: '0 0 12px', fontSize: 20 }
const input = { display: 'block', width: '100%', padding: '10px 12px', margin: '6px 0 10px', border: '1.5px solid #E3D5C0', borderRadius: 8, fontSize: 15, boxSizing: 'border-box' }
const label = { fontSize: 12, color: '#8A6A52', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }
const btnPrimary = { background: '#8A6A52', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: 'pointer', width: '100%' }
const btnSecondary = { ...btnPrimary, background: '#C9A227' }
const btnLink = { background: 'none', border: 'none', color: '#8A6A52', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: 14 }
const errText = { color: '#B3261E', fontSize: 13 }
const row = { border: '1.5px solid', borderRadius: 10, padding: 12, marginBottom: 12 }
