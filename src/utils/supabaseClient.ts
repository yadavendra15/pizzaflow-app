import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Define the structure of our menu items
export interface MenuItem {
  id: string;
  name: string;
  price: number;
}

export interface OrderPayload {
  customer_name: string;
  customer_phone: string;
  quantity: number;
  payment_mode: string;
  base_id: string;
  pizza_id: string;
  base_total: number;
  discount_amount: number;
  gst_amount: number;
  final_payable: number;
  toppings: MenuItem[];
  created_at?: string;
  id?: string | number;
}

// Fallback initial menu lists directly copied from Stage 2 data files
export const FALLBACK_BASES: MenuItem[] = [
  { id: 'B1', name: 'Thin Crust', price: 149.00 },
  { id: 'B2', name: 'Thick Crust', price: 179.00 },
  { id: 'B3', name: 'Cheese Burst', price: 229.00 },
  { id: 'B4', name: 'Whole Wheat', price: 159.00 },
  { id: 'B5', name: 'Multigrain', price: 169.00 }
];

export const FALLBACK_PIZZAS: MenuItem[] = [
  { id: 'P1', name: 'Margherita', price: 299.00 },
  { id: 'P2', name: 'Chicago Deep Dish', price: 349.00 },
  { id: 'P3', name: 'Greek Mediterranean', price: 329.00 },
  { id: 'P4', name: 'California Veggie', price: 339.00 },
  { id: 'P5', name: 'Farm House', price: 319.00 },
  { id: 'P6', name: 'Pepperoni Classic', price: 369.00 },
  { id: 'P7', name: 'BBQ Chicken', price: 379.00 },
  { id: 'P8', name: 'Paneer Tikka', price: 349.00 }
];

export const FALLBACK_TOPPINGS: MenuItem[] = [
  { id: 'T1', name: 'Black Olives', price: 49.00 },
  { id: 'T2', name: 'Extra Cheese', price: 69.00 },
  { id: 'T3', name: 'Button Mushrooms', price: 49.00 },
  { id: 'T4', name: 'Green Peppers', price: 39.00 },
  { id: 'T5', name: 'Jalapenos', price: 39.00 },
  { id: 'T6', name: 'Sun-Dried Tomatoes', price: 59.00 },
  { id: 'T7', name: 'Caramelised Onions', price: 49.00 },
  { id: 'T8', name: 'Sweet Corn', price: 39.00 },
  { id: 'T9', name: 'Roasted Garlic', price: 49.00 },
  { id: 'T10', name: 'Peri-Peri Drizzle', price: 59.00 }
];

let supabaseInstance: SupabaseClient | null = null;

// Determine if keys are available
export function isSupabaseConfigured(): boolean {
  const url = (import.meta as any).env.VITE_SUPABASE_URL;
  const key = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
  return !!(url && key && url !== "YOUR_SUPABASE_URL" && key !== "YOUR_SUPABASE_ANON_KEY");
}

