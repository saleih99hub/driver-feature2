import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export async function verifyDriverPin(pin) {
  const { data, error } = await supabase.rpc('verify_driver_pin', { pin })
  if (error) throw error
  return data?.[0] || null // { id, name } or null if PIN doesn't match
}

export async function getOrdersForDelivery(pin, date) {
  const { data, error } = await supabase.rpc('get_orders_for_delivery', { pin, p_date: date })
  if (error) throw error
  return data || []
}

// deliveredQty: pieces actually delivered. null = delivered as ordered.
export async function markDelivered(pin, orderId, returnedQty = 0, returnNote = '', deliveredQty = null) {
  const { error } = await supabase.rpc('mark_delivered', {
    pin,
    p_id: orderId,
    p_returned_qty: returnedQty,
    p_return_note: returnNote || null,
    p_delivered_qty: deliveredQty,
  })
  if (error) throw error
}

export async function getWeeklyInvoice(pin, startDate, endDate) {
  const { data, error } = await supabase.rpc('get_weekly_invoice', {
    pin,
    p_start: startDate,
    p_end: endDate,
  })
  if (error) throw error
  return data || []
}

// Standard price per injera, stored in app_settings
export async function getInvoiceRate(pin) {
  const { data, error } = await supabase.rpc('get_invoice_rate', { pin })
  if (error) throw error
  return data
}

export async function setInvoiceRate(pin, rate) {
  const { data, error } = await supabase.rpc('set_invoice_rate', { pin, p_rate: rate })
  if (error) throw error
  return data
}

// Every store on the driver's route for a date, in stop order, with that day's orders.
// Stores with no order come back once with order_id = null.
export async function getRouteSheet(pin, date) {
  const { data, error } = await supabase.rpc('get_route_sheet', { pin, p_date: date })
  if (error) throw error
  return data || []
}
