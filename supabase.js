import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "");

export const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export async function submitOrder(o) {
  const { error } = await supabase.from("orders").insert({
    order_date: todayStr(),
    customer: o.customer,
    phone: o.phone || null,
    bag5white: o.bag5white,
    bag5brown: o.bag5brown,
    bag10white: o.bag10white,
    bag10brown: o.bag10brown,
    bag20white: o.bag20white,
    bag20brown: o.bag20brown,
    note: o.note || null
  });
  if (error) throw error;
}

export async function verifyPin(pin) {
  const { data, error } = await supabase.rpc("verify_pin", { pin });
  if (error) throw error;
  return data === true;
}

export async function fetchOrders(pin, date) {
  const { data, error } = await supabase.rpc("get_orders", { pin, p_date: date });
  if (error) throw error;
  return data ?? [];
}

export async function deleteOrder(pin, id) {
  const { error } = await supabase.rpc("delete_order", { pin, p_id: id });
  if (error) throw error;
}
