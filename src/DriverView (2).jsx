import { useState, useEffect } from 'react'
import { verifyDriverPin, getRouteSheet, markDelivered } from './driverApi'

// Arif palette
const C = {
  cream: '#FDF4E7', card: '#FFFBF4', red: '#A8321C', redDark: '#7E2413',
  amber: '#E8862E', amberSoft: '#F8E3C8', brown: '#3B2316', brownSoft: '#8A6A52',
  green: '#2F6B3F', greenSoft: '#E3EFE5', line: '#EAD9C2', grey: '#9A8C80'
}

// Local date (toISOString would switch to UTC and show tomorrow in the evening)
const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const prettyDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// Bag types in the order they appear on the printed sheet
const TYPES = [
  { key: 'bag5white', size: 5, color: 'White', short: '5W' },
  { key: 'bag5brown', size: 5, color: 'Brown', short: '5B' },
  { key: 'bag10white', size: 10, color: 'White', short: '10W' },
  { key: 'bag10brown', size: 10, color: 'Brown', short: '10B' },
  { key: 'bag20white', size: 20, color: 'White', short: '20W' },
  { key: 'bag20brown', size: 20, color: 'Brown', short: '20B' }
]
const pieceCount = (o) => TYPES.reduce((t, b) => t + (o[b.key] || 0) * b.size, 0)
const bagCount = (o) => TYPES.reduce((t, b) => t + (o[b.key] || 0), 0)

// Rows come back one per order, plus one per store with no order. Group them into stops.
function toStops(rows) {
  const stops = []
  const byId = {}
  for (const r of rows) {
    if (!byId[r.customer_id]) {
      byId[r.customer_id] = { id: r.customer_id, name: r.customer, phone: r.phone, region: r.region, orders: [] }
      stops.push(byId[r.customer_id])
    }
    if (r.order_id) byId[r.customer_id].orders.push({ ...r, id: r.order_id })
  }
  return stops
}

