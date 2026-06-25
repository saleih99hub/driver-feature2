import { useState, useEffect, useCallback } from "react";
import {
  submitOrder,
  verifyPin,
  fetchOrders,
  deleteOrder,
  todayStr
} from "./supabase.js";
import DriverView from "./DriverView";
import WeeklyInvoice from "./WeeklyInvoice";
import EnvBanner from "./EnvBanner";

const C = {
  cream: "#FDF4E7", card: "#FFFBF4", red: "#A8321C", redDark: "#7E2413",
  amber: "#E8862E", amberSoft: "#F8E3C8", brown: "#3B2316",
  brownSoft: "#8A6A52", green: "#2F6B3F", line: "#EAD9C2"
};

const prettyDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });
};

// One color row inside a bag-size card
function ColorRow({ color, value, onChange }) {
  const isWhite = color === "White";
  const swatch = isWhite ? "#F5ECDD" : "#8A5A33";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 18, height: 18, borderRadius: "50%", background: swatch, border: `1.5px solid ${C.line}`, display: "inline-block" }} />
        <span style={{ fontSize: 15, fontWeight: 600, color: C.brown }}>{color}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Decrease ${color}`} style={btnStep(value === 0)}>−</button>
        <input type="number" min="0" max="99" value={value}
          onChange={(e) => { const n = parseInt(e.target.value, 10); onChange(isNaN(n) ? 0 : Math.max(0, Math.min(99, n))); }}
          style={{ width: 50, textAlign: "center", fontSize: 20, fontWeight: 700, color: C.brown, border: `1.5px solid ${C.line}`, borderRadius: 10, padding: "5px 0", background: "#fff", outline: "none" }} />
        <button onClick={() => onChange(Math.min(99, value + 1))} aria-label={`Increase ${color}`} style={btnStep(false)}>+</button>
      </div>
    </div>
  );
}

function BagCard({ size, white, brown, setWhite, setBrown, accent }) {
  const total = (white + brown) * size;
  return (
    <div style={{ background: C.card, border: `1.5px solid ${(white + brown) > 0 ? accent : C.line}`, borderRadius: 18, padding: "16px 18px", boxShadow: (white + brown) > 0 ? `0 4px 16px ${accent}22` : "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "radial-gradient(circle at 38% 35%, #F3D9AE, #E2B97F 55%, #C9985B)", border: `3px solid ${(white + brown) > 0 ? accent : C.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 700, color: C.brown }}>{size}</div>
        <div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, color: C.brown }}>Bag of {size}</div>
          <div style={{ fontSize: 12, color: C.brownSoft }}>{size} injera per bag · pick color</div>
        </div>
      </div>
      <ColorRow color="White" value={white} onChange={setWhite} />
      <div style={{ height: 1, background: C.line }} />
      <ColorRow color="Brown" value={brown} onChange={setBrown} />
      {(white + brown) > 0 && (
        <div style={{ marginTop: 8, fontSize: 13, color: accent, fontWeight: 600, textAlign: "right" }}>{white + brown} bag{(white + brown) > 1 ? "s" : ""} · {total} injera</div>
      )}
    </div>
  );
}

const btnStep = (disabled) => ({
  width: 36, height: 36, borderRadius: "50%", border: "none", cursor: disabled ? "default" : "pointer",
  background: disabled ? C.amberSoft : C.red, color: disabled ? C.brownSoft : "#fff", fontSize: 20, fontWeight: 700, lineHeight: 1
});

const injeraOf = (o) =>
  o.bag5white * 5 + o.bag5brown * 5 + o.bag10white * 10 + o.bag10brown * 10 + o.bag20white * 20 + o.bag20brown * 20;

