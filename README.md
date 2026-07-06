# SliceMatic Client Portal & Admin Dashboard

SliceMatic is a premium, full-stack, production-grade pizza ordering client portal and admin audit application. It is built using React (Vite), Tailwind CSS, Express (Node.js), Supabase, and OpenRouter's Gemini 2.5 Flash API.

This application replaces traditional manual order forms with a modern, automated system featuring a live visual canvas, precise billing engines, instant mobile syncing, and AI-powered upselling.

---

## 🚀 Key Features

1. **Step-by-Step Customer intake Form**:
   - Stringent customer validation. Names are restricted to `^[a-zA-Z ]+$` (2-40 characters).
   - Phone numbers must be exactly 10 digits starting with Indian mobile prefixes (`6`, `7`, `8`, or `9`).
2. **Interactive Pizza Visualizer**:
   - A dynamic, live pizza canvas rendered with `motion`.
   - Real-time renders of crust bases (Thin, Thick, Cheese Burst, Whole Wheat, Multigrain), specific pizza sauce overlays, and individual toppings (e.g., Black Olives, Jalapenos) placed dynamically using offset algorithms.
3. **Deterministic Billing & Math Engine**:
   - Formula: `(Base Price + Pizza Price + Sum(Toppings Price)) * Quantity`.
   - Automatic **10% discount** applied to the subtotal when ordering 5 or more pizzas.
   - Standard **18% GST** added post-discount.
4. **AI Flavor Guru (AI Smart Upsell)**:
   - Powered by OpenRouter calling `google/gemini-2.5-flash`.
   - Analyzes current selections to output a 1-2 sentence gourmet topping or crust enhancement.
   - Built with an `AbortController` timeout interceptor: if the API takes > 2 seconds, the client portal silently falls back to standard suggestions to ensure zero checkout friction.
5. **Supabase Cloud Database Persistence**:
   - Submits structured order details and timestamps to a cloud-hosted `orders` schema table.
   - Records line item selections to a related `order_line_items` table.
   - Dual-Fetch fallback system: if Supabase configurations are missing or offline, details are safely persisted to local storage so no orders are ever lost.
6. **Real-Time QR Code Sharing**:
   - Embeds `qrcode.react` to generate dynamic QR codes pointing to the live URL.
   - Enables clients at a physical counter to scan, take over, and continue customisation on their mobile browsers seamlessly.
7. **Secure Administrator Audit Portal**:
   - Under `admin@slicematic.com` login.
   - Displays a clean, beautifully formatted spreadsheet table of all active bookings, item codes, sub-totals, discounts, taxes, and payment states.

---

## 🛠️ Database Schema Structure (Supabase)

To support this deployment fully, create the following tables in your Supabase database:

### 1. `bases` Table
* `id` (text, primary key) - e.g., `B1`, `B2`
* `name` (text) - e.g., `Thin Crust`
* `price` (numeric) - e.g., `149.00`

### 2. `pizzas` Table
* `id` (text, primary key) - e.g., `P1`, `P2`
* `name` (text) - e.g., `Margherita`
* `price` (numeric) - e.g., `299.00`

### 3. `toppings` Table
* `id` (text, primary key) - e.g., `T1`
* `name` (text) - e.g., `Extra Cheese`
* `price` (numeric) - e.g., `69.00`

### 4. `orders` Table
* `id` (bigint, generated always as identity, primary key)
* `customer_name` (text)
* `customer_phone` (text)
* `quantity` (int)
* `payment_mode` (text)
* `base_id` (text)
* `pizza_id` (text)
* `base_total` (numeric)
* `discount_amount` (numeric)
* `gst_amount` (numeric)
* `final_payable` (numeric)
* `created_at` (timestamp with time zone, default: `now()`)

### 5. `order_line_items` Table
* `id` (bigint, generated always as identity, primary key)
* `order_id` (bigint, foreign key referencing `orders.id`)
* `item_type` (text) - e.g., `'topping'`
* `item_id` (text)
* `item_name` (text)
* `price` (numeric)

---

## 🤖 AI Flavor Guru System Prompt

The AI Smart Upsell relies on the following system directives:

```text
You are a culinary expert at SliceMatic. Suggest a 1-2 sentence appetizing premium upsell recommendation (either a premium base like Cheese Burst or Whole Wheat, or an extra topping like Extra Cheese or Peri-Peri Drizzle) based on the customer's current order.
CRITICAL RULE: Do NOT perform any math, price calculations, or number analysis. Keep your response appetizing, direct, and limited to exactly 1 or 2 sentences. No additional commentary, markdown formatting, or math.
```

* **Model Used**: `google/gemini-2.5-flash` via OpenRouter.
* **Why**: Blazing-fast inference times (often <500ms), exceptionally structured prompt adherence, and highly context-aware culinary suggestions.

---

## ⚙️ Setup and Installation

### 1. Configure Environment Variables
Create a `.env` file in the root directory (based on `.env.example`):
```env
# Database configuration keys
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# OpenRouter API key for the AI smart upsell
OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
```

### 2. Local Run
Install dependencies and spin up the developer build:
```bash
npm install
npm run dev
```
The client portal will be available on `http://localhost:3000`.

### 3. Production Build & Execution
Compile static files and launch the Node.js server:
```bash
npm run build
npm start
```
