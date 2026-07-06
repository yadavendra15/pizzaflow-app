import { MenuItem, CartItem } from '../utils/supabaseClient';
import { ShoppingBag, Tag, ReceiptText, ShieldAlert } from 'lucide-react';

interface ReceiptProps {
  customerName: string;
  customerPhone: string;
  cart: CartItem[];
  paymentMode: string;
  discountThreshold: number;
  isSubmitting?: boolean;
  isComplete?: boolean;
}

export default function Receipt({
  customerName,
  customerPhone,
  cart = [],
  paymentMode,
  discountThreshold = 5,
  isSubmitting = false,
  isComplete = false
}: ReceiptProps) {
  
  // Math Engine
  const subtotal = cart.reduce((sum, item) => {
    const itemUnitRate = item.base.price + item.pizza.price + item.toppings.reduce((tsum, t) => tsum + t.price, 0);
    return sum + (itemUnitRate * item.quantity);
  }, 0);

  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  // Apply 10% discount if total quantity >= discountThreshold
  const isDiscountEligible = totalQuantity >= discountThreshold && totalQuantity > 0;
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
          Itemised Cart Details
        </span>

        {cart && cart.length > 0 ? (
          <div className="space-y-4 font-mono text-xs">
            {cart.map((item, idx) => {
              const itemUnitRate = item.base.price + item.pizza.price + item.toppings.reduce((tsum, t) => tsum + t.price, 0);
              const itemTotal = itemUnitRate * item.quantity;
              return (
                <div key={item.id || idx} className="border-b border-neutral-100/40 pb-3 last:border-none last:pb-0">
                  <div className="flex justify-between items-start text-neutral-800 font-bold">
                    <span className="max-w-[200px]">{item.pizza.name} × {item.quantity}</span>
                    <span className="shrink-0 font-mono">₹{itemTotal.toFixed(2)}</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">
                    Crust: {item.base.name} (Unit: ₹{itemUnitRate.toFixed(2)})
                  </div>
                  {item.toppings.length > 0 && (
                    <div className="space-y-0.5 pl-2.5 mt-1 border-l border-neutral-200 text-neutral-500 text-[10px]">
                      {item.toppings.map((topping) => (
                        <div key={topping.id} className="flex justify-between">
                          <span>+ {topping.name}</span>
                          <span>₹{(topping.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Total Quantity badge */}
            <div className="flex justify-between text-neutral-700 font-bold bg-neutral-50 p-2 rounded-lg mt-2">
              <span className="flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5 text-neutral-500" />
                Total Pizza Count
              </span>
              <span>× {totalQuantity}</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-neutral-400 text-xs italic">
            Select items to view invoice breakdown
          </div>
        )}
      </div>

      {/* Bill summary and calculations */}
      {cart && cart.length > 0 ? (
        <div className="pt-4 space-y-2.5 font-mono text-xs">
          <div className="flex justify-between text-neutral-600">
            <span>Subtotal:</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>

          {/* Automatic Multi-Pizza Discount HUD line */}
          {isDiscountEligible ? (
            <div className="flex justify-between text-emerald-600 font-semibold bg-emerald-50 px-2 py-1.5 rounded-lg border border-dashed border-emerald-200">
              <span className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-emerald-500" />
                10% Multi-pizza Offer:
              </span>
              <span>- ₹{discountAmount.toFixed(2)}</span>
            </div>
          ) : totalQuantity > 0 && (
            <div className="text-[10px] text-neutral-400 italic text-right flex items-center justify-end gap-1">
              <ShieldAlert className="w-3 h-3 text-amber-500" /> Add {discountThreshold - totalQuantity} more pizzas for 10% discount!
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
            Awaiting Cart Selections
          </p>
          <p className="text-[10px] text-neutral-400 mt-1">
            Configure pizzas in Step 2 and add them to your cart.
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
