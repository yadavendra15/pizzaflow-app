/**
 * AI Flavor Guru Client Engine
 * Safely calls server-side upsell proxy with AbortController and strict 2s timeout
 */

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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    console.warn('[SliceMatic] AI Upsell request aborted due to 2-second timeout limit.');
  }, 2000);

  try {
    const response = await fetch('/api/smart-upsell', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({ cart, availableBases, availableToppings }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    return {
      explanation: data.explanation || data.recommendation || "Upgrade to our Cheese Burst base for a rich, gooey crust experience!",
      recommendedBaseId: data.recommendedBaseId || null,
      recommendedToppingIds: data.recommendedToppingIds || []
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn('[SliceMatic] AI Smart Upsell failed or timed out. Proceeding to checkout silently.', err);
    // Silent fallback to standard appetizing recommendation
    return {
      explanation: "Complete your masterpiece with an upgrade to Cheese Burst base or a sprinkle of extra toppings!",
      recommendedBaseId: "B3",
      recommendedToppingIds: ["T2"]
    };
  }
}
