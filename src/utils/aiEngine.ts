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
  // Safe local fallback recommendations in case the backend or API keys are unavailable
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

  try {
    const response = await fetch('/api/smart-upsell', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cart,
        availableBases,
        availableToppings,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return {
      explanation: data.explanation || data.recommendation || "A delicious addition for your personalized pie!",
      recommendedBaseId: data.recommendedBaseId || null,
      recommendedToppingIds: data.recommendedToppingIds || []
    };
  } catch (error) {
    console.error('Error in client-side fetchSmartUpsell:', error);
    return getFallbackRecommendation();
  }
}
