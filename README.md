# SliceMatic Client Portal, Admin Panel & Operations Center

SliceMatic is a premium, full-stack, production-grade pizza ordering client portal and real-time admin audit application. This solution replaces traditional manual order-taking Google Forms with an automated, responsive interface featuring a live visual canvas, precise mathematical billing engines, instant digital sharing, and an AI-powered smart upselling agent.

---

## 🏗️ Architecture Overview

The application is structured as a full-stack, decoupled architecture designed for high availability, zero latency bottlenecks, and real-time state synchronization:

```
+--------------------------------------------------------------+
|                     React Client Portal                      |
| (Intake Validation, Live Canvas, Config Sync, QR Transfer)  |
+------------------------------+-------------------------------+
                               |
            +------------------+------------------+
            |                                     |
            v                                     v
+-----------------------+              +-----------------------+
|   Supabase Database   |              |  Gemini AI (via API)  |
| (PostgreSQL, Schemas, |              | (Smart Upsell Prompt, |
|  Configurations Sync) |              |  2s Interceptor Cut)  |
+-----------------------+              +-----------------------+
```

1. **Frontend Layer (React 18 & Vite)**:
   - High-fidelity visual styling using utility-first **Tailwind CSS**.
   - Dynamic, organic micro-interactions and layout transitions powered by `motion`.
   - Complete multi-stage form flow spanning Customer Intake, Pizza Builder (Canvas & Topping offsets), Checkout Summary, and QR Transfer.

2. **Database & Sync Layer (Supabase Serverless)**:
   - Fully relational schema managed via PostgreSQL tables.
   - Dual-Fetch fallback system: if Supabase configurations are missing or offline, details are seamlessly retrieved and stored locally using client-side `localStorage`, ensuring zero client crash rates.
   - Real-time global settings synchronization: the operations configurations (e.g., dynamic discount pizza threshold) are fetched directly from a database-backed `configurations` table.

3. **AI Integration Layer (OpenRouter / Google Gemini)**:
   - Calls the `google/gemini-2.5-flash` model asynchronously.
   - Guarded with an `AbortController` timeout interceptor: if the model call takes longer than 2000ms, the portal silently displays appetizing local fallback defaults so as to never delay customer checkouts.

---

## 🤖 AI Feature Description: "AI Flavor Guru"

### Problem Solved
Rajan's counter staff often forget to upsell premium additions (like changing a regular base to *Cheese Burst* or adding an extra topping like *Extra Cheese*), losing out on high-margin revenue.

### How it Works
The client portal watches the customer's base, pizza, and topping selections in real time. Before checkout, it invokes the **AI Flavor Guru**, which analyzes current ingredients to formulate a context-aware, appetizing recommendation.

### System Prompt
```text
You are a culinary expert at SliceMatic. Suggest a 1-2 sentence appetizing premium upsell recommendation (either a premium base like Cheese Burst or Whole Wheat, or an extra topping like Extra Cheese or Peri-Peri Drizzle) based on the customer's current order.
CRITICAL RULE: Do NOT perform any math, price calculations, or number analysis. Keep your response appetizing, direct, and limited to exactly 1 or 2 sentences. No additional commentary, markdown formatting, or math.
```

### Model Choice & Justification
- **Model**: `google/gemini-2.5-flash`
- **Why**: 
  - **Sub-second latency**: Ideal for responsive customer-facing interfaces.
  - **Exceptional instruction adherence**: Strictly follows negative constraints (e.g., avoiding mathematical speculation/markdown formatting).
  - **Context-aware culinary intelligence**: Consistently yields natural-sounding, tempting, and relevant topping combinations.

---

## 🛠️ Complete Supabase SQL Setup Script

Execute the following SQL script directly in your **Supabase SQL Editor** to establish the required tables and seed the menu items and initial configurations:

