import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Define the structure of our menu items
export interface MenuItem {
  id: string;
  name: string;
  price: number;
  item_type?: string;
}

export interface CartItem {
  id: string;
  base: MenuItem;
  pizza: MenuItem;
  toppings: MenuItem[];
  quantity: number;
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
  cart?: CartItem[];
  status?: string;
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

let lineItemsTableCached: 'order_line_items' | 'order_items' | null = null;

export async function getLineItemsTableName(client: any): Promise<'order_line_items' | 'order_items'> {
  if (lineItemsTableCached) return lineItemsTableCached;
  try {
    const { error } = await client.from('order_line_items').select('id').limit(1);
    if (error && (error.code === 'PGRST205' || error.message?.includes('order_line_items') || error.message?.includes('relation "order_line_items" does not exist'))) {
      lineItemsTableCached = 'order_items';
    } else {
      lineItemsTableCached = 'order_line_items';
    }
  } catch (e) {
    lineItemsTableCached = 'order_items';
  }
  console.log(`[SliceMatic] Detected line items table name: ${lineItemsTableCached}`);
  return lineItemsTableCached;
}

// 2. Insert Order complete with related line items (toppings & pizzas) and fallback local persistence
export async function submitOrderToDb(payload: OrderPayload): Promise<{ success: boolean; data?: any; error?: string }> {
  // Always log to local storage for local tracking / robust auditing
  const localOrders = JSON.parse(localStorage.getItem('slicematic_local_orders') || '[]');
  const localId = `local-${Date.now()}`;
  const localRecord = {
    ...payload,
    id: localId,
    created_at: new Date().toISOString(),
    status: payload.status || 'Kitchen Sync'
  };
  localOrders.unshift(localRecord);
  localStorage.setItem('slicematic_local_orders', JSON.stringify(localOrders));

  const client = getSupabase();
  if (!client) {
    return { success: true, data: localRecord, error: 'Database unconfigured: order saved locally' };
  }

  // Define the base fields we want to insert (including multiple column name aliases for database compatibility)
  const insertPayload: any = {
    customer_name: payload.customer_name,
    name: payload.customer_name,
    customer_phone: payload.customer_phone,
    phone_number: payload.customer_phone,
    quantity: payload.quantity,
    payment_mode: payload.payment_mode,
    base_id: payload.base_id,
    pizza_id: payload.pizza_id,
    base_total: payload.base_total,
    subtotal: payload.base_total,
    discount_amount: payload.discount_amount,
    gst_amount: payload.gst_amount,
    final_payable: payload.final_payable,
    status: payload.status || 'Kitchen Sync'
  };

  let retryCount = 0;
  const maxRetries = 6;
  let lastError: any = null;
  let insertedOrder: any = null;

  while (retryCount < maxRetries) {
    try {
      const { data: orderData, error: orderError } = await client
        .from('orders')
        .insert(insertPayload)
        .select();

      if (orderError) {
        throw orderError;
      }
      
      insertedOrder = orderData?.[0];
      break; // Success! Break out of loop.
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || '';
      console.warn(`[SliceMatic] Insert attempt ${retryCount + 1} failed:`, errorMsg);
      
      // Match column error, e.g.:
      // "Could not find the 'base_id' column of 'orders' in the schema cache"
      const match = errorMsg.match(/Could not find the '([^']+)' column/i);
      if (match && match[1]) {
        const missingColumn = match[1];
        console.log(`[SliceMatic] Self-healing schema: removing missing column '${missingColumn}' from payload.`);
        delete insertPayload[missingColumn];
        retryCount++;
      } else {
        // If it's a different error, we can't heal it this way, so break and fail gracefully
        break;
      }
    }
  }

  if (!insertedOrder) {
    return { 
      success: false, 
      error: lastError?.message || 'Database error: saved locally only' 
    };
  }

