import { useState, useEffect, useCallback } from "react";
import {
  getCustomers,
  saveCustomer,
  linkName,
  getUnlinkedNames,
  getDrivers,
  setDriverRegion
} from "./supabase.js";

const C = {
  cream: "#FDF4E7", card: "#FFFBF4", red: "#A8321C", redDark: "#7E2413",
  amber: "#E8862E", amberSoft: "#F8E3C8", brown: "#3B2316",
  brownSoft: "#8A6A52", green: "#2F6B3F", line: "#EAD9C2", blue: "#2C5A8C"
};
const REGION_COLOR = { North: C.blue, South: C.green };

const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "14px 16px", marginBottom: 18 };
const h2 = { fontFamily: "Georgia, serif", fontSize: 19, fontWeight: 700, margin: "0 0 4px" };
const sub = { fontSize: 13, color: C.brownSoft, marginBottom: 12 };
const inp = { boxSizing: "border-box", padding: "10px 12px", fontSize: 15, border: `1.5px solid ${C.line}`, borderRadius: 10, background: "#fff", color: C.brown, outline: "none" };
const row = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 0", borderTop: `1px solid ${C.line}`, flexWrap: "wrap" };
const pill = (color, solid) => ({ padding: "7px 12px", borderRadius: 10, border: `1.5px solid ${color}`, background: solid ? color : "transparent", color: solid ? "#fff" : color, fontSize: 13.5, fontWeight: 700, cursor: "pointer" });

// North / South picker. allowAll adds a third "All" choice (used for drivers).
function RegionPicker({ value, onChange, allowAll, disabled }) {
  const opts = allowAll ? ["North", "South", null] : ["North", "South"];
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {opts.map((r) => {
        const active = (value || null) === r;
        const color = r ? REGION_COLOR[r] : C.brownSoft;
        return (
          <button key={r || "all"} disabled={disabled} onClick={() => !active && onChange(r)} style={{ ...pill(color, active), opacity: disabled ? 0.6 : 1 }}>
            {r || "All"}
          </button>
        );
      })}
    </div>
  );
}