```sql
-- 1. Create Bases Table
CREATE TABLE IF NOT EXISTS bases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL
);

-- 2. Create Pizzas Table
CREATE TABLE IF NOT EXISTS pizzas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL
);

-- 3. Create Toppings Table
CREATE TABLE IF NOT EXISTS toppings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL
);

-- 4. Create Configurations Table (For Real-Time Admin Settings)
CREATE TABLE IF NOT EXISTS configurations (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  quantity INT NOT NULL,
  payment_mode TEXT NOT NULL,
  base_id TEXT,
  pizza_id TEXT,
  base_total NUMERIC(10, 2) NOT NULL,
  discount_amount NUMERIC(10, 2) NOT NULL,
  gst_amount NUMERIC(10, 2) NOT NULL,
  final_payable NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create Order Line Items Table (For Toppings breakdowns)
CREATE TABLE IF NOT EXISTS order_line_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- 'topping'
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL
);

-- ==========================================
-- SEED DATA (Direct from Stage 2 Data Files)
-- ==========================================

-- Seed Bases
INSERT INTO bases (id, name, price) VALUES
('B1', 'Thin Crust', 149.00),
('B2', 'Thick Crust', 179.00),
('B3', 'Cheese Burst', 229.00),
('B4', 'Whole Wheat', 159.00),
('B5', 'Multigrain', 169.00)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price;

-- Seed Pizzas
INSERT INTO pizzas (id, name, price) VALUES
('P1', 'Margherita', 299.00),
('P2', 'Chicago Deep Dish', 349.00),
('P3', 'Greek Mediterranean', 329.00),
('P4', 'California Veggie', 339.00),
('P5', 'Farm House', 319.00),
('P6', 'Pepperoni Classic', 369.00),
('P7', 'BBQ Chicken', 379.00),
('P8', 'Paneer Tikka', 349.00)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price;

-- Seed Toppings
INSERT INTO toppings (id, name, price) VALUES
('T1', 'Black Olives', 49.00),
('T2', 'Extra Cheese', 69.00),
('T3', 'Button Mushrooms', 49.00),
('T4', 'Green Peppers', 39.00),
('T5', 'Jalapenos', 39.00),
('T6', 'Sun-Dried Tomatoes', 59.00),
('T7', 'Caramelised Onions', 49.00),
('T8', 'Sweet Corn', 39.00),
('T9', 'Roasted Garlic', 49.00),
('T10', 'Peri-Peri Drizzle', 59.00)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price;

-- Seed Initial Global Configurations
INSERT INTO configurations (key, value) VALUES
('discount_threshold', '5')
ON CONFLICT (key) DO NOTHING;
```

---

## ⚙️ Setup & Local Installation

### 1. Configure Environment Variables
Create a `.env` file in your root workspace (or configure the deployment secrets via your hosting provider, such as Vercel/Cloud Run):

```env
# Supabase Database Keys
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-string

# AI Upsell API Configuration
OPENROUTER_API_KEY=your-openrouter-api-key-string
```

### 2. Install & Start Development Server
Ensure all node modules are configured, then spin up the fast Vite live server:
```bash
npm install
npm run dev
```
- Open `http://localhost:3000` to view the application.

### 3. Build for Production Deployment
To package the app cleanly for live hosting platforms (Vercel, Netlify, or direct container runtimes):
```bash
npm run build
npm start
```
All static pages are compiled into `/dist` while the backend Express proxy initializes via `server.ts`.

---

## 📊 Operations & Live Admin View

The Operations Dashboard (accessible via the client layout using credentials `admin@slicematic.com` / password `admin`) allows live counter auditing:
- **Order Entry Desk**: Enables floor staff to seamlessly submit custom walk-in bookings.
- **Analytics View**: Visualizes order distributions, topping favorites, peak checkouts, and historical revenues.
- **Configurations (Sync)**: A dedicated live dashboard to modify restaurant settings. Counter managers can increase or decrease the global **Discount Pizza Threshold** (e.g., from 5 pizzas to 3 pizzas) in a single click, instantly syncing the mathematical billing parameters for all live tablet customers.

---

## 📦 Stage 3 Deliverables Checklist
- **Production URL**: *(Insert Deployed Vercel/Cloud Run URL here)*
- **Supabase DB Status**: Live & configured with SQL schemas + configurations key.
- **System Video Walkthrough**: *(Insert Loom/Screen-share Video Link here)*
