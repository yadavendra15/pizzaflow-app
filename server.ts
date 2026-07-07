import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';

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

  // AI Smart Upsell proxy calling OpenRouter or Google GenAI SDK
  app.post('/api/smart-upsell', async (req, res) => {
    try {
      const { cart, availableBases, availableToppings } = req.body;
      const openRouterKey = process.env.OPENROUTER_API_KEY;
      const geminiKey = process.env.GEMINI_API_KEY;

      // Safe fallback recommendations based on pizza style
      const getFallbackRecommendation = () => {
        const primaryItem = Array.isArray(cart) ? cart[0] : cart;
        if (!primaryItem) {
          return {
            explanation: "Complete your pizza masterpiece with a premium Cheese Burst base and Extra Cheese!",
            recommendedBaseId: "B3",
            recommendedToppingIds: ["T2"]
          };
        }
        const toppingsList = primaryItem.toppings || [];
        const hasExtraCheese = toppingsList.some((t: any) => t.id === 'T2');
        const hasPeriPeri = toppingsList.some((t: any) => t.id === 'T10');
        const isThinCrust = primaryItem.base?.id === 'B1';

        if (isThinCrust) {
          return {
            explanation: "To match the airy texture of your pizza, we suggest upgrading to our Cheese Burst (B3) base and throwing in some Caramelised Onions (T7) for a touch of sweetness!",
            recommendedBaseId: "B3",
            recommendedToppingIds: ["T7"]
          };
        } else if (!hasExtraCheese) {
          return {
            explanation: "Enhance your current selection by layering a rich coat of Extra Cheese (T2) for that perfect, gooey gourmet stretch!",
            recommendedBaseId: null,
            recommendedToppingIds: ["T2"]
          };
        } else if (!hasPeriPeri) {
          return {
            explanation: "Kick the temperature up a notch with a Peri-Peri Drizzle (T10) to complement those savory, hot-fired crust edges!",
            recommendedBaseId: null,
            recommendedToppingIds: ["T10"]
          };
        } else {
          return {
            explanation: "Complete your culinary creation with caramelized Button Mushrooms (T3) for a deep, earthy rustic undertone!",
            recommendedBaseId: null,
            recommendedToppingIds: ["T3"]
          };
        }
      };

      // Compile dynamic list of valid bases and toppings
      let basesStr = "B1 (Thin Crust), B2 (Thick Crust), B3 (Cheese Burst), B4 (Whole Wheat), B5 (Multigrain)";
      let toppingsStr = "T1 (Black Olives), T2 (Extra Cheese), T3 (Button Mushrooms), T4 (Green Peppers), T5 (Jalapenos), T6 (Sun-Dried Tomatoes), T7 (Caramelised Onions), T8 (Sweet Corn), T9 (Roasted Garlic), T10 (Peri-Peri Drizzle)";
      let premiumBasesStr = "B3, B4, B5";

      if (Array.isArray(availableBases) && availableBases.length > 0) {
        basesStr = availableBases.map((b: any) => `${b.id} (${b.name})`).join(', ');
        const sortedBases = [...availableBases].sort((a: any, b: any) => Number(a.price || 0) - Number(b.price || 0));
        const premiumBases = sortedBases.slice(Math.ceil(sortedBases.length / 2));
        premiumBasesStr = premiumBases.map((b: any) => b.id).join(', ');
      }
      if (Array.isArray(availableToppings) && availableToppings.length > 0) {
        toppingsStr = availableToppings.map((t: any) => `${t.id} (${t.name})`).join(', ');
      }

      const systemPrompt = `You are a culinary expert at SliceMatic. Analyze the customer's pizza order and recommend:
1. A premium base upgrade if their current base is a low-priced base. Choose from these premium bases: [${premiumBasesStr}]
2. 1 or 2 extra toppings that pair perfectly with their pizza. Only suggest from the available toppings list, and only suggest toppings they haven't already selected.

Rules:
- Keep the explanation highly appetizing, friendly, and limited to exactly 1 or 2 sentences (under 25 words).
- If they already have a premium base, set recommendedBaseId to null.
- Available Bases: ${basesStr}
- Available Toppings: ${toppingsStr}`;

      let formattedSelections = "";
      if (Array.isArray(cart)) {
        if (cart.length === 0) {
          formattedSelections = "None (empty cart)";
        } else {
          formattedSelections = cart.map((item: any, idx: number) => {
            return `Pizza ${idx + 1}: ${item.quantity || 1}x ${item.pizza?.name || 'Pizza'} (Base: ${item.base?.name || 'Thin'}, Toppings: ${item.toppings?.map((t: any) => t.name).join(', ') || 'None'})`;
          }).join('\n');
        }
      } else if (cart) {
        formattedSelections = `Base: ${cart.base?.name || 'None'} (ID: ${cart.base?.id || 'None'}), Pizza: ${cart.pizza?.name || 'None'} (ID: ${cart.pizza?.id || 'None'}), Toppings: ${cart.toppings?.map((t: any) => `${t.name} (${t.id})`).join(', ') || 'None'}`;
      } else {
        formattedSelections = "None";
      }

      let parsed: any = null;

      // Check if OpenRouter key is configured
      if (openRouterKey && openRouterKey !== "MY_OPENROUTER_API_KEY" && openRouterKey.trim() !== "") {
        console.log('[SliceMatic] Calling OpenRouter API with OPENROUTER_API_KEY...');
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openRouterKey}`,
            'HTTP-Referer': 'https://ai.studio/build',
            'X-Title': 'SliceMatic Client Portal',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: `${systemPrompt}\n\nYou MUST respond ONLY with a valid JSON object in this exact format:
{
  "explanation": "A warm, 1-2 sentence appetizing description of your gourmet recommendation.",
  "recommendedBaseId": "B3" or null,
  "recommendedToppingIds": ["T1", "T2"] or []
}`
              },
              {
                role: 'user',
                content: `The customer has selected the following items in their order:\n${formattedSelections}\n\nSuggest a single premium base upgrade or extra toppings pairing that perfectly matches these items as a general up-sell recommendation.`
              }
            ]
          })
        });

        if (!response.ok) {
          throw new Error(`OpenRouter API responded with status ${response.status}`);
        }

        const data: any = await response.json();
        let content = data.choices?.[0]?.message?.content?.trim() || "";

        // Strip markdown code block backticks if present
        if (content.startsWith("```json")) {
          content = content.substring(7);
        } else if (content.startsWith("```")) {
          content = content.substring(3);
        }
        if (content.endsWith("```")) {
          content = content.substring(0, content.length - 3);
        }
        content = content.trim();
        parsed = JSON.parse(content);
      } 
      // Fallback to Google GenAI SDK if GEMINI_API_KEY is configured
      else if (geminiKey && geminiKey !== "MY_GEMINI_API_KEY" && geminiKey.trim() !== "") {
        console.log('[SliceMatic] Calling Google GenAI SDK with GEMINI_API_KEY...');
        const aiClient = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });

        const response = await aiClient.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: `The customer has selected the following items in their order:\n${formattedSelections}\n\nSuggest a single premium base upgrade (B3, B4, B5) or extra toppings pairing that perfectly matches these items as a general up-sell recommendation.`,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                explanation: {
                  type: Type.STRING,
                  description: "A warm, 1-2 sentence appetizing description of your gourmet recommendation."
                },
                recommendedBaseId: {
                  type: Type.STRING,
                  description: "The ID of the recommended base crust to upgrade to, or null if no upgrade is recommended."
                },
                recommendedToppingIds: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "A list of 1 or 2 recommended topping IDs that pair perfectly with their pizza."
                }
              },
              required: ["explanation", "recommendedBaseId", "recommendedToppingIds"]
            }
          }
        });

        let content = response.text || "";
        try {
          parsed = JSON.parse(content);
        } catch (parseErr) {
          console.warn('[SliceMatic] Failed to parse JSON from Google GenAI SDK, using fallback extraction');
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            throw parseErr;
          }
        }
      } 
      // Local fallback recommendation if no key is configured
      else {
        console.warn('[SliceMatic] No valid API keys found in env, triggering high-fidelity local fallback.');
        parsed = getFallbackRecommendation();
      }

      const recBase = (parsed.recommendedBaseId === 'null' || parsed.recommendedBaseId === '') ? null : parsed.recommendedBaseId;

      res.json({
        recommendation: parsed.explanation,
        explanation: parsed.explanation,
        recommendedBaseId: recBase || null,
        recommendedToppingIds: parsed.recommendedToppingIds || []
      });
    } catch (error) {
      console.error('Error in smart-upsell endpoint:', error);
      // Fail silently or return default suggestion on error to protect UX
      const fb = {
        explanation: "Upgrade to our premium Cheese Burst (B3) base and add Extra Cheese (T2) for the absolute ultimate flavor pull!",
        recommendedBaseId: "B3",
        recommendedToppingIds: ["T2"]
      };
      res.json({
        recommendation: fb.explanation,
        explanation: fb.explanation,
        recommendedBaseId: fb.recommendedBaseId,
        recommendedToppingIds: fb.recommendedToppingIds,
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