export default function CustomersAdmin({ pin, onBack }) {
  const [customers, setCustomers] = useState([]);
  const [unlinked, setUnlinked] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");
  const [linkChoice, setLinkChoice] = useState({});
  const [newName, setNewName] = useState("");
  const [newRegion, setNewRegion] = useState("North");
  const [copied, setCopied] = useState("");

  const linkFor = (c) => `${window.location.origin}/?store=${c.code}`;
  const shareLink = async (c) => {
    const url = linkFor(c);
    const text = `Arif Foods order link for ${c.name}. Open it each night to place your order, or save it to your home screen:`;
    try {
      if (navigator.share) { await navigator.share({ title: "Arif Foods order link", text, url }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(`${text} ${url}`); setCopied(c.id); setTimeout(() => setCopied(""), 2500); }
    catch { window.prompt("Copy this link:", url); }
  };

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [c, u, d] = await Promise.all([getCustomers(pin), getUnlinkedNames(pin), getDrivers(pin)]);
      setCustomers(c.filter((x) => x.active !== false));
      setUnlinked(u);
      setDrivers(d);
    } catch { setError("Could not load customers. Check your connection and try again."); }
    setLoading(false);
  }, [pin]);

  useEffect(() => { load(); }, [load]);

  const run = async (key, fn, reload = true) => {
    setBusy(key); setError("");
    try { await fn(); if (reload) await load(); }
    catch (e) { setError(e?.message || "Could not save. Try again."); }
    setBusy("");
  };

  const setRegion = (c, region) => run(`c-${c.id}`, async () => {
    await saveCustomer(pin, c.id, c.name, c.phone, region);
    setCustomers((p) => p.map((x) => (x.id === c.id ? { ...x, region } : x)));
  }, false);

  const counts = customers.reduce((a, c) => {
    if (c.region === "North") a.n++; else if (c.region === "South") a.s++; else a.none++;
    return a;
  }, { n: 0, s: 0, none: 0 });

  const shown = customers
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.region ? 1 : 0) - (b.region ? 1 : 0) || a.name.localeCompare(b.name));

  return (
    <div style={{ minHeight: "100vh", background: C.cream, fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif", color: C.brown }}>
      <div style={{ background: C.red, padding: "22px 20px 18px", textAlign: "center" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 700, color: "#FFF6E8" }}>Arif Foods</div>
        <div style={{ color: "#FFE9CB", fontSize: 14, fontWeight: 700, marginTop: 8, letterSpacing: 2, textTransform: "uppercase" }}>Customers and Regions</div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 40px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
          <button onClick={onBack} style={pill(C.brownSoft)}>← Back to orders</button>
          <div style={{ fontSize: 13.5, color: C.brownSoft }}>
            <b style={{ color: C.blue }}>{counts.n} North</b> · <b style={{ color: C.green }}>{counts.s} South</b>
            {counts.none > 0 && <> · <b style={{ color: C.red }}>{counts.none} not set</b></>}
          </div>
        </div>

        {error && <div style={{ background: "#FBE3DE", border: `1px solid ${C.red}66`, color: C.redDark, borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 14, fontWeight: 600 }}>{error}</div>}
        {loading && <div style={{ textAlign: "center", color: C.brownSoft, padding: 30 }}>Loading…</div>}

        {!loading && (
          <>
            {/* Drivers */}
            <div style={card}>
              <div style={h2}>Drivers</div>
              <div style={sub}>A driver sees only orders from customers in their region. "All" sees every order.</div>
              {drivers.filter((d) => d.active !== false).map((d) => (
                <div key={d.id} style={row}>
                  <div style={{ fontWeight: 700 }}>{d.name}</div>
                  <RegionPicker allowAll value={d.region} disabled={busy === `d-${d.id}`}
                    onChange={(r) => run(`d-${d.id}`, async () => {
                      await setDriverRegion(pin, d.id, r);
                      setDrivers((p) => p.map((x) => (x.id === d.id ? { ...x, region: r } : x)));
                    }, false)} />
                </div>
              ))}
            </div>

            {/* Names on orders not linked to a customer */}
            {unlinked.length > 0 && (
              <div style={{ ...card, borderColor: C.amber }}>
                <div style={h2}>Names to link ({unlinked.length})</div>
                <div style={sub}>These names were typed on recent orders but don't match a customer. Link each one to a customer, or add it as a new customer. Drivers with a region won't see these orders until they're linked.</div>
                {unlinked.map((u) => (
                  <div key={u.customer} style={row}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{u.customer}</div>
                      <div style={{ fontSize: 12, color: C.brownSoft }}>{u.order_count} order{u.order_count > 1 ? "s" : ""} · last {u.last_date}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <select value={linkChoice[u.customer] || ""} onChange={(e) => setLinkChoice((p) => ({ ...p, [u.customer]: e.target.value }))} style={{ ...inp, padding: "7px 8px", fontSize: 14, maxWidth: 190 }}>
                        <option value="">Link to customer…</option>
                        {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button disabled={!linkChoice[u.customer] || busy === `u-${u.customer}`} onClick={() => run(`u-${u.customer}`, () => linkName(pin, u.customer, linkChoice[u.customer]))} style={{ ...pill(C.red, true), opacity: linkChoice[u.customer] ? 1 : 0.5 }}>Link</button>
                      <button disabled={busy === `u-${u.customer}`} onClick={() => run(`u-${u.customer}`, () => saveCustomer(pin, null, u.customer, "", null))} style={pill(C.brownSoft)}>＋ New</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Customers */}
            <div style={card}>
              <div style={h2}>Customers ({customers.length})</div>
              <div style={sub}>Tap North or South for each customer. Customers with no region are listed first.</div>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers" style={{ ...inp, width: "100%", marginBottom: 6 }} />
              {shown.map((c) => (
                <div key={c.id} style={row}>
                  <div>
                    <div style={{ fontWeight: 700, color: c.region ? C.brown : C.red }}>{c.name}</div>
                    {c.code && (
                      <button onClick={() => shareLink(c)} style={{ marginTop: 4, border: "none", background: "transparent", color: C.amber, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                        {copied === c.id ? "✓ Link copied" : `🔗 Share order link · ${c.code}`}
                      </button>
                    )}
                  </div>
                  <RegionPicker value={c.region} disabled={busy === `c-${c.id}`} onChange={(r) => setRegion(c, r)} />
                </div>
              ))}
              <div style={{ ...row, borderTop: `2px solid ${C.line}`, marginTop: 6 }}>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New customer name" style={{ ...inp, flex: 1, minWidth: 160 }} />
                <RegionPicker value={newRegion} onChange={setNewRegion} />
                <button disabled={!newName.trim() || busy === "new"} onClick={() => run("new", async () => { await saveCustomer(pin, null, newName, "", newRegion); setNewName(""); })} style={{ ...pill(C.red, true), opacity: newName.trim() ? 1 : 0.5 }}>Add</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