  try {
    // If we have a cart, insert all items (pizzas + toppings) into order_line_items
    const lineItems: any[] = [];
    
    if (payload.cart && payload.cart.length > 0) {
      payload.cart.forEach(cartItem => {
        // 1. Insert Pizza as line item
        lineItems.push({
          order_id: insertedOrder.id,
          item_type: 'pizza',
          item_id: cartItem.pizza.id,
          item_name: `${cartItem.quantity}x ${cartItem.pizza.name} (${cartItem.base.name})`,
          name: `${cartItem.quantity}x ${cartItem.pizza.name} (${cartItem.base.name})`, // alias
          price: cartItem.pizza.price + cartItem.base.price
        });

        // 2. Insert each topping for this pizza
        cartItem.toppings.forEach(topping => {
          lineItems.push({
            order_id: insertedOrder.id,
            item_type: 'topping',
            item_id: topping.id,
            item_name: `Topping: ${topping.name} (on ${cartItem.pizza.name})`,
            name: `Topping: ${topping.name} (on ${cartItem.pizza.name})`, // alias
            price: topping.price
          });
        });
      });
    } else if (payload.toppings && payload.toppings.length > 0) {
      // Fallback for single-pizza old schema compatibility
      payload.toppings.forEach(topping => {
        lineItems.push({
          order_id: insertedOrder.id,
          item_type: 'topping',
          item_id: topping.id,
          item_name: topping.name,
          name: topping.name, // alias
          price: topping.price
        });
      });
    }

    if (lineItems.length > 0) {
      let lineRetryCount = 0;
      const maxLineRetries = 6;
      let currentLineItems = [...lineItems];
      let lineItemsSuccess = false;
      const tableName = await getLineItemsTableName(client);

      while (lineRetryCount < maxLineRetries) {
        try {
          const { error: lineItemsError } = await client
            .from(tableName)
            .insert(currentLineItems);

          if (lineItemsError) {
            throw lineItemsError;
          }
          lineItemsSuccess = true;
          break; // Success!
        } catch (lineErr: any) {
          const lineErrorMsg = lineErr.message || '';
          console.warn(`[SliceMatic] Line items insert attempt ${lineRetryCount + 1} failed:`, lineErrorMsg);
          
          // Match column error
          const match = lineErrorMsg.match(/Could not find the '([^']+)' column/i);
          if (match && match[1]) {
            const missingColumn = match[1];
            console.log(`[SliceMatic] Self-healing line item schema: removing missing column '${missingColumn}' from payloads.`);
            currentLineItems = currentLineItems.map(item => {
              const newItem = { ...item };
              delete newItem[missingColumn];
              return newItem;
            });
            lineRetryCount++;
          } else {
            // Check for not-null constraints or other common PostgreSQL/Supabase errors
            // E.g. "null value in column '...' violates not-null constraint"
            const nullMatch = lineErrorMsg.match(new RegExp(`null value in column "([^"]+)" of relation "(${tableName})" violates not-null constraint`, 'i'));
            if (nullMatch && nullMatch[1]) {
              const requiredColumn = nullMatch[1];
              console.log(`[SliceMatic] Self-healing line item schema: supplying fallback for required column '${requiredColumn}'.`);
              currentLineItems = currentLineItems.map(item => {
                const newItem = { ...item };
                if (requiredColumn === 'quantity') {
                  newItem[requiredColumn] = 1;
                } else if (requiredColumn === 'price') {
                  newItem[requiredColumn] = 0;
                } else if (requiredColumn === 'item_name' || requiredColumn === 'name') {
                  newItem[requiredColumn] = 'Item';
                } else {
                  newItem[requiredColumn] = '';
                }
                return newItem;
              });
              lineRetryCount++;
            } else {
              break;
            }
          }
        }
      }

      // Final individual row fallback if batch insertion still failed
      if (!lineItemsSuccess) {
        console.log('[SliceMatic] Batch line items insert failed. Trying individual inserts as fallback.');
        for (const singleItem of currentLineItems) {
          let itemRetry = 0;
          let currentSingle = { ...singleItem };
          while (itemRetry < 4) {
            try {
              const { error: singleErr } = await client
                .from(tableName)
                .insert(currentSingle);
              if (singleErr) throw singleErr;
              break;
            } catch (err: any) {
              const errMsg = err.message || '';
              const match = errMsg.match(/Could not find the '([^']+)' column/i);
              if (match && match[1]) {
                delete currentSingle[match[1]];
                itemRetry++;
              } else {
                console.warn('[SliceMatic] Individual line item row insert skipped:', errMsg);
                break;
              }
            }
          }
        }
      }
    }

    return { success: true, data: insertedOrder };
  } catch (err: any) {
    console.error('[SliceMatic] Post-insert tasks failed:', err);
    return { success: true, data: insertedOrder };
  }
}