// Lazy initialization of Supabase client to prevent application crash when keys are missing
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseInstance) {
    try {
      const url = (import.meta as any).env.VITE_SUPABASE_URL!;
      const key = (import.meta as any).env.VITE_SUPABASE_ANON_KEY!;
      supabaseInstance = createClient(url, key);
    } catch (e) {
      console.warn('[SliceMatic] Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return supabaseInstance;
}

// 1. Fetch Menu items (bases, pizzas, toppings) with complete fallback safety
export async function fetchBasesFromDb(): Promise<MenuItem[]> {
  const client = getSupabase();
  if (!client) return FALLBACK_BASES;

  try {
    const { data, error } = await client.from('bases').select('*');
    if (error) throw error;
    if (data && data.length > 0) {
      return data.map(item => ({
        id: item.id,
        name: item.name,
        price: Number(item.price)
      }));
    }
  } catch (error) {
    console.warn('[SliceMatic] Error fetching bases from Supabase, loading fallback menu:', error);
  }
  return FALLBACK_BASES;
}

export async function fetchPizzasFromDb(): Promise<MenuItem[]> {
  const client = getSupabase();
  if (!client) return FALLBACK_PIZZAS;

  try {
    const { data, error } = await client.from('pizzas').select('*');
    if (error) throw error;
    if (data && data.length > 0) {
      return data.map(item => ({
        id: item.id,
        name: item.name,
        price: Number(item.price)
      }));
    }
  } catch (error) {
    console.warn('[SliceMatic] Error fetching pizzas from Supabase, loading fallback menu:', error);
  }
  return FALLBACK_PIZZAS;
}

export async function fetchToppingsFromDb(): Promise<MenuItem[]> {
  const client = getSupabase();
  if (!client) return FALLBACK_TOPPINGS;

  try {
    const { data, error } = await client.from('toppings').select('*');
    if (error) throw error;
    if (data && data.length > 0) {
      return data.map(item => ({
        id: item.id,
        name: item.name,
        price: Number(item.price)
      }));
    }
  } catch (error) {
    console.warn('[SliceMatic] Error fetching toppings from Supabase, loading fallback menu:', error);
  }
  return FALLBACK_TOPPINGS;
}

// 2. Insert Order complete with related line items (toppings) and fallback local persistence
export async function submitOrderToDb(payload: OrderPayload): Promise<{ success: boolean; data?: any; error?: string }> {
  // Always log to local storage for local tracking / robust auditing
  const localOrders = JSON.parse(localStorage.getItem('slicematic_local_orders') || '[]');
  const localId = `local-${Date.now()}`;
  const localRecord = {
    ...payload,
    id: localId,
    created_at: new Date().toISOString()
  };
  localOrders.unshift(localRecord);
  localStorage.setItem('slicematic_local_orders', JSON.stringify(localOrders));

  const client = getSupabase();
  if (!client) {
    return { success: true, data: localRecord, error: 'Database unconfigured: order saved locally' };
  }

  try {
    // Insert core order
    const { data: orderData, error: orderError } = await client
      .from('orders')
      .insert({
        customer_name: payload.customer_name,
        customer_phone: payload.customer_phone,
        quantity: payload.quantity,
        payment_mode: payload.payment_mode,
        base_id: payload.base_id,
        pizza_id: payload.pizza_id,
        base_total: payload.base_total,
        discount_amount: payload.discount_amount,
        gst_amount: payload.gst_amount,
        final_payable: payload.final_payable
      })
      .select();

    if (orderError) throw orderError;
    const insertedOrder = orderData?.[0];

    // If there are toppings, insert them into order_line_items
    if (insertedOrder && payload.toppings && payload.toppings.length > 0) {
      const lineItems = payload.toppings.map(topping => ({
        order_id: insertedOrder.id,
        item_type: 'topping',
        item_id: topping.id,
        item_name: topping.name,
        price: topping.price
      }));

      const { error: lineItemsError } = await client
        .from('order_line_items')
        .insert(lineItems);

      if (lineItemsError) {
        console.error('[SliceMatic] Failed to insert line items:', lineItemsError);
      }
    }

    return { success: true, data: insertedOrder };
  } catch (error: any) {
    console.error('[SliceMatic] Error submitting order to Supabase:', error);
    return { success: false, error: error.message || 'Database error: saved locally only' };
  }
}

// 3. Fetch Orders for Admin dashboard with dual fetching (from db + merging localStorage)
export async function fetchAllOrders(): Promise<OrderPayload[]> {
  const localOrders: OrderPayload[] = JSON.parse(localStorage.getItem('slicematic_local_orders') || '[]');
  const client = getSupabase();

  if (!client) {
    return localOrders;
  }

  try {
    // Fetch orders
    const { data: orders, error: ordersError } = await client
      .from('orders')
      .select('*, order_line_items(*)');

    if (ordersError) throw ordersError;

    if (orders) {
      const dbRecords: OrderPayload[] = orders.map((order: any) => {
        const toppings = (order.order_line_items || []).map((t: any) => ({
          id: t.item_id,
          name: t.item_name,
          price: Number(t.price)
        }));

        return {
          id: order.id,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          quantity: order.quantity,
          payment_mode: order.payment_mode,
          base_id: order.base_id,
          pizza_id: order.pizza_id,
          base_total: Number(order.base_total),
          discount_amount: Number(order.discount_amount),
          gst_amount: Number(order.gst_amount),
          final_payable: Number(order.final_payable),
          toppings,
          created_at: order.created_at
        };
      });

      // Combine both DB and local orders, filter out duplicates, sort by created_at desc
      const dbIds = new Set(dbRecords.map(o => String(o.id)));
      const filteredLocal = localOrders.filter(o => !dbIds.has(String(o.id)));
      const combined = [...dbRecords, ...filteredLocal];
      return combined.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
    }
  } catch (error) {
    console.warn('[SliceMatic] Failed to fetch database orders, serving local orders:', error);
  }

  return localOrders;
}
