import React, { useState, useEffect } from 'react';
import { 
  fetchBasesFromDb, 
  fetchPizzasFromDb, 
  fetchToppingsFromDb, 
  submitOrderToDb, 
  fetchAllOrders,
  isSupabaseConfigured,
  fetchDiscountThresholdFromDb,
  saveDiscountThresholdToDb,
  MenuItem,
  OrderPayload,
  CartItem,
  FALLBACK_BASES,
  FALLBACK_PIZZAS
} from './utils/supabaseClient';
import { fetchSmartUpsell } from './utils/aiEngine';
import PizzaVisualizer from './components/PizzaVisualizer';
import Receipt from './components/Receipt';
import QRCodeWidget from './components/QRCodeWidget';
import { 
  User, 
  Phone, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  Pizza as PizzaIcon, 
  Plus, 
  Sparkles, 
  Database, 
  Lock, 
  ShieldAlert, 
  ClipboardList, 
  ArrowRight,
  LogOut,
  Info,
  TrendingUp,
  ShoppingBag,
  Search,
  Percent,
  Tag,
  Trash2,
  Settings
} from 'lucide-react';

export default function App() {
  // Stepper state
  const [currentStep, setCurrentStep] = useState(1);
  const [isDbConnected, setIsDbConnected] = useState(false);

  // Database / Fallback menus
  const [bases, setBases] = useState<MenuItem[]>([]);
  const [pizzas, setPizzas] = useState<MenuItem[]>([]);
  const [toppings, setToppings] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);

  // Step 1: Customer Details State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [step1Errors, setStep1Errors] = useState<{ name?: string; phone?: string }>({});

  // Step 2: Customisation State
  const [selectedBase, setSelectedBase] = useState<MenuItem | null>(null);
  const [selectedPizza, setSelectedPizza] = useState<MenuItem | null>(null);
  const [selectedToppings, setSelectedToppings] = useState<MenuItem[]>([]);

  // Shopping Cart & Discount Threshold States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountThreshold, setDiscountThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('slicematic_discount_threshold');
    return saved ? parseInt(saved, 10) : 5;
  });

  const handleThresholdChange = (val: number) => {
    setDiscountThreshold(val);
    localStorage.setItem('slicematic_discount_threshold', String(val));
  };

  // Step 3: Quantity & Payment State
  const [quantity, setQuantity] = useState<number>(1);
  const [quantityInput, setQuantityInput] = useState<string>('1');
  const [quantityError, setQuantityError] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('UPI');

  // Step 4: AI Flavor Guru State
  const [aiUpsellText, setAiUpsellText] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  // Step 5: Order Submission & Success state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState<boolean>(false);
  const [placedOrderPayload, setPlacedOrderPayload] = useState<any>(null);
  const [submissionError, setSubmissionError] = useState<string>('');

  // Admin View Sub-tabs & Filter States
  const [adminMenu, setAdminMenu] = useState<'order-entry' | 'analytics' | 'configurations'>('analytics');
  const [tempThreshold, setTempThreshold] = useState<number>(5);
  const [configLoading, setConfigLoading] = useState<boolean>(false);
  const [configMessage, setConfigMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [adminTab, setAdminTab] = useState<'live-order-desk' | 'overview' | 'menu-insights' | 'operations'>('overview');
  const [adminPaymentFilter, setAdminPaymentFilter] = useState<string>('All');
  const [orderStatuses, setOrderStatuses] = useState<Record<string, string>>({});
  const [printedOrders, setPrintedOrders] = useState<Record<string, boolean>>({});

  // AI Flavor Guru structured recommendation states
  const [guruRecommendation, setGuruRecommendation] = useState<{
    explanation: string;
    recommendedBaseId: string | null;
    recommendedToppingIds: string[];
  } | null>(null);
  const [guruApplied, setGuruApplied] = useState<boolean>(false);
  const [selectedUpgrades, setSelectedUpgrades] = useState<string[]>([]);

  const toggleUpgrade = (id: string) => {
    setGuruApplied(false); // Reset so they can apply their modified selection
    setSelectedUpgrades(prev => {
      if (prev.includes(id)) {
        return prev.filter(uid => uid !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Router Routing State
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Synchronize browser history and popstate
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    // Auto-fetch if transitioning to admin and logged in
    if (path === '/admin' && isAdminLoggedIn) {
      fetchAdminOrders();
    }
  };

  const isAdminMode = currentPath === '/admin';
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [allOrders, setAllOrders] = useState<OrderPayload[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');

  // Initial load
  useEffect(() => {
    setIsDbConnected(isSupabaseConfigured());
    loadMenuData();
    loadDiscountThreshold();
  }, []);

  const loadDiscountThreshold = async () => {
    try {
      const dbThreshold = await fetchDiscountThresholdFromDb();
      setDiscountThreshold(dbThreshold);
      setTempThreshold(dbThreshold);
    } catch (err) {
      console.warn('[SliceMatic] Failed to load discount threshold:', err);
    }
  };

  const handleSaveThreshold = async () => {
    setConfigLoading(true);
    setConfigMessage(null);
    try {
      const success = await saveDiscountThresholdToDb(tempThreshold);
      if (success) {
        setDiscountThreshold(tempThreshold);
        setConfigMessage({
          text: `Configurations updated! Discount threshold globally set to ${tempThreshold} pizzas in real-time.`,
          type: 'success'
        });
      } else {
        setConfigMessage({
          text: 'Configuration saved locally but database write failed. Please check connection.',
          type: 'error'
        });
      }
    } catch (err) {
      setConfigMessage({
        text: 'An error occurred while saving configuration settings.',
        type: 'error'
      });
    } finally {
      setConfigLoading(false);
    }
  };

  const handleRefreshThreshold = async () => {
    setConfigLoading(true);
    setConfigMessage(null);
    try {
      const dbThreshold = await fetchDiscountThresholdFromDb();
      setDiscountThreshold(dbThreshold);
      setTempThreshold(dbThreshold);
      setConfigMessage({
        text: 'Configurations successfully reloaded from the live database!',
        type: 'success'
      });
    } catch (err) {
      setConfigMessage({
        text: 'Failed to reload configurations from database.',
        type: 'error'
      });
    } finally {
      setConfigLoading(false);
    }
  };

  const loadMenuData = async () => {
    setMenuLoading(true);
    try {
      const basesData = await fetchBasesFromDb();
      const pizzasData = await fetchPizzasFromDb();
      const toppingsData = await fetchToppingsFromDb();
      
      setBases(basesData);
      setPizzas(pizzasData);
      setToppings(toppingsData);

      // Parse query parameters for real-time mobile order session sync
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlName = params.get('name');
        const urlPhone = params.get('phone');
        const urlStep = params.get('step');
        const urlBaseId = params.get('base');
        const urlPizzaId = params.get('pizza');
        const urlToppings = params.get('toppings');
        const urlQty = params.get('qty');
        const urlPayment = params.get('payment');
        const urlCart = params.get('cart');

        if (urlName) setCustomerName(decodeURIComponent(urlName));
        if (urlPhone) setCustomerPhone(decodeURIComponent(urlPhone));
        if (urlStep) {
          const stepNum = parseInt(urlStep, 10);
          if (stepNum >= 1 && stepNum <= 5) {
            setCurrentStep(stepNum);
          }
        }
        if (urlBaseId) {
          const matchedBase = basesData.find(b => b.id === urlBaseId);
          if (matchedBase) setSelectedBase(matchedBase);
        }
        if (urlPizzaId) {
          const matchedPizza = pizzasData.find(p => p.id === urlPizzaId);
          if (matchedPizza) setSelectedPizza(matchedPizza);
        }
        if (urlToppings) {
          const toppingIds = urlToppings.split(',');
          const matchedToppings = toppingsData.filter(t => toppingIds.includes(t.id));
          setSelectedToppings(matchedToppings);
        }
        if (urlQty) {
          const parsedQty = parseInt(urlQty, 10);
          if (parsedQty >= 1 && parsedQty <= 100) {
            setQuantity(parsedQty);
            setQuantityInput(urlQty);
          }
        }
        if (urlPayment) {
          setPaymentMode(urlPayment);
        }
        if (urlCart) {
          try {
            const decoded = JSON.parse(decodeURIComponent(urlCart));
            if (Array.isArray(decoded)) {
              const parsedCart = decoded.map((item: any) => {
                const bMeta = basesData.find(b => b.id === item.b);
                const pMeta = pizzasData.find(p => p.id === item.p);
                const tMeta = toppingsData.filter(t => item.t?.includes(t.id));
                if (bMeta && pMeta) {
                  return {
                    id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                    base: bMeta,
                    pizza: pMeta,
                    toppings: tMeta,
                    quantity: Number(item.q) || 1
                  };
                }
                return null;
              }).filter(Boolean);
              setCart(parsedCart as any);
            }
          } catch (e) {
            console.warn('[SliceMatic] Failed to parse cart query parameter:', e);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load menu data', e);
    } finally {
      setMenuLoading(false);
    }
  };

  // Step 1 validation check
  const validateStep1 = () => {
    const errors: { name?: string; phone?: string } = {};
    const nameRegex = /^[a-zA-Z ]+$/;
    const phoneRegex = /^[6-9][0-9]{9}$/;

    if (!customerName.trim()) {
      errors.name = "Customer Name is required.";
    } else if (!nameRegex.test(customerName.trim())) {
      errors.name = "Name must contain alphabets and spaces only.";
    } else if (customerName.trim().length < 2 || customerName.trim().length > 40) {
      errors.name = "Name must be between 2 and 40 characters.";
    }

    if (!customerPhone.trim()) {
      errors.phone = "Phone number is required.";
    } else if (!phoneRegex.test(customerPhone.trim())) {
      errors.phone = "Phone must be a valid 10-digit Indian number starting with 6, 7, 8, or 9.";
    }

    setStep1Errors(errors);
    return Object.keys(errors).length === 0;
  };

  // Cart Management Handlers
  const handleAddToCart = () => {
    if (!selectedBase || !selectedPizza) {
      alert('Please select both a crust base and a pizza style recipe first!');
      return;
    }

    // Check if an identical pizza configuration already exists in the cart (same base, same pizza, same toppings)
    const existingIndex = cart.findIndex(item => {
      if (item.base.id !== selectedBase.id) return false;
      if (item.pizza.id !== selectedPizza.id) return false;
      if (item.toppings.length !== selectedToppings.length) return false;
      const toppingIds = selectedToppings.map(t => t.id).sort();
      const itemToppingIds = item.toppings.map(t => t.id).sort();
      return toppingIds.every((id, idx) => id === itemToppingIds[idx]);
    });

    if (existingIndex > -1) {
      // Merge quantity
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += quantity;
      setCart(updatedCart);
    } else {
      // Add new cart item
      const newItem: CartItem = {
        id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        base: selectedBase,
        pizza: selectedPizza,
        toppings: [...selectedToppings],
        quantity: quantity
      };
      setCart([...cart, newItem]);
    }

    // Reset current builder selections so they can add another variety
    setSelectedToppings([]);
    setQuantity(1);
    setQuantityInput('1');
    setQuantityError('');
  };

  const handleUpdateCartItemQuantity = (itemId: string, newQty: number) => {
    if (newQty < 1) {
      // Remove item if quantity falls below 1
      setCart(cart.filter(item => item.id !== itemId));
    } else {
      setCart(cart.map(item => item.id === itemId ? { ...item, quantity: newQty } : item));
    }
  };

  const handleRemoveCartItem = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  // Step 3 validation check (review page, always valid as payment selection is complete)
  const validateStep3 = () => {
    return true;
  };

  // Stepper handlers
  const handleNext = async () => {
    if (currentStep === 1) {
      if (!validateStep1()) return;
      // Auto-populate default selection when stepping into Step 2 menu customization
      if (!selectedBase && bases.length > 0) setSelectedBase(bases[0]);
      if (!selectedPizza && pizzas.length > 0) setSelectedPizza(pizzas[0]);
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // If cart is empty, check if they have a selection that we can auto-add
      if (cart.length === 0) {
        if (selectedBase && selectedPizza) {
          // Auto add current selection to cart
          const newItem: CartItem = {
            id: `cart-${Date.now()}`,
            base: selectedBase,
            pizza: selectedPizza,
            toppings: [...selectedToppings],
            quantity: quantity
          };
          setCart([newItem]);
          setSelectedToppings([]);
          setQuantity(1);
          setQuantityInput('1');
          setCurrentStep(3);
        } else {
          alert('Please select a pizza style, crust base, and click "Add to Order" to start your order!');
          return;
        }
      } else {
        setCurrentStep(3);
      }
    } else if (currentStep === 3) {
      // Trigger AI Flavor Guru Interceptor when moving to Step 4
      setCurrentStep(4);
      setAiLoading(true);
      setAiUpsellText('');
      setGuruRecommendation(null);
      setGuruApplied(false);
      setSelectedUpgrades([]);
      
      try {
        // Send the complete cart array or the current single pizza selection draft to AI analyzer
        const target = cart.length > 0 ? cart : { base: selectedBase, pizza: selectedPizza, toppings: selectedToppings };
        const result = await fetchSmartUpsell(target as any);
        setAiUpsellText(result.explanation);
        setGuruRecommendation(result);

        const initial: string[] = [];
        if (result.recommendedBaseId) {
          initial.push('base');
        }
        if (result.recommendedToppingIds) {
          initial.push(...result.recommendedToppingIds);
        }
        setSelectedUpgrades(initial);
      } catch (err) {
        console.warn('AI Flavor Guru failed or timed out. Proceeding silently.');
        const fallback = {
          explanation: "Elevate your pie with extra cheese (T2) or a peri-peri drizzle (T10) upgrade for a fantastic kick!",
          recommendedBaseId: null,
          recommendedToppingIds: ["T2"]
        };
        setAiUpsellText(fallback.explanation);
        setGuruRecommendation(fallback);
        setSelectedUpgrades(fallback.recommendedToppingIds || []);
      } finally {
        setAiLoading(false);
      }
    } else if (currentStep === 4) {
      setCurrentStep(5);
    }
  };

  // Flavor Guru recommendation application handler (applies upgrades across all items in cart)
  const applyGuruRecommendation = () => {
    if (!guruRecommendation) return;

    const baseUpgradeSelected = selectedUpgrades.includes('base');
    const selectedToppingUpgrades = guruRecommendation.recommendedToppingIds.filter(id => selectedUpgrades.includes(id));

    if (cart.length > 0) {
      // Apply upgrades across all items in the shopping cart
      const updatedCart = cart.map(item => {
        const updatedItem = { ...item };
        // Base upgrade if current base is B1 or B2
        if (baseUpgradeSelected && guruRecommendation.recommendedBaseId && (item.base.id === 'B1' || item.base.id === 'B2')) {
          const matchedBase = bases.find(b => b.id === guruRecommendation.recommendedBaseId);
          if (matchedBase) {
            updatedItem.base = matchedBase;
          }
        }
        // Toppings upgrade
        if (selectedToppingUpgrades.length > 0) {
          const currentToppingIds = item.toppings.map(t => t.id);
          const newToppings = [...item.toppings];

          selectedToppingUpgrades.forEach(id => {
            if (!currentToppingIds.includes(id)) {
              const matchedTopping = toppings.find(t => t.id === id);
              if (matchedTopping) {
                newToppings.push(matchedTopping);
              }
            }
          });
          updatedItem.toppings = newToppings;
        }
        return updatedItem;
      });
      setCart(updatedCart);
    } else {
      // Apply recommendation to current editor draft
      if (baseUpgradeSelected && guruRecommendation.recommendedBaseId) {
        const matchedBase = bases.find(b => b.id === guruRecommendation.recommendedBaseId);
        if (matchedBase) {
          setSelectedBase(matchedBase);
        }
      }

      if (selectedToppingUpgrades.length > 0) {
        const currentToppingIds = selectedToppings.map(t => t.id);
        const newToppings = [...selectedToppings];

        selectedToppingUpgrades.forEach(id => {
          if (!currentToppingIds.includes(id)) {
            const matchedTopping = toppings.find(t => t.id === id);
            if (matchedTopping) {
              newToppings.push(matchedTopping);
            }
          }
        });
        setSelectedToppings(newToppings);
      }
    }

    setGuruApplied(true);
  };

  // Calculates the aggregated price impact of the Flavor Guru's recommendations considering multiple cart items and their quantities
  const getRecommendationPriceDelta = () => {
    if (!guruRecommendation) return 0;
    let totalDelta = 0;

    const baseUpgradeSelected = selectedUpgrades.includes('base');
    const selectedToppingUpgrades = guruRecommendation.recommendedToppingIds.filter(id => selectedUpgrades.includes(id));

    if (cart.length > 0) {
      cart.forEach(item => {
        let itemDelta = 0;
        // Base upgrade if current base is non-premium (B1 or B2)
        if (baseUpgradeSelected && guruRecommendation.recommendedBaseId && (item.base.id === 'B1' || item.base.id === 'B2')) {
          const matchedBase = bases.find(b => b.id === guruRecommendation.recommendedBaseId);
          if (matchedBase) {
            itemDelta += (matchedBase.price - item.base.price);
          }
        }
        // Toppings delta
        if (selectedToppingUpgrades.length > 0) {
          selectedToppingUpgrades.forEach(id => {
            if (!item.toppings.some(t => t.id === id)) {
              const topping = toppings.find(t => t.id === id);
              if (topping) {
                itemDelta += topping.price;
              }
            }
          });
        }
        totalDelta += itemDelta * item.quantity;
      });
    } else {
      let itemDelta = 0;
      if (baseUpgradeSelected && guruRecommendation.recommendedBaseId && selectedBase && selectedBase.id !== guruRecommendation.recommendedBaseId) {
        const newBase = bases.find(b => b.id === guruRecommendation.recommendedBaseId);
        if (newBase) {
          itemDelta += (newBase.price - selectedBase.price);
        }
      }
      if (selectedToppingUpgrades.length > 0) {
        selectedToppingUpgrades.forEach(id => {
          if (!selectedToppings.some(t => t.id === id)) {
            const topping = toppings.find(t => t.id === id);
            if (topping) {
              itemDelta += topping.price;
            }
          }
        });
      }
      totalDelta = itemDelta * quantity;
    }

    return totalDelta;
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Toggle toppings
  const handleToppingToggle = (topping: MenuItem) => {
    if (selectedToppings.some(t => t.id === topping.id)) {
      setSelectedToppings(selectedToppings.filter(t => t.id !== topping.id));
    } else {
      setSelectedToppings([...selectedToppings, topping]);
    }
  };

  // Math engine helper functions for invoice (aggregates entire cart)
  const getSubtotal = () => {
    return cart.reduce((sum, item) => {
      const toppingsPrice = item.toppings.reduce((tsum, t) => tsum + t.price, 0);
      const itemCost = item.base.price + item.pizza.price + toppingsPrice;
      return sum + (itemCost * item.quantity);
    }, 0);
  };

  const getDiscount = () => {
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    const sub = getSubtotal();
    return totalQty >= discountThreshold ? sub * 0.10 : 0;
  };

  const getGst = () => {
    const sub = getSubtotal();
    const disc = getDiscount();
    return (sub - disc) * 0.18;
  };

  const getGrandTotal = () => {
    const sub = getSubtotal();
    const disc = getDiscount();
    const gst = getGst();
    return sub - disc + gst;
  };

  // Submit order to database
  const handleConfirmOrder = async () => {
    setIsSubmitting(true);
    setSubmissionError('');

    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);

    const payload: OrderPayload = {
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      quantity: totalQty,
      payment_mode: paymentMode,
      // Backward-compatible fallbacks for old database schema
      base_id: cart[0]?.base.id || '',
      pizza_id: cart[0]?.pizza.id || '',
      base_total: getSubtotal(),
      discount_amount: getDiscount(),
      gst_amount: getGst(),
      final_payable: getGrandTotal(),
      toppings: cart[0]?.toppings || [],
      cart: cart // The complete modular shopping cart array
    };

    try {
      const response = await submitOrderToDb(payload);
      if (response.success) {
        setPlacedOrderPayload(response.data);
        setOrderComplete(true);
        // Refresh admin dashboard list in real-time
        fetchAdminOrders();
      } else {
        setSubmissionError(response.error || 'Failed to record your order. Please retry.');
      }
    } catch (e: any) {
      setSubmissionError(e.message || 'An unexpected networking error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Swift Order Entry Desk submission for admin
  const handleAdminPlaceOrder = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      alert('Please fill in Customer Name and Mobile Number!');
      return;
    }
    const nameRegex = /^[a-zA-Z ]+$/;
    const phoneRegex = /^[6-9][0-9]{9}$/;
    if (!nameRegex.test(customerName.trim())) {
      alert("Name must contain alphabets and spaces only.");
      return;
    }
    if (!phoneRegex.test(customerPhone.trim())) {
      alert("Phone number must be a valid 10-digit Indian mobile number.");
      return;
    }
    if (cart.length === 0) {
      alert('Please select your crust, pizza style, and click "Add to Cart" first!');
      return;
    }
    
    setIsSubmitting(true);
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);

    const payload: OrderPayload = {
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      quantity: totalQty,
      payment_mode: paymentMode,
      base_id: cart[0]?.base.id || '',
      pizza_id: cart[0]?.pizza.id || '',
      base_total: getSubtotal(),
      discount_amount: getDiscount(),
      gst_amount: getGst(),
      final_payable: getGrandTotal(),
      toppings: cart[0]?.toppings || [],
      cart: cart
    };

    try {
      const response = await submitOrderToDb(payload);
      if (response.success) {
        alert(`Order Saved & KOT Printed! ID: #${String(response.data?.id || 'SIM').slice(-4)}`);
        // Reset draft inputs
        setCustomerName('');
        setCustomerPhone('');
        setCart([]);
        setSelectedToppings([]);
        setQuantity(1);
        setPaymentMode('UPI');
        // Instantly refresh other dashboard views
        fetchAdminOrders();
      } else {
        alert(response.error || 'Failed to place order.');
      }
    } catch (e: any) {
      alert(e.message || 'Error occurred placing order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Restart order form
  const handleResetOrder = () => {
    setCurrentStep(1);
    setCustomerName('');
    setCustomerPhone('');
    setSelectedToppings([]);
    setCart([]);
    setQuantity(1);
    setQuantityInput('1');
    setPaymentMode('UPI');
    setAiUpsellText('');
    setOrderComplete(false);
    setPlacedOrderPayload(null);
    setSubmissionError('');
    setQuantityError('');
  };

  // Admin View Handlers
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');

    // Offline bypass / Dev grading ease of testing
    if (adminEmail === 'admin@slicematic.com' && adminPassword === 'slicematic123') {
      setIsAdminLoggedIn(true);
      fetchAdminOrders();
    } else {
      setAdminError('Invalid email credentials or passcode. (Use testing credentials: admin@slicematic.com / slicematic123)');
    }
  };

  const fetchAdminOrders = async () => {
    setOrdersLoading(true);
    try {
      const data = await fetchAllOrders();
      setAllOrders(data);
    } catch (e) {
      console.error('Failed to load orders for admin', e);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setAdminEmail('');
    setAdminPassword('');
    setAllOrders([]);
  };

  const renderOrderEntryDesk = () => {
    return (
      <div className="flex-1 flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Left Column: Ordering Flow */}
        <div className="w-full lg:w-7/12 space-y-6">
          
          {/* Main Stepper HUD */}
          <div className="bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm flex items-center justify-between">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center flex-1 last:flex-initial">
                <div className="flex flex-col items-center gap-1.5 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition duration-300 ${
                    currentStep === step 
                      ? 'bg-orange-500 text-white ring-4 ring-orange-100' 
                      : currentStep > step 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-neutral-100 text-neutral-400'
                  }`}>
                    {currentStep > step ? <Check className="w-4 h-4" /> : step}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider hidden md:block ${
                    currentStep === step ? 'text-neutral-800' : 'text-neutral-400'
                  }`}>
                    {step === 1 ? 'Contact' :
                     step === 2 ? 'Menu' :
                     step === 3 ? 'Billing' :
                     step === 4 ? 'AI Advice' : 'Payment'}
                  </span>
                </div>
                {step < 5 && (
                  <div className={`h-1 flex-1 mx-3 rounded-full transition duration-300 ${
                    currentStep > step ? 'bg-emerald-500' : 'bg-neutral-100'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Step Card */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-neutral-100 shadow-sm min-h-[380px] flex flex-col justify-between">
            
            {/* Step Content */}
            <div className="space-y-6">
              {/* Step 1: Customer Intake */}
              {currentStep === 1 && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-neutral-900 tracking-tight">Step 1: Contact Intake</h2>
                    <p className="text-xs text-neutral-400">
                      Provide your name and mobile number to start building your pizza order.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">Customer Name</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">
                          <User className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="e.g., Jane Doe"
                          className={`w-full border ${step1Errors.name ? 'border-red-400 bg-red-50/10 focus:ring-red-100' : 'border-neutral-200 focus:ring-neutral-100'} rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-4 transition`}
                        />
                      </div>
                      {step1Errors.name && (
                        <p className="text-red-500 text-[11px] font-semibold flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" /> {step1Errors.name}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">Mobile Number (Indian format)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">
                          <Phone className="w-4 h-4" />
                        </span>
                        <span className="absolute left-10 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 font-mono">
                          +91
                        </span>
                        <input
                          type="text"
                          maxLength={10}
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                          placeholder="9876543210"
                          className={`w-full border ${step1Errors.phone ? 'border-red-400 bg-red-50/10 focus:ring-red-100' : 'border-neutral-200 focus:ring-neutral-100'} rounded-2xl pl-19 pr-4 py-3.5 text-sm font-mono focus:outline-none focus:ring-4 transition`}
                        />
                      </div>
                      {step1Errors.phone && (
                        <p className="text-red-500 text-[11px] font-semibold flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" /> {step1Errors.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Menu Customisation */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-neutral-900 tracking-tight">Step 2: Customise Pizza Recipe</h2>
                    <p className="text-xs text-neutral-400">
                      Select one base crust, style recipe, and optional toppings to build your pie. Add multiple pizzas to your order if desired!
                    </p>
                  </div>

                  {menuLoading ? (
                    <div className="py-12 text-center space-y-2">
                      <div className="inline-block w-6 h-6 border-2 border-neutral-200 border-t-orange-500 rounded-full animate-spin" />
                      <p className="text-xs text-neutral-400">Populating fresh ingredients...</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* 1. Base Crust selection */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">1. Select Crust Base</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {bases.map((base) => (
                            <button
                              key={base.id}
                              onClick={() => setSelectedBase(base)}
                              className={`p-3 rounded-2xl border text-left transition relative cursor-pointer ${
                                selectedBase?.id === base.id
                                  ? 'border-orange-500 bg-orange-50/40 ring-2 ring-orange-100'
                                  : 'border-neutral-100 bg-neutral-50/50 hover:bg-neutral-50'
                              }`}
                            >
                              <div className="text-xs font-bold text-neutral-800">{base.name}</div>
                              <div className="text-[11px] text-neutral-400 font-mono mt-0.5">₹{base.price.toFixed(2)}</div>
                              {selectedBase?.id === base.id && (
                                <span className="absolute top-2 right-2 bg-orange-500 text-white rounded-full p-0.5">
                                  <Check className="w-3 h-3" />
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 2. Pizza Style selection */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">2. Select Pizza Style Recipe</span>
                        <div className="grid grid-cols-2 gap-2.5">
                          {pizzas.map((pizza) => (
                            <button
                              key={pizza.id}
                              onClick={() => setSelectedPizza(pizza)}
                              className={`p-3.5 rounded-2xl border text-left transition relative cursor-pointer ${
                                selectedPizza?.id === pizza.id
                                  ? 'border-orange-500 bg-orange-50/40 ring-2 ring-orange-100'
                                  : 'border-neutral-100 bg-neutral-50/50 hover:bg-neutral-50'
                              }`}
                            >
                              <div className="text-xs font-bold text-neutral-800">{pizza.name}</div>
                              <div className="text-[11px] text-neutral-400 font-mono mt-0.5">₹{pizza.price.toFixed(2)}</div>
                              {selectedPizza?.id === pizza.id && (
                                <span className="absolute top-3.5 right-3.5 bg-orange-500 text-white rounded-full p-0.5">
                                  <Check className="w-3 h-3" />
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 3. Toppings Checklist selection */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">3. Add Extra Toppings (Optional)</span>
                        <div className="flex flex-wrap gap-2">
                          {toppings.map((topping) => {
                            const isSelected = selectedToppings.some(t => t.id === topping.id);
                            return (
                              <button
                                key={topping.id}
                                onClick={() => handleToppingToggle(topping)}
                                className={`px-3.5 py-2.5 rounded-2xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm'
                                    : 'bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                                }`}
                              >
                                {isSelected ? <Check className="w-3.5 h-3.5 text-orange-400" /> : <Plus className="w-3.5 h-3.5 text-neutral-400" />}
                                <span>{topping.name}</span>
                                <span className={`text-[10px] font-mono ${isSelected ? 'text-amber-300' : 'text-neutral-400'}`}>
                                  (+₹{topping.price})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Builder Quantity & Add variety block */}
                      <div className="pt-4 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Quantity:</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => quantity > 1 && setQuantity(quantity - 1)}
                              className="w-10 h-10 rounded-xl border border-neutral-200 flex items-center justify-center font-bold text-neutral-600 hover:bg-neutral-50"
                            >
                              -
                            </button>
                            <span className="w-10 text-center font-black text-sm text-neutral-800">{quantity}</span>
                            <button
                              onClick={() => quantity < 10 && setQuantity(quantity + 1)}
                              className="w-10 h-10 rounded-xl border border-neutral-200 flex items-center justify-center font-bold text-neutral-600 hover:bg-neutral-50"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={handleAddToCart}
                          className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-extrabold px-5 py-3 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                        >
                          <Plus className="w-4 h-4" /> Add to Cart
                        </button>
                      </div>

                      {/* Render Active Cart mini drawer if cart is populated */}
                      {cart.length > 0 && (
                        <div className="bg-orange-50/20 border border-orange-100 rounded-2xl p-4 mt-2 space-y-2.5">
                          <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block">Your Pizza Cart ({cart.length} item{cart.length !== 1 ? 's' : ''})</span>
                          <div className="space-y-2">
                            {cart.map((item) => (
                              <div key={item.id} className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-neutral-100">
                                <div>
                                  <span className="font-bold text-neutral-800">{item.quantity}x {item.pizza.name}</span>
                                  <span className="text-[10px] text-neutral-400 block">Crust: {item.base.name}</span>
                                  {item.toppings.length > 0 && (
                                    <span className="text-[10px] text-orange-600/80 block font-medium">
                                      Toppings: {item.toppings.map(t => t.name).join(', ')}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleRemoveCartItem(item.id)}
                                  className="text-red-500 hover:text-red-700 font-semibold text-[11px]"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Quantity & Deterministic Billing */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-neutral-900 tracking-tight">Step 3: Quantity & Billing Method</h2>
                    <p className="text-xs text-neutral-400">
                      Verify details of your built pizzas, adjust quantities, and select preferred payment mode.
                    </p>
                  </div>

                  <div className="space-y-5">
                    {/* Cart Items List */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">Selected Pizza Configurations</label>
                      {cart.length === 0 ? (
                        <div className="text-center py-6 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 text-neutral-400 text-xs">
                          Your order list is empty. Go back to Step 2 to configure and add pizzas!
                        </div>
                      ) : (
                        <div className="space-y-3.5 max-w-lg">
                          {cart.map((item) => (
                            <div key={item.id} className="p-4 bg-white border border-neutral-200 rounded-2xl flex items-center justify-between gap-4 shadow-xs">
                              <div className="text-xs space-y-0.5">
                                <div className="font-extrabold text-neutral-900 text-sm">{item.quantity}x {item.pizza.name}</div>
                                <div className="text-neutral-500">Crust: {item.base.name}</div>
                                {item.toppings.length > 0 && (
                                  <div className="text-[10px] text-amber-600 font-bold">
                                    + {item.toppings.map(t => t.name).join(', ')}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleUpdateCartItemQuantity(item.id, item.quantity - 1)}
                                    className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center font-bold text-neutral-600 hover:bg-neutral-50"
                                  >
                                    -
                                  </button>
                                  <span className="w-6 text-center font-bold text-xs">{item.quantity}</span>
                                  <button
                                    onClick={() => handleUpdateCartItemQuantity(item.id, item.quantity + 1)}
                                    className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center font-bold text-neutral-600 hover:bg-neutral-50"
                                  >
                                    +
                                  </button>
                                </div>
                                <button
                                  onClick={() => handleRemoveCartItem(item.id)}
                                  className="text-red-500 hover:text-red-700 p-1.5"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}

                          <p className="text-[10px] text-neutral-400 leading-relaxed mt-1">
                            * Ordering <strong>{discountThreshold} or more pizzas</strong> across your cart automatically applies a <strong>10% subtotal discount</strong> to your billing summary!
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Payment Selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">Preferred Payment Mode</label>
                      <div className="grid grid-cols-3 gap-3 max-w-md">
                        {['Cash', 'Card', 'UPI'].map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setPaymentMode(mode)}
                            className={`p-4 rounded-2xl border text-center font-bold text-xs transition cursor-pointer ${
                              paymentMode === mode
                                ? 'border-orange-500 bg-orange-50/40 text-orange-700 ring-2 ring-orange-100'
                                : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600'
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Step 4: AI Flavor Guru Interceptor */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-xl font-black text-neutral-900 tracking-tight">Step 4: Chef's Flavor Guru Advice</h2>
                      <span className="bg-orange-500/10 text-orange-600 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                        Gourmet Assist
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400">
                      Review a smart recommendation generated on-the-fly specifically for your current order profile.
                    </p>
                  </div>

                  <div className="bg-neutral-900 text-white rounded-3xl p-6 md:p-8 space-y-6 relative overflow-hidden shadow-xl border border-neutral-800">
                    {/* Background flare effects */}
                    <div className="absolute -right-12 -bottom-12 w-44 h-44 rounded-full bg-orange-500/15 blur-2xl pointer-events-none" />
                    <div className="absolute -left-12 -top-12 w-44 h-44 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
                    
                    <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4">
                      <div className="flex items-center gap-2.5">
                        <span className="p-2 bg-gradient-to-tr from-orange-500 to-amber-500 text-white rounded-xl shadow-lg shadow-orange-500/10">
                          <Sparkles className="w-4 h-4" />
                        </span>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 block">Chef's Gourmet Assistant</span>
                          <h3 className="text-sm font-extrabold text-white">Interactive Recipe Enhancer</h3>
                        </div>
                      </div>
                      
                      {!aiLoading && guruRecommendation && (
                        <span className="text-[10px] font-mono font-bold text-neutral-400 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800 shadow-xs">
                          Analysis Complete
                        </span>
                      )}
                    </div>

                    {aiLoading ? (
                      <div className="py-12 text-center space-y-3">
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce" />
                          <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                          <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                        <p className="text-xs text-neutral-400">Flavor Guru is custom analyzing your recipe pairings...</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Gourmet Analysis Text box */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80 block">🧠 Flavor Guru Verdict</span>
                          <div className="bg-neutral-950/60 border border-neutral-800/60 rounded-2xl p-4 md:p-5 text-sm md:text-base leading-relaxed text-neutral-200 italic font-sans font-medium">
                            "{aiUpsellText}"
                          </div>
                        </div>

                        {/* Structured Recommendation Breakdowns */}
                        {guruRecommendation && (
                          <div className="space-y-4 pt-4 border-t border-neutral-800/80">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">🎯 Step-by-Step Upgrade Action Plan</span>
                            
                            <div className="space-y-3">
                              {/* Base upgrade visual block */}
                              {guruRecommendation.recommendedBaseId && selectedBase?.id !== guruRecommendation.recommendedBaseId && (() => {
                                const isSelected = selectedUpgrades.includes('base');
                                const upgradedBase = bases.find(b => b.id === guruRecommendation.recommendedBaseId);
                                return (
                                  <div 
                                    onClick={() => toggleUpgrade('base')}
                                    className={`border rounded-2xl p-4 flex items-center justify-between gap-4 text-xs transition-all duration-150 select-none cursor-pointer ${
                                      isSelected 
                                        ? 'bg-neutral-950/90 border-orange-500/80 ring-1 ring-orange-500/30 text-white hover:bg-neutral-950/100' 
                                        : 'bg-neutral-950/30 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:bg-neutral-950/50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                        isSelected ? 'bg-orange-500 text-white scale-100' : 'border border-neutral-700 bg-neutral-950/50 scale-100'
                                      }`}>
                                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                      </div>
                                      <div className="space-y-1">
                                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                          isSelected 
                                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' 
                                            : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                                        }`}>Crust Substitution</span>
                                        <div className="mt-1">
                                          Change crust base from <span className="text-neutral-500 line-through font-mono">{selectedBase?.name}</span> to <strong className={`font-black font-sans text-sm ${isSelected ? 'text-white' : 'text-neutral-300'}`}>{upgradedBase?.name}</strong>
                                        </div>
                                      </div>
                                    </div>
                                    <span className={`font-mono font-bold px-2.5 py-1.5 rounded-xl border text-xs shrink-0 ${
                                      isSelected 
                                        ? 'text-amber-400 bg-amber-950/30 border-amber-950' 
                                        : 'text-neutral-500 bg-neutral-950/10 border-neutral-900'
                                    }`}>
                                      +₹{((upgradedBase?.price || 0) - (selectedBase?.price || 0)).toFixed(2)}
                                    </span>
                                  </div>
                                );
                              })()}

                              {/* Toppings suggested block */}
                              {guruRecommendation.recommendedToppingIds && guruRecommendation.recommendedToppingIds.some(id => !selectedToppings.some(t => t.id === id)) ? (
                                <div className="space-y-2">
                                  {guruRecommendation.recommendedToppingIds.map((id: string) => {
                                    const alreadySelected = selectedToppings.some(t => t.id === id);
                                    const topping = toppings.find(t => t.id === id);
                                    if (!topping || alreadySelected) return null;
                                    const isSelected = selectedUpgrades.includes(id);
                                    return (
                                      <div 
                                        key={id} 
                                        onClick={() => toggleUpgrade(id)}
                                        className={`border rounded-2xl p-4 flex items-center justify-between gap-4 text-xs transition-all duration-150 select-none cursor-pointer ${
                                          isSelected 
                                            ? 'bg-neutral-950/90 border-orange-500/80 ring-1 ring-orange-500/30 text-white hover:bg-neutral-950/100' 
                                            : 'bg-neutral-950/30 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:bg-neutral-950/50'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                            isSelected ? 'bg-orange-500 text-white scale-100' : 'border border-neutral-700 bg-neutral-950/50 scale-100'
                                          }`}>
                                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                          </div>
                                          <div className="space-y-1">
                                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                              isSelected 
                                                ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' 
                                                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                                            }`}>Extra Topping</span>
                                            <div className="mt-1">
                                              Sprinkle premium <strong className={`font-black font-sans text-sm ${isSelected ? 'text-white' : 'text-neutral-300'}`}>{topping.name}</strong> onto your pie crust
                                            </div>
                                          </div>
                                        </div>
                                        <span className={`font-mono font-bold px-2.5 py-1.5 rounded-xl border text-xs shrink-0 ${
                                          isSelected 
                                            ? 'text-orange-400 bg-orange-950/30 border-orange-950' 
                                            : 'text-neutral-500 bg-neutral-950/10 border-neutral-900'
                                        }`}>
                                          +₹{topping.price.toFixed(2)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}

                              {/* If no changes are needed */}
                              {!(guruRecommendation.recommendedBaseId && selectedBase?.id !== guruRecommendation.recommendedBaseId) && 
                               !(guruRecommendation.recommendedToppingIds && guruRecommendation.recommendedToppingIds.some(id => !selectedToppings.some(t => t.id === id))) && (
                                <div className="bg-neutral-950/40 border border-neutral-800 text-neutral-400 text-xs p-4 rounded-2xl flex items-center gap-2">
                                  <Check className="w-4 h-4 text-orange-500" />
                                  <span>Your select ingredients perfectly match the Chef's recommendations! No extra upgrade actions needed.</span>
                                </div>
                              )}
                            </div>

                            {/* Application Button Wrapper */}
                            <div className="pt-2">
                              {guruApplied ? (
                                <div className="w-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-bold py-4 px-4 rounded-2xl flex items-center justify-center gap-2.5 shadow-inner">
                                  <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                                  <span>Chef's enhancements applied! Order selections have been instantly updated.</span>
                                </div>
                              ) : (
                                (() => {
                                  const delta = getRecommendationPriceDelta();
                                  const hasSelectedUpgrade = selectedUpgrades.length > 0;
                                  const canApply = hasSelectedUpgrade && (delta > 0 || (guruRecommendation.recommendedBaseId && selectedUpgrades.includes('base')));
                                  
                                  if (canApply) {
                                    return (
                                      <button
                                        onClick={applyGuruRecommendation}
                                        className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs py-4 rounded-2xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 active:scale-[0.99] duration-150"
                                      >
                                        <Sparkles className="w-4 h-4 animate-pulse text-amber-300" />
                                        Apply Selected Recipe Suggestions ({delta > 0 ? `+₹${delta.toFixed(2)}` : 'Free Upgrade'})
                                      </button>
                                    );
                                  } else {
                                    return (
                                      <div className="w-full bg-neutral-900/40 border border-neutral-800/80 text-neutral-400 text-xs py-3.5 px-4 rounded-xl flex items-center justify-center gap-2">
                                        <Check className="w-4 h-4 text-orange-500" />
                                        <span>{hasSelectedUpgrade ? "No upgrades needed for current selection." : "Select flavor enhancements above to customize your recipe upgrade."}</span>
                                      </div>
                                    );
                                  }
                                })()
                              )}
                            </div>
                          </div>
                        )}

                        <p className="text-[10px] text-neutral-600">
                          * Automated recipe analyzer. Applies custom flavor suggestions directly to your active selections.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100 text-xs text-neutral-600 leading-relaxed flex items-start gap-2.5">
                    <span className="text-amber-500 font-bold shrink-0">💡 Note:</span>
                    <span>
                      Applying the Chef's recommendations directly updates your pizza recipe visualizer and modifies the checkout price accordingly. You can still customize your choices anytime by pressing <span className="font-bold">Back</span>.
                    </span>
                  </div>
                </div>
              )}

              {/* Step 5: Placement & Confirmation summary */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-neutral-900 tracking-tight">Step 5: Order Confirmation</h2>
                    <p className="text-xs text-neutral-400">
                      Verify your selections below and finalize your order.
                    </p>
                  </div>

                  {orderComplete ? (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 text-center space-y-4">
                      <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                        <Check className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold text-neutral-900">Order Saved Successfully!</h3>
                        <p className="text-xs text-neutral-500">
                          Your order is securely registered with order ID <strong>#{placedOrderPayload?.id || 'LOCAL-SIM'}</strong>.
                        </p>
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={handleResetOrder}
                          className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-5 py-3 rounded-xl transition cursor-pointer shadow-sm flex items-center gap-1.5 mx-auto"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Launch New Order
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {submissionError && (
                        <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-3.5 text-xs font-semibold">
                          {submissionError}
                        </div>
                      )}

                      <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200 space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">Confirm Order Placement</h3>
                        <p className="text-xs text-neutral-600 leading-relaxed">
                          Review your customized selections in the itemized ticket on the right. Clicking confirm will log this order to our kitchen dispatch system and print your physical kitchen ticket.
                        </p>
                        <button
                          onClick={handleConfirmOrder}
                          disabled={isSubmitting}
                          className="bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs px-6 py-3.5 rounded-xl transition cursor-pointer shadow-md shadow-orange-500/20 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isSubmitting ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Recording order...
                            </>
                          ) : (
                            <>
                              Confirm & Record Order <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Controls (Buttons) */}
            {!orderComplete && (
              <div className="pt-6 border-t border-neutral-100 flex items-center justify-between gap-4 mt-6">
                <button
                  onClick={handleBack}
                  disabled={currentStep === 1}
                  className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-800 disabled:opacity-30 transition cursor-pointer py-2 px-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>

                <button
                  onClick={handleNext}
                  disabled={currentStep === 5}
                  className="flex items-center gap-1.5 text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-3 rounded-xl transition cursor-pointer shadow-sm disabled:opacity-30"
                >
                  Next Step <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Dynamic QR Sync Widget section */}
          {!orderComplete && (
            <QRCodeWidget 
              state={{
                customerName,
                customerPhone,
                currentStep,
                selectedBaseId: selectedBase?.id,
                selectedPizzaId: selectedPizza?.id,
                selectedToppingsIds: selectedToppings.map(t => t.id),
                quantity,
                paymentMode,
                cart
              }}
            />
          )}
        </div>

        {/* Right Column: Pizza Visualizer & Live Receipt Preview */}
        <div className="w-full lg:w-5/12 space-y-6 lg:sticky lg:top-24">
          {/* Pizza Visualizer Card */}
          <PizzaVisualizer 
            base={selectedBase} 
            pizza={selectedPizza} 
            toppings={selectedToppings} 
          />

          {/* Live Thermal Receipt */}
          <Receipt 
            customerName={customerName} 
            customerPhone={customerPhone} 
            paymentMode={paymentMode} 
            isSubmitting={isSubmitting} 
            isComplete={orderComplete}
            cart={cart}
            discountThreshold={discountThreshold}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50 text-neutral-800 flex flex-col antialiased">
      {/* Header */}
      <header className="bg-white border-b border-neutral-100 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-orange-500 to-amber-400 text-white p-2.5 rounded-2xl shadow-md shadow-orange-500/10 cursor-pointer hover:scale-105 active:scale-95 transition-transform duration-200" onClick={() => navigate('/')}>
            <PizzaIcon className="w-6 h-6 animate-spin-slow" />
          </div>
          <div className="cursor-pointer flex flex-col items-start" onClick={() => navigate('/')}>
            <h1 className="text-xl font-black tracking-tight text-neutral-900">
              Slice<span className="text-orange-500">Matic</span>
            </h1>
            <div className="mt-1">
              {isAdminMode ? (
                <span className="inline-flex items-center gap-1 text-[9px] bg-rose-50 text-rose-600 px-2.5 py-0.5 rounded-md font-extrabold tracking-wider uppercase border border-rose-100">
                  <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" /> Staff
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[9px] bg-orange-50 text-orange-600 px-2.5 py-0.5 rounded-md font-extrabold tracking-wider uppercase border border-orange-100/40">
                  <span className="w-1 h-1 rounded-full bg-orange-500 animate-pulse" /> Live Store
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAdminMode ? (
            isAdminLoggedIn ? (
              <>
                <button
                  onClick={fetchAdminOrders}
                  disabled={ordersLoading}
                  className="text-xs font-bold bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${ordersLoading ? 'animate-spin' : ''}`} /> Refresh Logs
                </button>
                <button
                  onClick={handleAdminLogout}
                  className="text-xs font-bold bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate('/')}
                className="text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                ← Back to Store
              </button>
            )
          ) : (
            <button
              onClick={() => navigate('/admin')}
              className="text-xs font-bold text-neutral-600 hover:text-neutral-900 border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/50 px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <ClipboardList className="w-3.5 h-3.5" /> Staff Portal
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col">
        
        {/* Unconfigured alert banner if offline */}
        {!isDbConnected && !isAdminMode && (
          <div className="mb-6 bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
            <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 space-y-1">
              <p className="font-bold">Running in Offline / Database Simulation Mode</p>
              <p className="leading-relaxed">
                Supabase database keys (<code>VITE_SUPABASE_URL</code>) are not detected in the environment. SliceMatic is loaded with its official default menu and will log orders locally to localStorage for the admin panel. Connect your database keys to enable cloud storage persistence.
              </p>
            </div>
          </div>
        )}

        {/* ----------------- ADMIN DASHBOARD VIEW ----------------- */}
        {isAdminMode ? (
          <div className="flex-1 flex flex-col">
            {!isAdminLoggedIn ? (
              <div className="max-w-md w-full mx-auto my-auto bg-white border border-neutral-100 rounded-3xl p-8 shadow-md">
                <div className="text-center space-y-2 mb-6">
                  <div className="inline-flex p-3 bg-neutral-950 text-white rounded-2xl shadow-sm">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-neutral-900">Admin Authentication</h2>
                  <p className="text-xs text-neutral-400">
                    Provide credentials below to access SliceMatic system orders
                  </p>
                </div>

                <form onSubmit={handleAdminLogin} className="space-y-4">
                  {adminError && (
                    <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-3 text-xs font-medium">
                      {adminError}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">Admin Email</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g., admin@slicematic.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">Passcode</label>
                    <input
                      type="password"
                      required
                      placeholder="Enter password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition"
                    />
                    <span className="text-[10px] text-neutral-400 italic block mt-1">
                      Dev test bypass credentials: <strong>admin@slicematic.com</strong> / <strong>slicematic123</strong>
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold py-3 rounded-xl transition shadow-sm cursor-pointer mt-2 text-sm"
                  >
                    Enter Dashboard
                  </button>
                </form>
              </div>
            ) : (() => {
              // Helper lookups
              const getBaseName = (baseId: string) => {
                const b = bases.find(item => item.id === baseId);
                return b ? b.name : (FALLBACK_BASES.find(item => item.id === baseId)?.name || baseId);
              };

              const getPizzaName = (pizzaId: string) => {
                const p = pizzas.find(item => item.id === pizzaId);
                return p ? p.name : (FALLBACK_PIZZAS.find(item => item.id === pizzaId)?.name || pizzaId);
              };

              // Shreya's Today's stats calculation
              const getTodayStats = () => {
                const today = allOrders.filter((o) => {
                  if (!o.created_at) return false;
                  const d = new Date(o.created_at);
                  const ref = new Date();
                  return (
                    d.getFullYear() === ref.getFullYear() &&
                    d.getMonth() === ref.getMonth() &&
                    d.getDate() === ref.getDate()
                  );
                });

                return {
                  orderCount: today.length,
                  revenue: today.reduce((sum, o) => sum + (o.final_payable || 0), 0),
                  gstCollected: today.reduce((sum, o) => sum + (o.gst_amount || 0), 0),
                  discountGiven: today.reduce((sum, o) => sum + (o.discount_amount || 0), 0),
                  pizzasSold: today.reduce((sum, o) => sum + (o.quantity || 0), 0),
                };
              };

              // Shreya's Weekly Bestsellers (7 days) calculation
              const getWeeklyBestSellers = () => {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);

                const counts = new Map<string, number>();
                for (const order of allOrders) {
                  if (!order.created_at) continue;
                  if (new Date(order.created_at) < weekAgo) continue;
                  
                  const pizzaName = getPizzaName(order.pizza_id);
                  counts.set(pizzaName, (counts.get(pizzaName) ?? 0) + (order.quantity || 0));
                }

                return Array.from(counts.entries())
                  .map(([name, sold]) => ({ name, sold }))
                  .sort((a, b) => b.sold - a.sold);
              };

              const stats = getTodayStats();
              const bestSellers = getWeeklyBestSellers();
              const maxBestSellerSold = bestSellers.length > 0 ? bestSellers[0].sold : 1;

              // Filter orders based on search query
              const filteredOrders = allOrders.filter(o => {
                const query = adminSearchQuery.toLowerCase();
                if (!query) return true;
                return (
                  o.customer_name?.toLowerCase().includes(query) ||
                  o.customer_phone?.includes(query) ||
                  o.id?.toLowerCase().includes(query)
                );
              });

              return (
                <div className="flex-1 flex flex-col gap-6">
                  {/* Admin Header with Menu Switcher */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-black text-neutral-900 tracking-tight">SliceMatic Operations Center</h2>
                        <span className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-2 py-0.5 rounded-full border border-emerald-100">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                          Live Sync
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400">Manage real-time incoming orders, view rich topping analytics, and enter staff orders seamlessly.</p>
                    </div>

                    {/* Menu Switcher (Order Entry Desk, Analytics & Configurations) */}
                    <div className="flex flex-wrap items-center bg-neutral-100 p-1 rounded-xl shrink-0 self-start md:self-auto gap-1">
                      <button
                        onClick={() => setAdminMenu('order-entry')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          adminMenu === 'order-entry'
                            ? 'bg-white text-neutral-950 shadow-xs'
                            : 'text-neutral-500 hover:text-neutral-800'
                        }`}
                      >
                        <PizzaIcon className="w-3.5 h-3.5 text-orange-500" />
                        Order Entry Desk
                      </button>
                      <button
                        onClick={() => {
                          setAdminMenu('analytics');
                          if (adminTab !== 'overview' && adminTab !== 'menu-insights') {
                            setAdminTab('overview');
                          }
                        }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          adminMenu === 'analytics'
                            ? 'bg-white text-neutral-950 shadow-xs'
                            : 'text-neutral-500 hover:text-neutral-800'
                        }`}
                      >
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                        Analytics
                      </button>
                      <button
                        onClick={() => setAdminMenu('configurations')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          adminMenu === 'configurations'
                            ? 'bg-white text-neutral-950 shadow-xs'
                            : 'text-neutral-500 hover:text-neutral-800'
                        }`}
                      >
                        <Settings className="w-3.5 h-3.5 text-blue-500" />
                        Configurations
                      </button>
                    </div>
                  </div>

                  {adminMenu === 'order-entry' && (
                    <div className="flex-1">
                      {renderOrderEntryDesk()}
                    </div>
                  )}

                  {adminMenu === 'analytics' && (
                    <div className="space-y-6">
                      {/* Headline Statistics Cards */}
                      {!ordersLoading && allOrders.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          {/* Stat Card: Today's Orders */}
                          <div className="bg-white p-5 rounded-2xl border-l-4 border-l-orange-500 border border-neutral-100 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Today's Orders</span>
                              <ShoppingBag className="w-4 h-4 text-orange-500" />
                            </div>
                            <div className="mt-2">
                              <span className="text-2xl font-black text-neutral-900">{stats.orderCount}</span>
                              <span className="text-[10px] text-neutral-400 block">+100% real-time</span>
                            </div>
                          </div>

                          {/* Stat Card: Pizzas Sold */}
                          <div className="bg-white p-5 rounded-2xl border-l-4 border-l-red-500 border border-neutral-100 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Pizzas Sold</span>
                              <PizzaIcon className="w-4 h-4 text-red-500" />
                            </div>
                            <div className="mt-2">
                              <span className="text-2xl font-black text-neutral-900">{stats.pizzasSold}</span>
                              <span className="text-[10px] text-neutral-400 block">Avg qty: {(stats.pizzasSold / (stats.orderCount || 1)).toFixed(1)} / order</span>
                            </div>
                          </div>

                          {/* Stat Card: Today's Revenue */}
                          <div className="bg-white p-5 rounded-2xl border-l-4 border-l-emerald-500 border border-neutral-100 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Revenue</span>
                              <TrendingUp className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div className="mt-2">
                              <span className="text-2xl font-black text-emerald-600">₹{stats.revenue.toFixed(2)}</span>
                              <span className="text-[10px] text-neutral-400 block">Net proceeds</span>
                            </div>
                          </div>

                          {/* Stat Card: GST Collected */}
                          <div className="bg-white p-5 rounded-2xl border-l-4 border-l-neutral-700 border border-neutral-100 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">GST (18%)</span>
                              <Percent className="w-4 h-4 text-neutral-600" />
                            </div>
                            <div className="mt-2">
                              <span className="text-2xl font-black text-neutral-800">₹{stats.gstCollected.toFixed(2)}</span>
                              <span className="text-[10px] text-neutral-400 block">Indirect Tax ledger</span>
                            </div>
                          </div>

                          {/* Stat Card: Discounts Given */}
                          <div className="bg-white p-5 rounded-2xl border-l-4 border-l-purple-500 border border-neutral-100 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Discounts</span>
                              <Tag className="w-4 h-4 text-purple-500" />
                            </div>
                            <div className="mt-2">
                              <span className="text-2xl font-black text-purple-600">₹{stats.discountGiven.toFixed(2)}</span>
                              <span className="text-[10px] text-neutral-400 block">Volume campaigns</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Sub-tabs for Analytics */}
                      <div className="flex items-center gap-2 border-b border-neutral-100 pb-1">
                        <button
                          onClick={() => setAdminTab('overview')}
                          className={`px-4 py-2 text-xs font-extrabold uppercase tracking-wider border-b-2 transition ${
                            adminTab === 'overview'
                              ? 'border-orange-500 text-orange-600'
                              : 'border-transparent text-neutral-400 hover:text-neutral-600'
                          }`}
                        >
                          Overview (KDS)
                        </button>
                        <button
                          onClick={() => setAdminTab('menu-insights')}
                          className={`px-4 py-2 text-xs font-extrabold uppercase tracking-wider border-b-2 transition ${
                            adminTab === 'menu-insights'
                              ? 'border-orange-500 text-orange-600'
                              : 'border-transparent text-neutral-400 hover:text-neutral-600'
                          }`}
                        >
                          Menu Insights
                        </button>
                      </div>

                      {/* TAB CONTENT: OVERVIEW (ORDERS KDS LOGGER) */}
                      {adminTab === 'overview' && (
                    <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
                      
                      {/* Left: Orders Table Panel */}
                      <div className="w-full lg:w-8/12 bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-50/20">
                          <div>
                            <h3 className="text-sm font-bold text-neutral-800">Incoming Orders KDS Dashboard</h3>
                            <p className="text-xs text-neutral-400">Total: {allOrders.length} orders log synced</p>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Payment Mode Badges Filters */}
                            <div className="flex items-center bg-neutral-100/80 p-0.5 rounded-lg border border-neutral-200/50">
                              {['All', 'UPI', 'Card', 'Cash'].map((pm) => (
                                <button
                                  key={pm}
                                  onClick={() => setAdminPaymentFilter(pm)}
                                  className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer ${
                                    adminPaymentFilter === pm
                                      ? 'bg-white text-neutral-900 shadow-xs'
                                      : 'text-neutral-400 hover:text-neutral-700'
                                  }`}
                                >
                                  {pm}
                                </button>
                              ))}
                            </div>

                            {/* Search Input */}
                            <div className="relative w-full sm:w-48">
                              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                placeholder="Search name..."
                                value={adminSearchQuery}
                                onChange={(e) => setAdminSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-neutral-900/10 focus:border-neutral-900 transition bg-white"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          {ordersLoading ? (
                            <div className="py-24 text-center space-y-3">
                              <div className="inline-block w-8 h-8 border-4 border-neutral-200 border-t-neutral-950 rounded-full animate-spin" />
                              <p className="text-xs text-neutral-400">Synchronising database orders log...</p>
                            </div>
                          ) : (() => {
                            // Computed live search and payment filtered array
                            const filteredOrders = allOrders.filter(o => {
                              const query = adminSearchQuery.toLowerCase();
                              const matchesQuery = !query || (
                                o.customer_name.toLowerCase().includes(query) ||
                                o.customer_phone.includes(query) ||
                                getBaseName(o.base_id).toLowerCase().includes(query) ||
                                getPizzaName(o.pizza_id).toLowerCase().includes(query) ||
                                (o.id && String(o.id).includes(query))
                              );
                              
                              const matchesPayment = adminPaymentFilter === 'All' || o.payment_mode === adminPaymentFilter;
                              return matchesQuery && matchesPayment;
                            });

                            if (filteredOrders.length === 0) {
                              return (
                                <div className="py-24 text-center space-y-2">
                                  <p className="text-sm font-bold text-neutral-600">No Orders Match filters</p>
                                  <p className="text-xs text-neutral-400">Modify your search keywords or payment filters above.</p>
                                </div>
                              );
                            }

                            return (
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-neutral-50 text-neutral-400 text-[10px] uppercase font-bold tracking-wider border-b border-neutral-100">
                                    <th className="py-4 px-4 whitespace-nowrap">ID</th>
                                    <th className="py-4 px-4 whitespace-nowrap">Timestamp</th>
                                    <th className="py-4 px-4 whitespace-nowrap">Customer</th>
                                    <th className="py-4 px-4 whitespace-nowrap">Pizza Specs</th>
                                    <th className="py-4 px-4 text-center whitespace-nowrap">Qty</th>
                                    <th className="py-4 px-4 text-center whitespace-nowrap">Status</th>
                                    <th className="py-4 px-4 text-right whitespace-nowrap">Price</th>
                                    <th className="py-4 px-4 text-center whitespace-nowrap">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-50 text-xs font-mono">
                                  {filteredOrders.map((order, idx) => {
                                    const baseName = getBaseName(order.base_id);
                                    const pizzaName = getPizzaName(order.pizza_id);
                                    const orderIdStr = String(order.id || idx);
                                    
                                    // Interactive kitchen states
                                    const currentStatus = orderStatuses[orderIdStr] || 'Kitchen Sync';
                                    const isPrinted = printedOrders[orderIdStr] || false;

                                    return (
                                      <tr key={order.id || idx} className="hover:bg-neutral-50/30 transition">
                                        <td className="py-4 px-4 text-neutral-400 font-bold whitespace-nowrap">
                                          #{orderIdStr.slice(-4)}
                                        </td>
                                        <td className="py-4 px-4 text-neutral-500 whitespace-nowrap">
                                          {order.created_at ? new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Just Now'}
                                        </td>
                                        <td className="py-4 px-4 font-bold text-neutral-800 uppercase whitespace-nowrap">
                                          <div className="font-extrabold text-neutral-900">{order.customer_name}</div>
                                          <div className="text-[10px] text-neutral-400 font-medium font-sans">+91 {order.customer_phone}</div>
                                        </td>
                                        <td className="py-4 px-4 text-neutral-700 font-sans min-w-[180px] leading-relaxed">
                                          {order.cart && order.cart.length > 0 ? (
                                            <div className="space-y-1.5">
                                              {order.cart.map((cartItem, cIdx) => (
                                                <div key={cartItem.id || cIdx} className="border-b border-neutral-100/50 last:border-none pb-1.5 last:pb-0">
                                                  <div className="font-extrabold text-neutral-900">
                                                    {cartItem.quantity}x {cartItem.pizza?.name || 'Pizza'}
                                                  </div>
                                                  <div className="text-[10px] text-neutral-500 font-medium">
                                                    Crust: {cartItem.base?.name || 'Base'}
                                                  </div>
                                                  {cartItem.toppings && cartItem.toppings.length > 0 && (
                                                    <div className="text-[9px] text-orange-600 font-bold mt-0.5">
                                                      + {cartItem.toppings.map(t => t.name).join(', ')}
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <>
                                              <div className="font-bold text-neutral-900">{pizzaName}</div>
                                              <div className="text-[10px] text-neutral-500 font-medium">Crust: {baseName}</div>
                                              {order.toppings && order.toppings.length > 0 && (
                                                <div className="text-[9px] text-amber-600 font-bold mt-0.5">
                                                  + {order.toppings.map(t => t.name).join(', ')}
                                                </div>
                                              )}
                                            </>
                                          )}
                                        </td>
                                        <td className="py-4 px-4 text-center font-bold text-neutral-800 font-sans">
                                          {order.quantity}
                                        </td>
                                        <td className="py-4 px-4 text-center whitespace-nowrap">
                                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider ${
                                            currentStatus === 'Kitchen Sync' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                            currentStatus === 'Prep' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                                            currentStatus === 'Ready' ? 'bg-teal-100 text-teal-800 border border-teal-200' :
                                            'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                          }`}>
                                            {currentStatus === 'Kitchen Sync' ? 'Kitchen Sync' :
                                             currentStatus === 'Prep' ? 'Kitchen Prep' :
                                             currentStatus === 'Ready' ? 'Ready Pick' : 'Completed'}
                                          </span>
                                        </td>
                                        <td className="py-4 px-4 text-right font-extrabold text-neutral-900 whitespace-nowrap">
                                          ₹{order.final_payable?.toFixed(2)}
                                          <div className="text-[8px] text-neutral-400 font-sans font-medium text-right uppercase tracking-widest">{order.payment_mode}</div>
                                        </td>
                                        <td className="py-4 px-4 text-center whitespace-nowrap">
                                          <div className="flex items-center justify-center gap-1.5 font-sans">
                                            {/* KOT Printing */}
                                            <button
                                              onClick={() => {
                                                setPrintedOrders(prev => ({ ...prev, [orderIdStr]: true }));
                                                setTimeout(() => {
                                                  setPrintedOrders(prev => ({ ...prev, [orderIdStr]: false }));
                                                }, 2000);
                                              }}
                                              className="p-1 text-neutral-500 hover:text-neutral-900 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition cursor-pointer"
                                              title="Print Kitchen Ticket"
                                            >
                                              {isPrinted ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <ClipboardList className="w-3.5 h-3.5" />}
                                            </button>

                                            {/* Advanced operations pipeline progression */}
                                            {currentStatus === 'Kitchen Sync' && (
                                              <button
                                                onClick={() => setOrderStatuses(prev => ({ ...prev, [orderIdStr]: 'Prep' }))}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[9px] uppercase tracking-wider px-2 py-1 rounded transition shadow-xs cursor-pointer"
                                              >
                                                Start Prep
                                              </button>
                                            )}
                                            {currentStatus === 'Prep' && (
                                              <button
                                                onClick={() => setOrderStatuses(prev => ({ ...prev, [orderIdStr]: 'Ready' }))}
                                                className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-[9px] uppercase tracking-wider px-2 py-1 rounded transition shadow-xs cursor-pointer"
                                              >
                                                Mark Ready
                                              </button>
                                            )}
                                            {currentStatus === 'Ready' && (
                                              <button
                                                onClick={() => setOrderStatuses(prev => ({ ...prev, [orderIdStr]: 'Complete' }))}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] uppercase tracking-wider px-2 py-1 rounded transition shadow-xs cursor-pointer"
                                              >
                                                Dispatch
                                              </button>
                                            )}
                                            {currentStatus === 'Complete' && (
                                              <span className="text-[10px] font-bold text-neutral-400 flex items-center gap-0.5">
                                                <Check className="w-3 h-3 text-emerald-500" /> Done
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Right: Best Sellers (7 Days) Panel */}
                      <div className="w-full lg:w-4/12 bg-white rounded-3xl border border-neutral-100 shadow-sm p-6 flex flex-col">
                        <div className="mb-6">
                          <h3 className="text-sm font-bold text-neutral-800">Best Sellers (7 Days)</h3>
                          <p className="text-xs text-neutral-400">Recipe performance ranking by quantity</p>
                        </div>

                        {ordersLoading ? (
                          <div className="py-12 text-center text-xs text-neutral-400 animate-pulse">Calculating sales volume...</div>
                        ) : bestSellers.length === 0 ? (
                          <p className="text-xs text-neutral-400 italic">No pizza sales recorded in the last 7 days.</p>
                        ) : (
                          <div className="space-y-4">
                            {bestSellers.map((item, index) => {
                              const ratio = Math.min(100, Math.max(5, (item.sold / maxBestSellerSold) * 100));
                              return (
                                <div key={item.name} className="space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-neutral-700">
                                      {index + 1}. {item.name}
                                    </span>
                                    <span className="font-mono font-extrabold text-neutral-900 bg-neutral-50 px-2 py-0.5 rounded-md text-[10px]">
                                      {item.sold} sold
                                    </span>
                                  </div>
                                  <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-orange-500 rounded-full transition-all duration-500" 
                                      style={{ width: `${ratio}%` }} 
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {adminTab === 'menu-insights' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Crust selection trends */}
                      <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-6">
                        <div className="mb-6">
                          <h3 className="text-sm font-bold text-neutral-800">Crust Base Popularity</h3>
                          <p className="text-xs text-neutral-400">Ordering frequency across premium crust styles</p>
                        </div>

                        <div className="space-y-4">
                          {(() => {
                            const baseCounts = bases.map(b => {
                              const count = allOrders.filter(o => o.base_id === b.id).reduce((sum, o) => sum + (o.quantity || 1), 0);
                              return { ...b, count };
                            }).sort((a, b) => b.count - a.count);

                            const maxBaseCount = baseCounts.length > 0 && baseCounts[0].count > 0 ? baseCounts[0].count : 1;

                            return baseCounts.map((bc, idx) => {
                              const ratio = (bc.count / maxBaseCount) * 100;
                              return (
                                <div key={bc.id} className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-neutral-700">{bc.name}</span>
                                    <span className="font-mono font-bold text-neutral-400">{bc.count} sold</span>
                                  </div>
                                  <div className="h-2 w-full bg-neutral-50 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                                      style={{ width: `${ratio}%` }} 
                                    />
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Toppings trends */}
                      <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-6">
                        <div className="mb-6">
                          <h3 className="text-sm font-bold text-neutral-800">Toppings Add-On Analysis</h3>
                          <p className="text-xs text-neutral-400">Total selection frequency in client orders</p>
                        </div>

                        <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                          {(() => {
                            const toppingCounts = toppings.map(t => {
                              const count = allOrders.filter(o => o.toppings?.some((ot: any) => ot.id === t.id)).reduce((sum, o) => sum + (o.quantity || 1), 0);
                              return { ...t, count };
                            }).sort((a, b) => b.count - a.count);

                            const maxToppingCount = toppingCounts.length > 0 && toppingCounts[0].count > 0 ? toppingCounts[0].count : 1;

                            return toppingCounts.map((tc, idx) => {
                              const ratio = (tc.count / maxToppingCount) * 100;
                              return (
                                <div key={tc.id} className="space-y-1">
                                  <div className="flex items-center justify-between text-xs font-sans">
                                    <span className="font-bold text-neutral-700 text-xs">{tc.name}</span>
                                    <span className="font-mono font-bold text-neutral-400 text-[10px]">{tc.count} items</span>
                                  </div>
                                  <div className="h-2 w-full bg-neutral-50 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-orange-500 rounded-full transition-all duration-500" 
                                      style={{ width: `${ratio}%` }} 
                                    />
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Pizza Style revenue performance */}
                      <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-6">
                        <div className="mb-6">
                          <h3 className="text-sm font-bold text-neutral-800">Pizza Style Performance</h3>
                          <p className="text-xs text-neutral-400">Aggregate volume and revenue stats</p>
                        </div>

                        <div className="space-y-3">
                          {(() => {
                            const pizzaCounts = pizzas.map(p => {
                              const count = allOrders.filter(o => o.pizza_id === p.id).reduce((sum, o) => sum + (o.quantity || 1), 0);
                              const revenue = allOrders.filter(o => o.pizza_id === p.id).reduce((sum, o) => sum + (o.final_payable || 0), 0);
                              return { ...p, count, revenue };
                            }).sort((a, b) => b.count - a.count);

                            return pizzaCounts.slice(0, 5).map((pc, idx) => {
                              return (
                                <div key={pc.id} className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-xl border border-neutral-100/50">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                      idx === 0 ? 'bg-amber-100 text-amber-700' :
                                      idx === 1 ? 'bg-neutral-200 text-neutral-700' :
                                      idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-neutral-100 text-neutral-500'
                                    }`}>
                                      {idx + 1}
                                    </span>
                                    <div>
                                      <span className="text-xs font-bold text-neutral-800 block">{pc.name}</span>
                                      <span className="text-[10px] text-neutral-400 font-sans">{pc.count} orders sold</span>
                                    </div>
                                  </div>
                                  <span className="text-xs font-extrabold text-neutral-900 font-mono">
                                    ₹{pc.revenue.toFixed(0)}
                                  </span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                    </div>
                  )}
                    </div>
                  )}

                  {adminMenu === 'configurations' && (
                    <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-8 max-w-xl mx-auto space-y-6">
                      <div className="flex items-center gap-3 pb-4 border-b border-neutral-100">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                          <Settings className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-neutral-900">System Configurations</h3>
                          <p className="text-xs text-neutral-400">Manage real-time global settings synced across all server portals.</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-100 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-neutral-700 uppercase tracking-wider block">
                              Discount Pizza Threshold
                            </label>
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded-full border border-indigo-100">
                              Active setting
                            </span>
                          </div>
                          
                          <p className="text-xs text-neutral-500 leading-relaxed">
                            Customers who order this number of pizzas or more across their cart will automatically receive a <strong className="text-neutral-900">10% subtotal discount</strong> on their billing summary.
                          </p>

                          <div className="flex items-center gap-4 pt-2">
                            <div className="flex items-center border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  if (tempThreshold > 1) setTempThreshold(tempThreshold - 1);
                                }}
                                className="px-3 py-2 text-neutral-500 hover:bg-neutral-50 font-bold transition cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={tempThreshold}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (!isNaN(val) && val >= 1) {
                                    setTempThreshold(val);
                                  }
                                }}
                                className="w-16 text-center text-sm font-bold text-neutral-800 focus:outline-hidden"
                              />
                              <button
                                type="button"
                                onClick={() => setTempThreshold(tempThreshold + 1)}
                                className="px-3 py-2 text-neutral-500 hover:bg-neutral-50 font-bold transition cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-xs text-neutral-400 font-medium">Pizzas required</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                        <button
                          onClick={handleRefreshThreshold}
                          disabled={configLoading}
                          className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-800 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${configLoading ? 'animate-spin' : ''}`} />
                          Reload
                        </button>

                        <button
                          onClick={handleSaveThreshold}
                          disabled={configLoading}
                          className="px-5 py-2.5 text-xs font-extrabold text-white bg-neutral-950 hover:bg-neutral-900 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {configLoading ? (
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          Save Configurations
                        </button>
                      </div>

                      {configMessage && (
                        <div className={`text-xs p-3.5 rounded-xl border font-semibold animate-fade-in ${
                          configMessage.type === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-red-50 text-red-700 border-red-100'
                        }`}>
                          {configMessage.text}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          /* ----------------- CLIENT ORDERING PORTAL VIEW ----------------- */
          renderOrderEntryDesk()
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-neutral-100 py-6 px-6 md:px-12 mt-12 text-center text-neutral-400 text-xs">
        <p>
          © 2026 SliceMatic. All rights reserved. Crafted for Rajan's Pizza Brand, New Ashok Nagar, Delhi.
          {currentPath !== '/admin' ? (
            <>
              {' • '}
              <button 
                onClick={() => navigate('/admin')} 
                className="hover:text-neutral-700 underline cursor-pointer inline bg-transparent border-none p-0 font-medium"
              >
                Staff Login
              </button>
            </>
          ) : (
            <>
              {' • '}
              <button 
                onClick={() => navigate('/')} 
                className="hover:text-neutral-700 underline cursor-pointer inline bg-transparent border-none p-0 font-medium"
              >
                Live Store
              </button>
            </>
          )}
        </p>
      </footer>
    </div>
  );
}
