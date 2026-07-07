import { GoogleGenAI, Type } from '@google/genai';

export interface CartState {
  base: { id: string; name: string; price: number } | null;
  pizza: { id: string; name: string; price: number } | null;
  toppings: Array<{ id: string; name: string; price: number }>;
}

export interface GuruRecommendation {
  explanation: string;
  recommendedBaseId: string | null;
  recommendedToppingIds: string[];
}

export async function fetchSmartUpsell(
  cart: CartState,
  availableBases?: Array<{ id: string; name: string; price: number }>,
  availableToppings?: Array<{ id: string; name: string; price: number }>
): Promise<GuruRecommendation> {
  const openRouterKey = (process.env.OPENROUTER_API_KEY || '').trim();
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();

  // Safe fallback recommendations based on pizza style
  const getFallbackRecommendation = () => {
    const pizzaName = cart.pizza?.name || "";
    if (pizzaName.toLowerCase().includes('pepperoni') || pizzaName.toLowerCase().includes('chicken')) {
      return {
        explanation: "Enhance your savory meat toppings with extra Cheese (T2) and Button Mushrooms (T3) for the perfect umami pairing!",
        recommendedBaseId: null,
        recommendedToppingIds: ["T2", "T3"]
      };
    } else if (pizzaName.toLowerCase().includes('veg') || pizzaName.toLowerCase().includes('farm') || pizzaName.toLowerCase().includes('greek')) {
      return {
        explanation: "Upgrade to a premium Cheese Burst (B3) base to perfectly balance your crisp, garden-fresh garden toppings!",
        recommendedBaseId: "B3",
        recommendedToppingIds: ["T1"]
      };
    } else {
      return {
        explanation: "Upgrade to our premium Cheese Burst (B3) crust and add sweet caramelized onions for an unforgettable melt!",
        recommendedBaseId: "B3",
        recommendedToppingIds: ["T7"]
      };
    }
  };

  // Compile dynamic list of valid bases and toppings
  const basesStr = (availableBases || [
    { id: 'B1', name: 'Thin Crust', price: 149.00 },
    { id: 'B2', name: 'Thick Crust', price: 179.00 },
    { id: 'B3', name: 'Cheese Burst', price: 229.00 },
    { id: 'B4', name: 'Whole Wheat', price: 159.00 },
    { id: 'B5', name: 'Multigrain', price: 169.00 }
  ]).map(b => `${b.id} (${b.name})`).join(', ');

  const toppingsStr = (availableToppings || [
    { id: 'T1', name: 'Black Olives', price: 49.00 },
    { id: 'T2', name: 'Extra Cheese', price: 69.00 },
    { id: 'T3', name: 'Button Mushrooms', price: 49.00 },
    { id: 'T4', name: 'Green Peppers', price: 49.00 },
    { id: 'T5', name: 'Jalapenos', price: 49.00 },
    { id: 'T6', name: 'Sun-Dried Tomatoes', price: 59.00 },
    { id: 'T7', name: 'Caramelised Onions', price: 49.00 },
    { id: 'T8', name: 'Sweet Corn', price: 49.00 },
    { id: 'T9', name: 'Roasted Garlic', price: 49.00 },
    { id: 'T10', name: 'Peri-Peri Drizzle', price: 39.00 }
  ]).map(t => `${t.id} (${t.name})`).join(', ');

  const systemPrompt = `You are the ultimate Pizza AI Flavor Guru. Based on the customer's current cart selection, recommend a premium crust upgrade or high-pairing toppings to make their meal gourmet.
  
You can recommend:
1. A premium base upgrade if their current base is a low-priced base. Choose from these premium bases: [B3 (Cheese Burst), B4 (Whole Wheat), B5 (Multigrain)]
2. 1 or 2 extra toppings that pair perfectly with their pizza. Only suggest from the available toppings list, and only suggest toppings they haven't already selected.

Rules:
- Keep the explanation highly appetizing, friendly, and limited to exactly 1 or 2 sentences (under 25 words).
- If they already have a premium base, set recommendedBaseId to null.
- Available Bases: ${basesStr}
- Available Toppings: ${toppingsStr}`;

  let formattedSelections = "";
  if (cart) {
    if (cart.pizza) formattedSelections += `- Pizza Style: ${cart.pizza.name}\n`;
    if (cart.base) formattedSelections += `- Crust Base: ${cart.base.name}\n`;
    if (cart.toppings && cart.toppings.length > 0) {
      formattedSelections += `- Selected Toppings: ${cart.toppings.map(t => t.name).join(', ')}\n`;
    }
  } else {
    formattedSelections = "None";
  }

  const promptContent = `The customer has selected the following items in their order:\n${formattedSelections}\n\nSuggest a single premium base upgrade or extra toppings pairing that perfectly matches these items as a general up-sell recommendation.`;

  try {
    let parsed: any = null;

    // 1. Prioritize OpenRouter API if key is available
    if (openRouterKey && openRouterKey !== "MY_OPENROUTER_API_KEY" && openRouterKey !== "") {
      console.log('[SliceMatic] Direct client-side call to OpenRouter with OPENROUTER_API_KEY...');
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
              content: promptContent
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API responded with status ${response.status}`);
      }

      const data = await response.json();
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
    // 2. Fallback to Google GenAI SDK if GEMINI_API_KEY is available
    else if (geminiKey && geminiKey !== "MY_GEMINI_API_KEY" && geminiKey !== "") {
      console.log('[SliceMatic] Direct client-side call to Google GenAI with GEMINI_API_KEY...');
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
        contents: promptContent,
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
      parsed = JSON.parse(content);
    }
    // 3. Fallback to smart local recommendation
    else {
      console.warn('[SliceMatic] No real API keys configured for client-side AI. Using smart local fallback.');
      parsed = getFallbackRecommendation();
    }

    const recBase = (parsed.recommendedBaseId === 'null' || parsed.recommendedBaseId === '') ? null : parsed.recommendedBaseId;

    return {
      explanation: parsed.explanation || "A delicious addition for your personalized pie!",
      recommendedBaseId: recBase || null,
      recommendedToppingIds: parsed.recommendedToppingIds || []
    };
  } catch (error) {
    console.error('Error in client-side fetchSmartUpsell:', error);
    return getFallbackRecommendation();
  }
}
