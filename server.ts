import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isProd = process.env.NODE_ENV === 'production';
const port = process.env.PORT || 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // CORS Middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // AI Smart Upsell proxy calling OpenRouter Gemini 2.5 Flash
  app.post('/api/smart-upsell', async (req, res) => {
    try {
      const { cart } = req.body;
      const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;

      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.json({
          recommendation: "Upgrade to our Cheese Burst base for a rich, gooey crust experience or try our Peri-Peri Drizzle for a spicy kick!"
        });
      }

      const systemPrompt = `You are a culinary expert at SliceMatic. Suggest a 1-2 sentence appetizing premium upsell recommendation (either a premium base like Cheese Burst or Whole Wheat, or an extra topping like Extra Cheese or Peri-Peri Drizzle) based on the customer's current order.
CRITICAL RULE: Do NOT perform any math, price calculations, or number analysis. Keep your response appetizing, direct, and limited to exactly 1 or 2 sentences. No additional commentary, markdown formatting, or math.`;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://ai.studio/build',
          'X-Title': 'SliceMatic Client Portal',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `The customer has selected: Base: ${cart.base?.name || 'None'}, Pizza: ${cart.pizza?.name || 'None'}, Toppings: ${cart.toppings?.map((t: any) => t.name).join(', ') || 'None'}. Suggest a single specific premium base or extra topping to add.`
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API responded with status ${response.status}`);
      }

      const data = await response.json();
      const recommendation = data.choices?.[0]?.message?.content?.trim() || "Add a touch of Extra Cheese for the ultimate cheese pull!";
      res.json({ recommendation });
    } catch (error) {
      console.error('Error in smart-upsell endpoint:', error);
      // Fail silently or return default suggestion on error
      res.json({
        recommendation: "Add a touch of Extra Cheese for the ultimate cheese pull!",
        error: true
      });
    }
  });

  if (isProd) {
    // Serve production static assets
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Integrate Vite development server middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, () => {
    console.log(`[SliceMatic] Server is active on http://localhost:${port} (isProd: ${isProd})`);
  });
}

startServer().catch((err) => {
  console.error('[SliceMatic] Failed to start backend server:', err);
});