export default function App() {
  const [view, setView] = useState("order");
  const [staffPin, setStaffPin] = useState(() => sessionStorage.getItem("arif_staff_pin") || "");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinChecking, setPinChecking] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [b5w, setB5w] = useState(0); const [b5b, setB5b] = useState(0);
  const [b10w, setB10w] = useState(0); const [b10b, setB10b] = useState(0);
  const [b20w, setB20w] = useState(0); const [b20b, setB20b] = useState(0);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(null);
  const [saving, setSaving] = useState(false);

  const [summaryDate, setSummaryDate] = useState(todayStr());
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  const totalInjera = (b5w + b5b) * 5 + (b10w + b10b) * 10 + (b20w + b20b) * 20;
  const anyBags = b5w + b5b + b10w + b10b + b20w + b20b > 0;

  const refresh = useCallback(async (date, pin) => {
    setLoading(true); setSummaryError("");
    try { setOrders(await fetchOrders(pin, date)); }
    catch { setSummaryError("Could not load orders. Check your connection and try again."); }
    setLoading(false);
  }, []);

  useEffect(() => { if (view === "summary" && staffPin) refresh(summaryDate, staffPin); }, [view, summaryDate, staffPin, refresh]);

  const tryPin = async () => {
    if (!pinInput) return;
    setPinChecking(true); setPinError("");
    try {
      if (await verifyPin(pinInput)) {
        setStaffPin(pinInput); sessionStorage.setItem("arif_staff_pin", pinInput);
        setView("summary"); setPinInput("");
      } else { setPinError("Incorrect PIN. Try again."); setPinInput(""); }
    } catch { setPinError("Could not verify the PIN. Check your connection."); }
    setPinChecking(false);
  };

  const lockAndExit = () => { setStaffPin(""); sessionStorage.removeItem("arif_staff_pin"); setView("order"); };

  const submit = async () => {
    setError("");
    if (!name.trim()) { setError("Please enter your name so the baker knows who the order is for."); return; }
    if (!anyBags) { setError("Pick a quantity for at least one bag (any size, white or brown) before submitting."); return; }
    setSaving(true);
    try {
      const payload = { customer: name.trim(), phone: phone.trim(), bag5white: b5w, bag5brown: b5b, bag10white: b10w, bag10brown: b10b, bag20white: b20w, bag20brown: b20b, note: note.trim() };
      await submitOrder(payload);
      setConfirmed({ ...payload, date: todayStr() });
      setB5w(0); setB5b(0); setB10w(0); setB10b(0); setB20w(0); setB20b(0); setNote("");
    } catch { setError("Could not save the order. Check your connection and try again."); }
    setSaving(false);
  };

  const removeOrder = async (id) => {
    try { await deleteOrder(staffPin, id); setOrders((p) => p.filter((o) => o.id !== id)); }
    catch { setSummaryError("Could not remove that order. Refresh and try again."); }
  };

  // Column totals
  const T = orders.reduce((a, o) => ({
    b5w: a.b5w + o.bag5white, b5b: a.b5b + o.bag5brown,
    b10w: a.b10w + o.bag10white, b10b: a.b10b + o.bag10brown,
    b20w: a.b20w + o.bag20white, b20b: a.b20b + o.bag20brown,
    inj: a.inj + injeraOf(o)
  }), { b5w: 0, b5b: 0, b10w: 0, b10b: 0, b20w: 0, b20b: 0, inj: 0 });

  const exportExcel = () => {
    const headers = ["Customer", "Phone", "Bag5 White", "Bag5 Brown", "Bag10 White", "Bag10 Brown", "Bag20 White", "Bag20 Brown", "Total Injera", "Note", "Time"];
    const rows = orders.map((o) => [
      o.customer, o.phone || "", o.bag5white, o.bag5brown, o.bag10white, o.bag10brown, o.bag20white, o.bag20brown, injeraOf(o), o.note || "",
      new Date(o.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    ]);
    const totalRow = ["BAKER TOTAL", "", T.b5w, T.b5b, T.b10w, T.b10b, T.b20w, T.b20b, T.inj, "", ""];
    const esc = (v) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [headers, ...rows, totalRow].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `arif-orders-${summaryDate}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const unlocked = view === "summary" && !!staffPin;

  if (view === "driver") {
    return (
      <>
        <EnvBanner />
        <DriverView onBack={() => setView("order")} />
      </>
    );
  }

  if (view === "invoice") {
    return (
      <>
        <EnvBanner />
        <WeeklyInvoice pin={staffPin} onBack={() => setView("summary")} />
      </>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.cream, fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif", color: C.brown, display: "flex", flexDirection: "column" }}>
      <EnvBanner />
      <div style={{ background: C.red, padding: "26px 20px 22px", textAlign: "center" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 30, fontWeight: 700, color: "#FFF6E8" }}>Arif Foods</div>
        <div style={{ color: "#F6CFA0", fontSize: 13, marginTop: 2, fontStyle: "italic" }}>Love yourself — Bold Flavours, Authentic Roots</div>
        <div style={{ color: "#FFE9CB", fontSize: 15, fontWeight: 700, marginTop: 14, letterSpacing: 2, textTransform: "uppercase" }}>{unlocked ? "👩‍🍳 Baker Dashboard" : "🌙 Night Injera Orders"}</div>
      </div>

      <div style={{ maxWidth: 720, width: "100%", margin: "0 auto", padding: "26px 18px 40px", flex: 1, boxSizing: "border-box" }}>
        {view === "order" && !confirmed && (
          <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700 }}>Tonight's order</div>
              <div style={{ color: C.brownSoft, fontSize: 14, marginTop: 4 }}>{prettyDate(todayStr())} · fresh for tomorrow morning</div>
            </div>
            <label style={lbl}>Your name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hanna T." style={inp} />
            <label style={lbl}>Phone (optional)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(206) 555-0100" style={inp} />
            <div style={{ display: "grid", gap: 14, margin: "22px 0 6px" }}>
              <BagCard size={5} white={b5w} brown={b5b} setWhite={setB5w} setBrown={setB5b} accent={C.amber} />
              <BagCard size={10} white={b10w} brown={b10b} setWhite={setB10w} setBrown={setB10b} accent={C.red} />
              <BagCard size={20} white={b20w} brown={b20b} setWhite={setB20w} setBrown={setB20b} accent={C.green} />
            </div>
            <div style={{ fontSize: 12.5, color: C.brownSoft, textAlign: "center", marginBottom: 16 }}>Pick at least one bag (any size or color).</div>
            <label style={lbl}>Note to the baker (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. pickup at 8am" style={inp} />
            {anyBags && (
              <div style={{ background: C.amberSoft, border: `1px solid ${C.amber}55`, borderRadius: 14, padding: "12px 16px", margin: "18px 0 6px", textAlign: "center", fontSize: 15 }}>
                <strong>Order total: {totalInjera} injera</strong>
              </div>
            )}
            {error && <div style={{ background: "#FBE3DE", border: `1px solid ${C.red}66`, color: C.redDark, borderRadius: 12, padding: "11px 15px", marginTop: 14, fontSize: 14, fontWeight: 600 }}>{error}</div>}
            <button onClick={submit} disabled={saving} style={{ width: "100%", marginTop: 20, padding: "16px 0", border: "none", borderRadius: 16, background: saving ? C.brownSoft : C.red, color: "#fff", fontSize: 17, fontWeight: 700, cursor: saving ? "wait" : "pointer", boxShadow: `0 6px 18px ${C.red}44` }}>{saving ? "Submitting…" : "Submit tonight's order"}</button>
          </>
        )}

        {view === "order" && confirmed && (
          <div style={{ textAlign: "center", paddingTop: 24 }}>
            <div style={{ width: 76, height: 76, borderRadius: "50%", background: C.green, color: "#fff", fontSize: 38, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>✓</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 700 }}>Order received!</div>
            <div style={{ color: C.brownSoft, marginTop: 6, fontSize: 15 }}>Thank you, {confirmed.customer}. Your injera will be ready in the morning.</div>
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "18px 20px", margin: "22px auto 0", maxWidth: 400, textAlign: "left", fontSize: 15 }}>
              <Row k="Order date" v={prettyDate(confirmed.date)} />
              {confirmed.bag5white > 0 && <Row k="Bag of 5 — White" v={`${confirmed.bag5white} (${confirmed.bag5white * 5} injera)`} />}
              {confirmed.bag5brown > 0 && <Row k="Bag of 5 — Brown" v={`${confirmed.bag5brown} (${confirmed.bag5brown * 5} injera)`} />}
              {confirmed.bag10white > 0 && <Row k="Bag of 10 — White" v={`${confirmed.bag10white} (${confirmed.bag10white * 10} injera)`} />}
              {confirmed.bag10brown > 0 && <Row k="Bag of 10 — Brown" v={`${confirmed.bag10brown} (${confirmed.bag10brown * 10} injera)`} />}
              {confirmed.bag20white > 0 && <Row k="Bag of 20 — White" v={`${confirmed.bag20white} (${confirmed.bag20white * 20} injera)`} />}
              {confirmed.bag20brown > 0 && <Row k="Bag of 20 — Brown" v={`${confirmed.bag20brown} (${confirmed.bag20brown * 20} injera)`} />}
              <Row k="Total injera" v={injeraOf(confirmed)} bold />
              {confirmed.note && <Row k="Note" v={confirmed.note} />}
            </div>
            <button onClick={() => setConfirmed(null)} style={{ marginTop: 22, padding: "12px 28px", borderRadius: 14, border: `1.5px solid ${C.red}`, background: "transparent", color: C.red, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Place another order</button>
          </div>
        )}

        {view === "pin" && (
          <div style={{ textAlign: "center", paddingTop: 30, maxWidth: 320, margin: "0 auto" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700 }}>Staff access</div>
            <div style={{ color: C.brownSoft, fontSize: 14, margin: "6px 0 22px" }}>Enter the baker PIN to view the order summary.</div>
            <input type="password" inputMode="numeric" maxLength={8} value={pinInput}
              onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, "")); setPinError(""); }}
              onKeyDown={(e) => e.key === "Enter" && tryPin()} placeholder="• • • •" autoFocus
              style={{ ...inp, textAlign: "center", fontSize: 28, letterSpacing: 10, fontWeight: 700, border: `2px solid ${pinError ? C.red : C.line}` }} />
            {pinError && <div style={{ color: C.redDark, fontSize: 14, fontWeight: 600, marginTop: 10 }}>{pinError}</div>}
            <button onClick={tryPin} disabled={pinChecking} style={{ width: "100%", marginTop: 18, padding: "14px 0", border: "none", borderRadius: 14, background: pinChecking ? C.brownSoft : C.red, color: "#fff", fontSize: 16, fontWeight: 700, cursor: pinChecking ? "wait" : "pointer" }}>{pinChecking ? "Checking…" : "Unlock summary"}</button>
            <button onClick={() => { setView("order"); setPinInput(""); setPinError(""); }} style={{ marginTop: 12, border: "none", background: "transparent", color: C.brownSoft, fontSize: 14, cursor: "pointer", textDecoration: "underline" }}>Back to ordering</button>
          </div>
        )}

        {unlocked && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700 }}>Order summary</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input type="date" value={summaryDate} onChange={(e) => setSummaryDate(e.target.value)} style={{ ...inp, width: "auto", margin: 0, padding: "9px 12px", fontSize: 15 }} />
                <button onClick={() => refresh(summaryDate, staffPin)} title="Refresh" style={pillBtn(C.amber)}>↻</button>
                <button onClick={exportExcel} disabled={orders.length === 0} style={pillBtn(C.green)}>⬇ Excel</button>
                <button onClick={() => setView("invoice")} style={pillBtn(C.brown)}>📋 Weekly Invoice</button>
                <button onClick={lockAndExit} style={pillBtn(C.brownSoft)}>🔒 Lock</button>
              </div>
            </div>
            <div style={{ color: C.brownSoft, fontSize: 14, marginBottom: 16 }}>{prettyDate(summaryDate)}</div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
              <Stat label="Total bags" value={T.b5w + T.b5b + T.b10w + T.b10b + T.b20w + T.b20b} accent={C.amber} />
              <Stat label="Orders" value={orders.length} accent={C.red} />
              <Stat label="Total injera to bake" value={T.inj} accent={C.green} big />
            </div>

            {summaryError && <div style={{ background: "#FBE3DE", border: `1px solid ${C.red}66`, color: C.redDark, borderRadius: 12, padding: "11px 15px", marginBottom: 14, fontSize: 14, fontWeight: 600 }}>{summaryError}</div>}

            {loading ? <div style={{ textAlign: "center", color: C.brownSoft, padding: 30 }}>Loading orders…</div>
              : orders.length === 0 ? <div style={{ textAlign: "center", color: C.brownSoft, padding: "36px 20px", background: C.card, borderRadius: 16, border: `1px dashed ${C.line}` }}>No orders for this date yet.</div>
              : (
                <div style={{ overflowX: "auto", background: C.card, border: `1px solid ${C.line}`, borderRadius: 16 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 640 }}>
                    <thead>
                      <tr style={{ background: C.amberSoft, color: C.brown }}>
                        <th style={th("left")}>Customer</th>
                        <th style={th()}>5 W</th><th style={th()}>5 B</th>
                        <th style={th()}>10 W</th><th style={th()}>10 B</th>
                        <th style={th()}>20 W</th><th style={th()}>20 B</th>
                        <th style={th()}>Injera</th><th style={th()}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id} style={{ borderTop: `1px solid ${C.line}` }}>
                          <td style={td("left")}>
                            <div style={{ fontWeight: 700 }}>{o.customer}</div>
                            <div style={{ fontSize: 11.5, color: C.brownSoft }}>{new Date(o.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}{o.phone ? ` · ${o.phone}` : ""}{o.note ? ` · "${o.note}"` : ""}</div>
                          </td>
                          <td style={td()}>{o.bag5white || "—"}</td><td style={td()}>{o.bag5brown || "—"}</td>
                          <td style={td()}>{o.bag10white || "—"}</td><td style={td()}>{o.bag10brown || "—"}</td>
                          <td style={td()}>{o.bag20white || "—"}</td><td style={td()}>{o.bag20brown || "—"}</td>
                          <td style={{ ...td(), fontWeight: 700 }}>{injeraOf(o)}</td>
                          <td style={td()}><button onClick={() => removeOrder(o.id)} style={{ border: "none", background: "transparent", color: C.brownSoft, cursor: "pointer", fontSize: 16 }}>✕</button></td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: `2px solid ${C.red}`, background: "#FFF3E2", fontWeight: 800 }}>
                        <td style={td("left")}>Baker total</td>
                        <td style={td()}>{T.b5w}</td><td style={td()}>{T.b5b}</td>
                        <td style={td()}>{T.b10w}</td><td style={td()}>{T.b10b}</td>
                        <td style={td()}>{T.b20w}</td><td style={td()}>{T.b20b}</td>
                        <td style={{ ...td(), color: C.red }}>{T.inj}</td><td style={td()}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            <div style={{ fontSize: 12, color: C.brownSoft, marginTop: 10 }}>W = White · B = Brown. The Excel button downloads this list as a spreadsheet you can open and print.</div>
          </>
        )}
      </div>

      <div style={{ textAlign: "center", padding: "0 0 22px", fontSize: 12.5, color: C.brownSoft }}>
        © Arif Foods · {!unlocked && <button onClick={() => setView("pin")} style={{ border: "none", background: "transparent", color: C.brownSoft, fontSize: 12.5, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Staff sign-in</button>}
        {" · "}
        <button onClick={() => setView("driver")} style={{ border: "none", background: "transparent", color: C.brownSoft, fontSize: 12.5, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Driver sign-in</button>
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#8A6A52", margin: "16px 0 6px" };
const inp = { width: "100%", boxSizing: "border-box", padding: "13px 15px", fontSize: 16, border: "1.5px solid #EAD9C2", borderRadius: 12, background: "#fff", color: "#3B2316", outline: "none" };
const th = (align) => ({ padding: "11px 10px", textAlign: align || "center", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 });
const td = (align) => ({ padding: "11px 10px", textAlign: align || "center" });
const pillBtn = (color) => ({ padding: "9px 14px", borderRadius: 12, border: `1.5px solid ${color}`, background: "transparent", color, fontSize: 14, fontWeight: 700, cursor: "pointer" });

function Row({ k, v, bold }) {
  return <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontWeight: bold ? 800 : 400 }}><span style={{ color: "#8A6A52" }}>{k}</span><span>{v}</span></div>;
}
function Stat({ label, value, accent, big }) {
  return <div style={{ flex: big ? 1.4 : 1, minWidth: 130, background: "#FFFBF4", border: `1.5px solid ${accent}55`, borderTop: `4px solid ${accent}`, borderRadius: 14, padding: "14px 16px", textAlign: "center" }}><div style={{ fontSize: 30, fontWeight: 800, color: accent, fontFamily: "Georgia, serif" }}>{value}</div><div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "#8A6A52" }}>{label}</div></div>;
}