// 3. Fetch Orders for Admin dashboard with dual fetching (from db + merging localStorage)
export async function fetchAllOrders(): Promise<OrderPayload[]> {
  const localOrders: OrderPayload[] = JSON.parse(localStorage.getItem('slicematic_local_orders') || '[]');
  const client = getSupabase();

  if (!client) {
    return localOrders.filter(o => o.customer_name !== '_SYSTEM_CONFIG_DISCOUNT_THRESHOLD_');
  }

  try {
    // Fetch orders first (without foreign key join request)
    const { data: orders, error: ordersError } = await client
      .from('orders')
      .select('*');

    if (ordersError) throw ordersError;

    let allLineItems: any[] = [];
    if (orders && orders.length > 0) {
      try {
        const orderIds = orders.map((o: any) => o.id);
        // Fetch matching line items from detected table
        const tableName = await getLineItemsTableName(client);
        const { data: lineItems, error: lineItemsError } = await client
          .from(tableName)
          .select('*')
          .in('order_id', orderIds);

        if (!lineItemsError && lineItems) {
          allLineItems = lineItems;
        } else {
          console.warn('[SliceMatic] Could not fetch line items separately:', lineItemsError);
        }
      } catch (e) {
        console.warn('[SliceMatic] Error fetching order line items separately:', e);
      }
    }

    if (orders) {
      // Map line items by their parent order_id
      const lineItemsByOrderId: Record<string, any[]> = {};
      allLineItems.forEach((item: any) => {
        if (item.order_id) {
          if (!lineItemsByOrderId[item.order_id]) {
            lineItemsByOrderId[item.order_id] = [];
          }
          lineItemsByOrderId[item.order_id].push(item);
        }
      });

      const dbRecords: OrderPayload[] = orders
        .filter((order: any) => order.customer_name !== '_SYSTEM_CONFIG_DISCOUNT_THRESHOLD_')
        .map((order: any) => {
          const items = lineItemsByOrderId[order.id] || [];
          const toppings = items.map((t: any) => ({
            id: t.item_id || t.id,
            name: t.item_name || t.name || 'Item',
            price: Number(t.price || 0),
            item_type: t.item_type || 'unknown'
          }));

          return {
            id: order.id,
            customer_name: order.customer_name || order.name || 'Gourmet Customer',
            customer_phone: order.customer_phone || order.phone_number || '',
            quantity: order.quantity,
            payment_mode: order.payment_mode,
            base_id: order.base_id,
            pizza_id: order.pizza_id,
            base_total: Number(order.base_total !== undefined && order.base_total !== null ? order.base_total : (order.subtotal !== undefined && order.subtotal !== null ? order.subtotal : 0)),
            discount_amount: Number(order.discount_amount),
            gst_amount: Number(order.gst_amount),
            final_payable: Number(order.final_payable),
            toppings,
            created_at: order.created_at,
            status: order.status || 'Kitchen Sync'
          };
        });

      // Rely strictly on Supabase database records when configured and successfully fetched
      return dbRecords.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
    }
  } catch (error) {
    console.warn('[SliceMatic] Failed to fetch database orders, serving local orders:', error);
  }

  return localOrders.filter(o => o.customer_name !== '_SYSTEM_CONFIG_DISCOUNT_THRESHOLD_');
}

// 4. Fetch the discount threshold from the database
export async function fetchDiscountThresholdFromDb(): Promise<number> {
  const client = getSupabase();
  if (!client) {
    const saved = localStorage.getItem('slicematic_discount_threshold');
    return saved ? parseInt(saved, 10) : 5;
  }

  // Method A: Try reading from dedicated 'configurations' table
  try {
    const { data, error } = await client
      .from('configurations')
      .select('value')
      .eq('key', 'discount_threshold')
      .maybeSingle();
    
    if (!error && data) {
      const val = parseInt(data.value, 10);
      if (!isNaN(val)) return val;
    }
  } catch (err) {
    // Quietly proceed to fallback
  }

  // Method B: Try reading from fallback system row in 'orders' table
  try {
    const { data, error } = await client
      .from('orders')
      .select('*')
      .eq('customer_name', '_SYSTEM_CONFIG_DISCOUNT_THRESHOLD_')
      .order('id', { ascending: false })
      .limit(1);
    
    if (!error && data && data.length > 0) {
      return Number(data[0].quantity || data[0].subtotal || 5);
    }
  } catch (err) {
    console.warn('[SliceMatic] Failed to fetch discount threshold from DB, using fallback:', err);
  }
  const saved = localStorage.getItem('slicematic_discount_threshold');
  return saved ? parseInt(saved, 10) : 5;
}

