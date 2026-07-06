import { motion, AnimatePresence } from 'motion/react';
import { MenuItem } from '../utils/supabaseClient';

interface PizzaVisualizerProps {
  base: MenuItem | null;
  pizza: MenuItem | null;
  toppings: MenuItem[];
}

export default function PizzaVisualizer({ base, pizza, toppings }: PizzaVisualizerProps) {
  // Map toppings to static coordinates for aesthetic placement on the circular canvas
  const getToppingPositions = (toppingId: string) => {
    // Return an array of x,y coordinates relative to a central circular space
    const baseCoords = [
      { top: '25%', left: '30%', rotate: 12 },
      { top: '35%', left: '65%', rotate: -45 },
      { top: '55%', left: '25%', rotate: 80 },
      { top: '65%', left: '55%', rotate: -15 },
      { top: '45%', left: '45%', rotate: 110 },
      { top: '20%', left: '50%', rotate: 50 },
      { top: '70%', left: '35%', rotate: -90 },
    ];
    
    // Seed positions using unique coordinates for each topping category
    const seed = toppingId.charCodeAt(1) || 0;
    return baseCoords.map((coord, idx) => {
      const offsetTop = ((seed + idx * 13) % 15) - 7.5;
      const offsetLeft = ((seed + idx * 23) % 15) - 7.5;
      return {
        top: `calc(${coord.top} + ${offsetTop}px)`,
        left: `calc(${coord.left} + ${offsetLeft}px)`,
        rotate: coord.rotate + (seed % 30),
      };
    });
  };

  // Get topping representation details
  const getToppingVisual = (id: string) => {
    switch (id) {
      case 'T1': return { color: 'bg-neutral-900 border border-neutral-800', label: '🫒', name: 'Black Olives' };
      case 'T2': return { color: 'bg-yellow-100 border border-yellow-200 shadow-sm', label: '🧀', name: 'Extra Cheese' };
      case 'T3': return { color: 'bg-amber-100 border border-amber-200', label: '🍄', name: 'Button Mushrooms' };
      case 'T4': return { color: 'bg-green-600', label: '🫑', name: 'Green Peppers' };
      case 'T5': return { color: 'bg-green-700', label: '🌶️', name: 'Jalapenos' };
      case 'T6': return { color: 'bg-red-800', label: '🍅', name: 'Sun-Dried Tomatoes' };
      case 'T7': return { color: 'bg-amber-300 opacity-80', label: '🧅', name: 'Caramelised Onions' };
      case 'T8': return { color: 'bg-yellow-400', label: '🌽', name: 'Sweet Corn' };
      case 'T9': return { color: 'bg-yellow-200', label: '🧄', name: 'Roasted Garlic' };
      case 'T10': return { color: 'bg-amber-600', label: '🌶️🔥', name: 'Peri-Peri Drizzle' };
      default: return { color: 'bg-red-500', label: '🍕', name: 'Topping' };
    }
  };

  // Get base color theme based on selection
  const getBaseStyle = () => {
    switch (base?.id) {
      case 'B1': return { bg: 'bg-amber-200 border-amber-400', text: 'Thin Crust' };
      case 'B2': return { bg: 'bg-amber-300 border-amber-500 shadow-lg', text: 'Thick Crust' };
      case 'B3': return { bg: 'bg-yellow-300 border-yellow-500 shadow-md ring-4 ring-yellow-200/50', text: 'Cheese Burst' };
      case 'B4': return { bg: 'bg-amber-600/30 border-amber-700/50', text: 'Whole Wheat' };
      case 'B5': return { bg: 'bg-stone-500/20 border-stone-600/40', text: 'Multigrain' };
      default: return { bg: 'bg-amber-100/40 border-amber-300 border-dashed', text: 'No Crust Selected' };
    }
  };

  // Get sauce/cheese overlay based on selected pizza recipe
  const getPizzaOverlayStyle = () => {
    switch (pizza?.id) {
      case 'P1': // Margherita - Simple golden cheese, red sauce trim, basil leaves
        return { bg: 'bg-yellow-400/90 border-red-500', label: 'Margherita Sauce', details: '🧀 Golden Mozzarella & Red Marinara Base' };
      case 'P2': // Chicago Deep Dish - Extra deep red chunky tomato sauce
        return { bg: 'bg-red-700 border-amber-600 ring-2 ring-red-400/30', label: 'Chunky Sauce', details: '🍅 Deep Dish Chunky San Marzano Sauce Layer' };
      case 'P3': // Greek Mediterranean - Olive oil, white feta spots
        return { bg: 'bg-yellow-100/80 border-emerald-500 ring-1 ring-emerald-200', label: 'Feta & Pesto', details: '🫒 Olive Oil, Crumble Feta & Emerald Herbs' };
      case 'P4': // California Veggie - Vibrant garden herb base
        return { bg: 'bg-green-100/95 border-green-500', label: 'Garden Base', details: '🌱 California Garden Herb Spread' };
      case 'P5': // Farm House - Classic farm-style cheese and herb
        return { bg: 'bg-yellow-300/90 border-orange-500', label: 'Farm Spread', details: '🥛 House Special Cheese Cream & Marinara' };
      case 'P6': // Pepperoni Classic - Pepperoni visual cue
        return { bg: 'bg-yellow-400 border-red-600 shadow-inner', label: 'Pepperoni Base', details: '🥓 Crispy Golden Cheese Base' };
      case 'P7': // BBQ Chicken - BBQ drizzle look
        return { bg: 'bg-amber-800/85 border-amber-950', label: 'BBQ Blend', details: '🍖 Smokey Sweet BBQ & Cheddar Blend' };
      case 'P8': // Paneer Tikka - Spicy orange tikka gravy base
        return { bg: 'bg-orange-400/90 border-orange-600', label: 'Tikka Spread', details: '🔥 Spicy Orange Tikka Gravy Layer' };
      default:
        return null;
    }
  };

  const baseStyle = getBaseStyle();
  const pizzaOverlay = getPizzaOverlayStyle();

  return (
    <div id="pizza-visualizer-card" className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 flex flex-col items-center justify-center relative overflow-hidden h-[360px] md:h-[400px]">
      <div className="absolute top-4 left-4 z-10">
        <span className="text-xs font-semibold bg-neutral-900 text-amber-400 px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
          Pizza Visualizer
        </span>
      </div>

      <div className="relative w-64 h-64 md:w-72 md:h-72 flex items-center justify-center">
        {/* Outer board/shadow */}
        <div className="absolute inset-0 rounded-full bg-neutral-50 border border-neutral-100 shadow-inner scale-[1.05]" />

        {/* 1. Crust Layer */}
        {base ? (
          <motion.div
            key={`base-${base.id}`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`absolute w-11/12 h-11/12 rounded-full border-[10px] shadow-lg transition-colors duration-500 ${baseStyle.bg} flex items-center justify-center`}
          >
            {/* Center slice outlines */}
            <div className="absolute inset-0 rounded-full border border-dashed border-black/5 pointer-events-none" />
            <div className="absolute w-full h-[1px] bg-black/5 rotate-0 pointer-events-none" />
            <div className="absolute w-full h-[1px] bg-black/5 rotate-45 pointer-events-none" />
            <div className="absolute w-full h-[1px] bg-black/5 rotate-90 pointer-events-none" />
            <div className="absolute w-full h-[1px] bg-black/5 rotate-135 pointer-events-none" />
          </motion.div>
        ) : (
          <div className="absolute w-11/12 h-11/12 rounded-full border-2 border-dashed border-neutral-300 flex items-center justify-center">
            <span className="text-xs text-neutral-400 font-medium">Select a crust base</span>
          </div>
        )}

        {/* 2. Pizza Recipe Base Layer */}
        <AnimatePresence>
          {base && pizzaOverlay && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -45 }}
              animate={{ scale: 0.95, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              className={`absolute w-5/6 h-5/6 rounded-full border-2 shadow-inner ${pizzaOverlay.bg} flex items-center justify-center z-10`}
            >
              {/* Melted Cheese Swirl Overlay */}
              <div className="absolute inset-2 rounded-full bg-yellow-100/30 blur-[2px] border border-dashed border-white/40" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3. Toppings Overlay Layer */}
        {base && pizza && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            {toppings.map((topping) => {
              const positions = getToppingPositions(topping.id);
              const visual = getToppingVisual(topping.id);
              return (
                <div key={`visual-${topping.id}`} className="absolute inset-0">
                  {positions.map((pos, idx) => (
                    <motion.div
                      key={`t-${topping.id}-${idx}`}
                      initial={{ scale: 0, y: -80, opacity: 0 }}
                      animate={{ scale: 1, y: 0, opacity: 1 }}
                      transition={{ 
                        type: 'spring', 
                        stiffness: 150, 
                        damping: 10, 
                        delay: idx * 0.05 
                      }}
                      style={{
                        position: 'absolute',
                        top: pos.top,
                        left: pos.left,
                        transform: `rotate(${pos.rotate}deg)`,
                      }}
                      className="flex items-center justify-center"
                    >
                      <span className="text-2xl drop-shadow-md select-none">{visual.label}</span>
                    </motion.div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Description HUD */}
      <div className="mt-4 text-center z-10 px-4 w-full">
        {base || pizza ? (
          <div className="space-y-1">
            <div className="text-sm font-bold text-neutral-800">
              {base ? base.name : 'No Crust'} {pizza ? `• ${pizza.name}` : ''}
            </div>
            {pizzaOverlay && (
              <div className="text-[11px] text-neutral-500 font-medium">
                {pizzaOverlay.details}
              </div>
            )}
            {toppings.length > 0 && (
              <div className="text-[10px] text-neutral-400 truncate max-w-full font-medium">
                + Toppings: {toppings.map(t => t.name).join(', ')}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-neutral-400 font-medium italic">
            Begin customisation to visualize your pie here
          </span>
        )}
      </div>
    </div>
  );
}
