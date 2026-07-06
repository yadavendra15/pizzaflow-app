import { MenuItem } from '../utils/supabaseClient';
import { ShoppingBag, Tag, ReceiptText, ShieldAlert } from 'lucide-react';

interface ReceiptProps {
  customerName: string;
  customerPhone: string;
  base: MenuItem | null;
  pizza: MenuItem | null;
  toppings: MenuItem[];
  quantity: number;
  paymentMode: string;
  isSubmitting?: boolean;
  isComplete?: boolean;
}

export default function Receipt({
  customerName,
  customerPhone,
  base,
  pizza,
  toppings,
  quantity,
  paymentMode,
  isSubmitting = false,
  isComplete = false
}: ReceiptProps) {
  
  // Math Engine
  const basePrice = base?.price || 0;
  const pizzaPrice = pizza?.price || 0;
  const toppingsPrice = toppings.reduce((sum, t) => sum + t.price, 0);
  
  const unitPrice = basePrice + pizzaPrice + toppingsPrice;
  const subtotal = unitPrice * quantity;
  
  // Apply 10% discount if Quantity >= 5
  const isDiscountEligible = quantity >= 5;
  const discountAmount = isDiscountEligible ? subtotal * 0.10 : 0;
  
  const postDiscountSubtotal = subtotal - discountAmount;
  const gstAmount = postDiscountSubtotal * 0.18;
  const finalPayable = postDiscountSubtotal + gstAmount;

  return (
    <div id="thermal-receipt" className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 flex flex-col relative overflow-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
      {/* Tape Header effect */}
      <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500" />

      {/* Title */}
      <div className="text-center pb-5 border-b border-dashed border-neutral-200">
        <div className="inline-flex items-center gap-1.5 text-neutral-800 font-extrabold tracking-tight text-lg">
          <ReceiptText className="w-5 h-5 text-neutral-600" />
          {isComplete ? 'SLICEMATIC INVOICE' : 'LIVE ESTIMATOR TICKET'}
        </div>
        <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono mt-1">
          {isComplete ? 'OFFICIAL BOOKING • STORE #0482' : 'DRAFT BUILD DETAILS • LIVE CAPTURE'}
        </p>
      </div>

      {/* Customer Intake & Metadata Details */}
      <div className="py-4 border-b border-dashed border-neutral-200 space-y-2 text-xs font-mono text-neutral-600">
        <div className="flex justify-between">
          <span>CUSTOMER:</span>
          <span className="font-bold text-neutral-800 uppercase truncate max-w-[160px]">
            {customerName.trim() || 'Not Registered'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>PHONE NO:</span>
          <span className="font-bold text-neutral-800">
            {customerPhone.trim() ? `+91 ${customerPhone}` : 'Not Registered'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>PAYMENT STATUS:</span>
          <span className={`font-bold uppercase ${isComplete ? 'text-emerald-600 font-extrabold' : 'text-amber-600'}`}>
            {isComplete 
              ? (paymentMode === 'Cash' ? 'DUE ON DELIVERY (CASH)' : `PAID VIA ${paymentMode}`)
              : `PENDING (${paymentMode || 'NOT SELECTED'})`}
          </span>
        </div>
      </div>

      {/* Itemised Bill */}
      <div className="py-4 border-b border-dashed border-neutral-200 flex-1 space-y-3">
        <span className="text-[10px] text-neutral-400 font-bold tracking-widest uppercase block font-mono">
          Itemised Details (per unit)
        </span>

        {base || pizza || toppings.length > 0 ? (
          <div className="space-y-2.5 font-mono text-xs">
            {/* Base Crust */}
            {base && (
              <div className="flex justify-between items-start text-neutral-700">
                <span className="max-w-[180px]">Crust ({base.name})</span>
                <span className="shrink-0 font-semibold">₹{base.price.toFixed(2)}</span>
              </div>
            )}

            {/* Pizza Recipe */}
            {pizza && (
              <div className="flex justify-between items-start text-neutral-700">
                <span className="max-w-[180px]">Style ({pizza.name})</span>
                <span className="shrink-0 font-semibold">₹{pizza.price.toFixed(2)}</span>
              </div>
            )}

            {/* Toppings Sublist */}
            {toppings.length > 0 && (
              <div className="space-y-1.5 pl-3 border-l-2 border-neutral-100">
                <div className="text-[10px] text-neutral-400 uppercase font-bold">Toppings:</div>
                {toppings.map((topping) => (
                  <div key={topping.id} className="flex justify-between text-neutral-600 text-[11px]">
                    <span className="truncate max-w-[160px]">+ {topping.name}</span>
                    <span className="shrink-0">₹{topping.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Single Unit Summation */}
            <div className="pt-2 border-t border-dashed border-neutral-100 flex justify-between text-neutral-500 text-[11px]">
              <span>Unit Rate</span>
              <span>₹{unitPrice.toFixed(2)}</span>
            </div>

            {/* Quantity multiplier */}
            <div className="flex justify-between text-neutral-700 font-bold bg-neutral-50 p-2 rounded-lg">
              <span className="flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5 text-neutral-500" />
                Quantity
              </span>
              <span>× {quantity}</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-neutral-400 text-xs italic">
            Select items to view invoice breakdown
          </div>
        )}
      </div>

      {/* Bill summary and calculations */}
      {base && pizza ? (
        <div className="pt-4 space-y-2.5 font-mono text-xs">
          <div className="flex justify-between text-neutral-600">
            <span>Subtotal:</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>

          {/* Automatic 10% Discount HUD line */}
          {isDiscountEligible ? (
            <div className="flex justify-between text-emerald-600 font-semibold bg-emerald-50 px-2 py-1.5 rounded-lg border border-dashed border-emerald-200">
              <span className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-emerald-500" />
                10% Multi-pizza Offer:
              </span>
              <span>- ₹{discountAmount.toFixed(2)}</span>
            </div>
          ) : quantity > 1 && (
            <div className="text-[10px] text-neutral-400 italic text-right flex items-center justify-end gap-1">
              <ShieldAlert className="w-3 h-3" /> Add {5 - quantity} more pizzas for 10% discount!
            </div>
          )}

          <div className="flex justify-between text-neutral-600">
            <span>Post-discount Subtotal:</span>
            <span>₹{postDiscountSubtotal.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-neutral-500">
            <span>GST Added (18%):</span>
            <span>₹{gstAmount.toFixed(2)}</span>
          </div>

          {/* final total banner */}
          <div className="pt-3 border-t-2 border-dashed border-neutral-200 flex justify-between text-neutral-900 font-extrabold text-base">
            <span>GRAND TOTAL:</span>
            <span className="text-orange-600 font-mono">₹{finalPayable.toFixed(2)}</span>
          </div>
        </div>
      ) : (
        <div className="pt-4 text-center border-t border-dashed border-neutral-150 py-3">
          <p className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider font-mono">
            Awaiting Pizza Selection
          </p>
          <p className="text-[10px] text-neutral-400 mt-1">
            Calculations will update once crust & recipe are configured in Step 2.
          </p>
        </div>
      )}

      {/* Footer message / validation warn */}
      <div className="text-center pt-5 mt-4 border-t border-neutral-100">
        <span className="text-[10px] text-neutral-400 font-semibold tracking-wider font-mono">
          {isComplete ? '★ THANK YOU FOR DINING AT SLICEMATIC ★' : '• SESSION SYNCHRONISED IN REAL-TIME •'}
        </span>
      </div>
    </div>
  );
}