// 5. Save the discount threshold to the database (updates existing config or inserts if none exists)
export async function saveDiscountThresholdToDb(threshold: number): Promise<boolean> {
  localStorage.setItem('slicematic_discount_threshold', String(threshold));
  const client = getSupabase();
  if (!client) return false;

  let savedSuccessfully = false;

  // Method A: Try saving to dedicated 'configurations' table
  try {
    const { data, error: selectError } = await client
      .from('configurations')
      .select('key')
      .eq('key', 'discount_threshold')
      .limit(1);

    if (!selectError) {
      if (data && data.length > 0) {
        const { error: updateError } = await client
          .from('configurations')
          .update({ value: String(threshold), updated_at: new Date().toISOString() })
          .eq('key', 'discount_threshold');
        if (!updateError) savedSuccessfully = true;
      } else {
        const { error: insertError } = await client
          .from('configurations')
          .insert({ key: 'discount_threshold', value: String(threshold), updated_at: new Date().toISOString() });
        if (!insertError) savedSuccessfully = true;
      }
    }
  } catch (err) {
    // Quietly proceed to fallback
  }

  if (savedSuccessfully) return true;

  // Method B: Try saving to system row in 'orders' table
  try {
    const { data, error: selectError } = await client
      .from('orders')
      .select('id')
      .eq('customer_name', '_SYSTEM_CONFIG_DISCOUNT_THRESHOLD_')
      .limit(1);

    if (selectError) throw selectError;

    if (data && data.length > 0) {
      // Update existing config row
      const { error: updateError } = await client
        .from('orders')
        .update({
          quantity: threshold,
          subtotal: threshold,
          base_total: threshold,
          final_payable: 0,
          created_at: new Date().toISOString()
        })
        .eq('id', data[0].id);

      if (updateError) throw updateError;
    } else {
      // Insert new config row
      const { error: insertError } = await client
        .from('orders')
        .insert({
          customer_name: '_SYSTEM_CONFIG_DISCOUNT_THRESHOLD_',
          name: '_SYSTEM_CONFIG_DISCOUNT_THRESHOLD_',
          customer_phone: '0000000000',
          phone_number: '0000000000',
          quantity: threshold,
          subtotal: threshold,
          base_total: threshold,
          discount_amount: 0,
          gst_amount: 0,
          final_payable: 0,
          payment_mode: 'SYSTEM',
          created_at: new Date().toISOString()
        });

      if (insertError) throw insertError;
    }
    return true;
  } catch (err) {
    console.warn('[SliceMatic] Failed to save discount threshold to DB fallback:', err);
    return false;
  }
}

// 6. Update order status in local storage and database
export async function updateOrderStatusInDb(orderId: string | number, status: string): Promise<boolean> {
  // Update in LocalStorage
  try {
    const localOrders: OrderPayload[] = JSON.parse(localStorage.getItem('slicematic_local_orders') || '[]');
    const updatedLocal = localOrders.map(o => {
      if (String(o.id) === String(orderId)) {
        return { ...o, status };
      }
      return o;
    });
    localStorage.setItem('slicematic_local_orders', JSON.stringify(updatedLocal));
  } catch (err) {
    console.warn('[SliceMatic] Failed to update status in localStorage', err);
  }

  const client = getSupabase();
  if (!client) return true; // Offline / Simulation success

  try {
    const { error } = await client
      .from('orders')
      .update({ status: status })
      .eq('id', orderId);

    if (error) {
      console.warn('[SliceMatic] Failed to update status in Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SliceMatic] Error updating order status in DB:', err);
    return false;
  }
}