export default function DriverView({ onBack }) {
  const [pin, setPin] = useState('')
  const [driver, setDriver] = useState(null)
  const [error, setError] = useState('')
  const [date, setDate] = useState(localToday())
  const [stops, setStops] = useState([])
  const [edits, setEdits] = useState({}) // { [orderId]: { qty, note, delivered } }
  const [open, setOpen] = useState({}) // which orders have "Changes or returns" open
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
      setError('Could not sign in. Try again.')
    }
  }

  async function loadRoute(d) {
    setLoading(true)
    setError('')
    try {
      setStops(toStops(await getRouteSheet(pin, d)))
    } catch {
      setError('Could not load the route. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (driver) loadRoute(date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, date])

  function entryFor(o) {
    return edits[o.id] || { qty: o.returned_qty || '', note: o.return_note || '', delivered: o.delivered_qty ?? '' }
  }
  function setEntry(o, field, value) {
    setEdits((prev) => ({ ...prev, [o.id]: { ...entryFor(o), [field]: value } }))
  }

  async function handleDeliver(o) {
    const r = entryFor(o)
    const ordered = pieceCount(o)
    let deliveredQty = null
    if (r.delivered !== '' && r.delivered !== null && r.delivered !== undefined) {
      const n = Number(r.delivered)
      if (!Number.isInteger(n) || n < 0) { setError('Delivered pieces must be a whole number, 0 or more.'); return }
      if (n > ordered && !window.confirm(`Delivered ${n} is more than the ${ordered} ordered. Save anyway?`)) return
      deliveredQty = n === ordered ? null : n
    }
    const returned = Number(r.qty) || 0
    if (!Number.isInteger(returned) || returned < 0) { setError('Returned pieces must be a whole number, 0 or more.'); return }
    setSaving(o.id)
    setError('')
    try {
      await markDelivered(pin, o.id, returned, r.note || '', deliveredQty)
      setEdits((prev) => { const next = { ...prev }; delete next[o.id]; return next })
      setOpen((prev) => ({ ...prev, [o.id]: false }))
      await loadRoute(date)
    } catch {
      setError('Could not save. Try again.')
    } finally {
      setSaving(null)
    }
  }

  if (!driver) {
    return (
      <div style={page}>
        <div style={{ ...card, maxWidth: 380 }}>
          <h2 style={h2}>Driver sign in</h2>
          <form onSubmit={signIn}>
            <input type="password" inputMode="numeric" placeholder="PIN" value={pin}
              onChange={(e) => setPin(e.target.value)} style={input} autoFocus />
            <button type="submit" style={btnPrimary}>Sign in</button>
          </form>
          {error && <p style={errText}>{error}</p>}
          {onBack && <button onClick={onBack} style={btnLink}>← Back</button>}
        </div>
      </div>
    )
  }

  // Totals for loading the van, and what is still in the van
  const allOrders = stops.flatMap((s) => s.orders)
  const pending = allOrders.filter((o) => o.delivery_status !== 'delivered')
  const sumType = (list, key) => list.reduce((t, o) => t + (o[key] || 0), 0)
  const stopsWithOrders = stops.filter((s) => s.orders.length > 0)
  const doneStops = stopsWithOrders.filter((s) => s.orders.every((o) => o.delivery_status === 'delivered')).length
  const regions = [...new Set(stops.map((s) => s.region).filter(Boolean))]
  const routeName = regions.length === 1 ? `${regions[0]} Route` : 'All Routes'

  return (
    <div className="arif-page" style={page}>
      <style>{printCss}</style>

      {/* ---------- Screen view ---------- */}
      <div className="arif-screen" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <div>
            <h2 style={{ ...h2, margin: 0 }}>{routeName}</h2>
            <div style={{ color: C.brownSoft, fontSize: 14 }}>{driver.name}</div>
          </div>
          <button onClick={() => { setDriver(null); setPin(''); setStops([]) }} style={btnLink}>Sign out</button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0', flexWrap: 'wrap' }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...input, margin: 0, maxWidth: 170 }} />
          <button onClick={() => window.print()} disabled={stops.length === 0} style={{ ...btnOutline, width: 'auto' }}>Print route sheet</button>
        </div>

        {loading && <p style={{ color: C.brownSoft }}>Loading…</p>}
        {error && <p style={errText}>{error}</p>}

        {!loading && stops.length > 0 && (
          <>
            {/* Van load */}
            <div style={{ ...card, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <strong style={{ color: C.brown }}>Load the van</strong>
                <span style={{ fontSize: 13, color: C.brownSoft }}>{doneStops} of {stopsWithOrders.length} stops delivered</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 6 }}>
                {TYPES.map((b) => (
                  <div key={b.key} style={{ textAlign: 'center', background: C.cream, borderRadius: 8, padding: '6px 2px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.brownSoft }}>{b.short}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.brown }}>{sumType(allOrders, b.key)}</div>
                    {pending.length !== allOrders.length && (
                      <div style={{ fontSize: 10.5, color: C.amber, fontWeight: 700 }}>{sumType(pending, b.key)} left</div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 13, color: C.brownSoft, marginTop: 8 }}>
                {allOrders.reduce((t, o) => t + bagCount(o), 0)} bags · {allOrders.reduce((t, o) => t + pieceCount(o), 0).toLocaleString()} injera · W = White, B = Brown
              </div>
            </div>

            {/* Stops */}
            {stops.map((s, i) => {
              if (s.orders.length === 0) {
                return (
                  <div key={s.id} style={{ ...stopCard, borderColor: C.line, background: '#F7F1E8', padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ ...stopNum, background: C.line, color: C.grey }}>{i + 1}</span>
                      <span style={{ fontWeight: 700, color: C.grey, flex: 1 }}>{s.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.grey, letterSpacing: 0.5 }}>NO ORDER</span>
                    </div>
                  </div>
                )
              }
              return s.orders.map((o, j) => {
                const delivered = o.delivery_status === 'delivered'
                const r = entryFor(o)
                const ordered = pieceCount(o)
                const changed = o.delivered_qty != null && o.delivered_qty !== ordered
                const bags = TYPES.filter((b) => (o[b.key] || 0) > 0)
                return (
                  <div key={o.id} style={{ ...stopCard, borderColor: delivered ? C.green : C.amber, background: delivered ? C.greenSoft : '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ ...stopNum, background: delivered ? C.green : C.red }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: C.brown, fontSize: 17 }}>
                          {s.name}{s.orders.length > 1 ? ` (order ${j + 1} of ${s.orders.length})` : ''}
                        </div>
                        {s.phone && <a href={`tel:${s.phone}`} style={{ color: C.brownSoft, fontSize: 13 }}>{s.phone}</a>}
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: delivered ? C.green : C.amber, whiteSpace: 'nowrap' }}>
                        {delivered
                          ? `✓ ${o.delivered_at ? new Date(o.delivered_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Delivered'}`
                          : 'Pending'}
                      </span>
                    </div>

                    {/* What to take from the van */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, margin: '12px 0 8px' }}>
                      {bags.map((b) => (
                        <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1.5px solid ${C.line}`, borderRadius: 10, padding: '8px 10px', background: C.card }}>
                          <span style={{ fontSize: 26, fontWeight: 800, color: C.brown, lineHeight: 1 }}>{o[b.key]}</span>
                          <span style={{ fontSize: 13, lineHeight: 1.25, color: C.brown }}>
                            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, marginRight: 5, background: b.color === 'White' ? '#F3EDE3' : '#7A4A2A', border: `1px solid ${C.brownSoft}` }} />
                            <strong>{b.color}</strong><br />bag of {b.size}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 14, color: C.brown }}>
                      {bagCount(o)} bags · <strong>{ordered} injera</strong>
                      {changed && <span style={{ color: C.red, fontWeight: 700 }}> · {o.delivered_qty} delivered</span>}
                      {o.returned_qty > 0 && <span style={{ color: C.brownSoft }}> · {o.returned_qty} returned</span>}
                    </div>
                    {o.note && <div style={{ fontSize: 13.5, background: C.amberSoft, borderRadius: 8, padding: '6px 10px', marginTop: 8, color: C.brown }}>Note: {o.note}</div>}

                    {open[o.id] ? (
                      <div style={{ marginTop: 10 }}>
                        <label style={label}>Delivered (pieces)</label>
                        <input type="number" min="0" inputMode="numeric" placeholder={`${ordered} (full order)`}
                          value={r.delivered} onChange={(e) => setEntry(o, 'delivered', e.target.value)} style={{ ...input, maxWidth: 170 }} />
                        <div style={{ fontSize: 12, color: C.brownSoft, margin: '-6px 0 10px' }}>Leave empty if the store took the full order.</div>
                        <label style={label}>Returned (pieces)</label>
                        <input type="number" min="0" inputMode="numeric" value={r.qty}
                          onChange={(e) => setEntry(o, 'qty', e.target.value)} style={{ ...input, maxWidth: 110 }} />
                        <input type="text" placeholder="Note (optional)" value={r.note}
                          onChange={(e) => setEntry(o, 'note', e.target.value)} style={input} />
                      </div>
                    ) : (
                      <button onClick={() => setOpen((p) => ({ ...p, [o.id]: true }))} style={{ ...btnLink, display: 'block', margin: '10px 0 0' }}>
                        Changes or returns
                      </button>
                    )}

                    <button onClick={() => handleDeliver(o)} disabled={saving === o.id}
                      style={{ ...(delivered ? btnOutline : btnPrimary), marginTop: 10 }}>
                      {saving === o.id ? 'Saving…' : delivered ? 'Update' : 'Mark delivered'}
                    </button>
                  </div>
                )
              })
            })}
          </>
        )}

        {!loading && !error && stops.length === 0 && (
          <p style={{ color: C.brownSoft }}>No stores on this route yet.</p>
        )}
      </div>

      {/* ---------- Printed route sheet ---------- */}
      <div className="arif-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #000', paddingBottom: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 22, fontWeight: 800 }}>{routeName}</span>
          <span style={{ fontSize: 12, letterSpacing: 1 }}>ARIF FOODS • {prettyDate(date).toUpperCase()}</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={pth('left')}>#</th>
              <th style={pth('left')}>Customer</th>
              {TYPES.map((b) => <th key={b.key} style={pth()}>{b.short}</th>)}
              <th style={pth()}>Injera</th>
              <th style={pth()}>✓</th>
            </tr>
          </thead>
          <tbody>
            {stops.map((s, i) => (s.orders.length === 0 ? (
              <tr key={s.id}>
                <td style={ptd('left')}>{i + 1}</td>
                <td style={ptd('left')}>{s.name}</td>
                <td colSpan={7} style={{ ...ptd(), fontWeight: 700, letterSpacing: 1 }}>NO ORDER</td>
                <td style={ptd()} />
              </tr>
            ) : s.orders.map((o, j) => (
              <tr key={o.id}>
                <td style={ptd('left')}>{j === 0 ? i + 1 : ''}</td>
                <td style={ptd('left')}>{s.name}{o.note ? <div style={{ fontSize: 10.5 }}>Note: {o.note}</div> : null}</td>
                {TYPES.map((b) => <td key={b.key} style={ptd()}>{o[b.key] || '–'}</td>)}
                <td style={{ ...ptd(), fontWeight: 700 }}>{pieceCount(o)}</td>
                <td style={ptd()}>☐</td>
              </tr>
            ))))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...ptd('left'), fontWeight: 800, borderTop: '2px solid #000' }} colSpan={2}>Total bags: {allOrders.reduce((t, o) => t + bagCount(o), 0)}</td>
              {TYPES.map((b) => <td key={b.key} style={{ ...ptd(), fontWeight: 800, borderTop: '2px solid #000' }}>{sumType(allOrders, b.key)}</td>)}
              <td style={{ ...ptd(), fontWeight: 800, borderTop: '2px solid #000' }}>{allOrders.reduce((t, o) => t + pieceCount(o), 0).toLocaleString()}</td>
              <td style={{ ...ptd(), borderTop: '2px solid #000' }} />
            </tr>
          </tfoot>
        </table>
        <div style={{ fontSize: 11, marginTop: 6 }}>W = White • B = Brown • Columns show bag counts by pack size</div>
      </div>
    </div>
  )
}

const printCss = `
.arif-print { display: none; }
@media print {
  .arif-screen { display: none !important; }
  .arif-print { display: block !important; color: #000; font-family: system-ui, sans-serif; }
  body, html, .arif-page { background: #fff !important; padding: 0 !important; }
  @page { margin: 0.5in; }
}
`
const page = { minHeight: '100vh', background: C.cream, padding: 16, fontFamily: 'system-ui, sans-serif', color: C.brown }
const card = { background: '#fff', borderRadius: 14, padding: 20, margin: '0 auto', border: `1px solid ${C.line}` }
const h2 = { fontFamily: 'Georgia, serif', color: C.red, margin: '0 0 12px', fontSize: 22 }
const input = { display: 'block', width: '100%', padding: '10px 12px', margin: '6px 0 10px', border: `1.5px solid ${C.line}`, borderRadius: 8, fontSize: 16, boxSizing: 'border-box', background: '#fff' }
const label = { fontSize: 12, color: C.brownSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }
const btnPrimary = { background: C.red, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 16px', fontWeight: 700, fontSize: 15, cursor: 'pointer', width: '100%' }
const btnOutline = { background: '#fff', color: C.red, border: `1.5px solid ${C.red}`, borderRadius: 10, padding: '10px 16px', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%' }
const btnLink = { background: 'none', border: 'none', color: C.brownSoft, textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: 14 }
const errText = { color: C.red, fontSize: 14, fontWeight: 600 }
const stopCard = { border: '2px solid', borderRadius: 14, padding: 14, marginBottom: 10 }
const stopNum = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 14, color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0 }
const pth = (align = 'center') => ({ textAlign: align, borderBottom: '1.5px solid #000', padding: '5px 6px', fontSize: 12 })
const ptd = (align = 'center') => ({ textAlign: align, borderBottom: '1px solid #bbb', padding: '6px 6px' })
