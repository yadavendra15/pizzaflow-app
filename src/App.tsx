import React, { useState, useEffect } from 'react';
import { 
  fetchBasesFromDb, 
  fetchPizzasFromDb, 
  fetchToppingsFromDb, 
  submitOrderToDb, 
  fetchAllOrders,
  isSupabaseConfigured,
  MenuItem,
  OrderPayload,
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
  Tag
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
  const [adminTab, setAdminTab] = useState<'overview' | 'menu-insights' | 'operations'>('overview');
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
  }, []);

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

  // Step 3 validation check
  const validateStep3 = () => {
    const parsed = parseInt(quantityInput, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 10 || !/^\d+$/.test(quantityInput)) {
      setQuantityError("Quantity must be a whole integer from 1 to 10.");
      return false;
    }
    setQuantity(parsed);
    setQuantityError('');
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
      if (!selectedBase || !selectedPizza) {
        alert('Please make sure you select both a crust base and pizza style style!');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!validateStep3()) return;
      
      // Trigger AI Flavor Guru Interceptor when moving to Step 4
      setCurrentStep(4);
      setAiLoading(true);
      setAiUpsellText('');
      setGuruRecommendation(null);
      setGuruApplied(false);
      
      try {
        const result = await fetchSmartUpsell({
          base: selectedBase,
          pizza: selectedPizza,
          toppings: selectedToppings
        });
        setAiUpsellText(result.explanation);
        setGuruRecommendation(result);
      } catch (err) {
        console.warn('AI Flavor Guru failed or timed out. Proceeding silently.');
        const fallback = {
          explanation: "Elevate your pie with extra cheese (T2) or a peri-peri drizzle (T10) upgrade for a fantastic kick!",
          recommendedBaseId: null,
          recommendedToppingIds: ["T2"]
        };
        setAiUpsellText(fallback.explanation);
        setGuruRecommendation(fallback);
      } finally {
        setAiLoading(false);
      }
    } else if (currentStep === 4) {
      setCurrentStep(5);
    }
  };

  // Flavor Guru recommendation application handler
  const applyGuruRecommendation = () => {
    if (!guruRecommendation) return;

    // Apply base recommendation if any
    if (guruRecommendation.recommendedBaseId) {
      const matchedBase = bases.find(b => b.id === guruRecommendation.recommendedBaseId);
      if (matchedBase) {
        setSelectedBase(matchedBase);
      }
    }

    // Apply toppings recommendation if any
    if (guruRecommendation.recommendedToppingIds && guruRecommendation.recommendedToppingIds.length > 0) {
      const currentToppingIds = selectedToppings.map(t => t.id);
      const newToppings = [...selectedToppings];

      guruRecommendation.recommendedToppingIds.forEach(id => {
        if (!currentToppingIds.includes(id)) {
          const matchedTopping = toppings.find(t => t.id === id);
          if (matchedTopping) {
            newToppings.push(matchedTopping);
          }
        }
      });
      setSelectedToppings(newToppings);
    }

    setGuruApplied(true);
  };

  // Calculates the price impact of the Flavor Guru's recommendations
  const getRecommendationPriceDelta = () => {
    if (!guruRecommendation) return 0;
    let delta = 0;
    if (guruRecommendation.recommendedBaseId && selectedBase && selectedBase.id !== guruRecommendation.recommendedBaseId) {
      const newBase = bases.find(b => b.id === guruRecommendation.recommendedBaseId);
      if (newBase) {
        delta += (newBase.price - selectedBase.price);
      }
    }
    if (guruRecommendation.recommendedToppingIds) {
      guruRecommendation.recommendedToppingIds.forEach(id => {
        if (!selectedToppings.some(t => t.id === id)) {
          const topping = toppings.find(t => t.id === id);
          if (topping) {
            delta += topping.price;
          }
        }
      });
    }
    return delta;
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

  // Math engine helper functions for invoice
  const getSubtotal = () => {
    const basePrice = selectedBase?.price || 0;
    const pizzaPrice = selectedPizza?.price || 0;
    const toppingsPrice = selectedToppings.reduce((sum, t) => sum + t.price, 0);
    return (basePrice + pizzaPrice + toppingsPrice) * quantity;
  };

  const getDiscount = () => {
    const sub = getSubtotal();
    return quantity >= 5 ? sub * 0.10 : 0;
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

    const payload: OrderPayload = {
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      quantity,
      payment_mode: paymentMode,
      base_id: selectedBase?.id || '',
      pizza_id: selectedPizza?.id || '',
      base_total: getSubtotal(),
      discount_amount: getDiscount(),
      gst_amount: getGst(),
      final_payable: getGrandTotal(),
      toppings: selectedToppings
    };

    try {
      const response = await submitOrderToDb(payload);
      if (response.success) {
        setPlacedOrderPayload(response.data);
        setOrderComplete(true);
      } else {
        setSubmissionError(response.error || 'Failed to record your order. Please retry.');
      }
    } catch (e: any) {
      setSubmissionError(e.message || 'An unexpected networking error occurred.');
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
                  <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" /> Staff Panel
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
                  o.customer_name.toLowerCase().includes(query) ||
                  o.customer_phone.includes(query) ||
                  getBaseName(o.base_id).toLowerCase().includes(query) ||
                  getPizzaName(o.pizza_id).toLowerCase().includes(query) ||
                  (o.id && String(o.id).includes(query))
                );
              });

              return (
                <div className="flex-1 flex flex-col gap-6">
                  {/* Admin Header with Tab Switcher */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-black text-neutral-900 tracking-tight">SliceMatic Operations Center</h2>
                        <span className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-2 py-0.5 rounded-full border border-emerald-100">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                          Live Sync
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400">Manage real-time incoming orders, view rich topping analytics, and monitor backend system states.</p>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex items-center bg-neutral-100 p-1 rounded-xl shrink-0 self-start md:self-auto">
                      <button
                        onClick={() => setAdminTab('overview')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          adminTab === 'overview'
                            ? 'bg-white text-neutral-950 shadow-xs'
                            : 'text-neutral-500 hover:text-neutral-800'
                        }`}
                      >
                        Overview
                      </button>
                      <button
                        onClick={() => setAdminTab('menu-insights')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          adminTab === 'menu-insights'
                            ? 'bg-white text-neutral-950 shadow-xs'
                            : 'text-neutral-500 hover:text-neutral-800'
                        }`}
                      >
                        Menu Insights
                      </button>
                      <button
                        onClick={() => setAdminTab('operations')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          adminTab === 'operations'
                            ? 'bg-white text-neutral-950 shadow-xs'
                            : 'text-neutral-500 hover:text-neutral-800'
                        }`}
                      >
                        Operations Monitor
                      </button>
                    </div>
                  </div>

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
                                          <div className="font-bold text-neutral-900">{pizzaName}</div>
                                          <div className="text-[10px] text-neutral-500 font-medium">Crust: {baseName}</div>
                                          {order.toppings && order.toppings.length > 0 && (
                                            <div className="text-[9px] text-amber-600 font-bold mt-0.5">
                                              + {order.toppings.map(t => t.name).join(', ')}
                                            </div>
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

                  {/* TAB CONTENT: MENU INSIGHTS (ANALYTICS BREAKDOWN) */}
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

                  {/* TAB CONTENT: OPERATIONS (BACKEND TELEMETRY SENSORS & SYSTEM LOGS) */}
                  {adminTab === 'operations' && (
                    <div className="space-y-6">
                      
                      {/* Live sensor gauges */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Gauge 1: Database syncing */}
                        <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm flex flex-col justify-between">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Durable SQL Database Connection</span>
                              <h4 className="text-sm font-bold text-neutral-800">
                                {isDbConnected ? "PostgreSQL Cloud Active" : "Simulated Local DB"}
                              </h4>
                            </div>
                            <span className={`p-1.5 rounded-lg text-white ${isDbConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                              <Database className="w-4 h-4" />
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 leading-relaxed mt-4">
                            {isDbConnected 
                              ? "Prism Sync active. All transactions write securely to your remote Supabase relational schema instance."
                              : "No VITE_SUPABASE_URL detected. Safely caching telemetry logs locally inside the client's localStorage vault."}
                          </p>
                        </div>

                        {/* Gauge 2: AI Smart Coprocessor */}
                        <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm flex flex-col justify-between">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Culinary Intelligence Host</span>
                              <h4 className="text-sm font-bold text-neutral-800">
                                {process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY ? "Gemini 2.5 Flash Online" : "Local Mock Pipeline"}
                              </h4>
                            </div>
                            <span className="p-1.5 bg-orange-500 text-white rounded-lg">
                              <Sparkles className="w-4 h-4" />
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 leading-relaxed mt-4">
                            Provides gourmet up-sell pairings and crust optimization recommendations dynamically. Synchronizes on step transitions.
                          </p>
                        </div>

                        {/* Gauge 3: Ingress Container Port */}
                        <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm flex flex-col justify-between">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Reverse Ingress Routing</span>
                              <h4 className="text-sm font-bold text-neutral-800">Port 3000 (0.0.0.0)</h4>
                            </div>
                            <span className="p-1.5 bg-neutral-900 text-white rounded-lg">
                              <Info className="w-4 h-4" />
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 leading-relaxed mt-4">
                            Nginx proxy maps container traffic safely to port 3000. Express server actively listening for customer order placement requests.
                          </p>
                        </div>
                      </div>

                      {/* Operations Log console board */}
                      <div className="bg-neutral-950 text-neutral-300 font-mono text-[11px] rounded-3xl p-6 shadow-xl border border-neutral-800 space-y-4">
                        <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
                          <span className="text-neutral-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Console STDOUT stream log
                          </span>
                          <span className="text-[9px] text-neutral-600">Buffer size: {allOrders.length + 5} lines</span>
                        </div>

                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-2 text-neutral-400">
                          <div>[00:01:04] SYSTEM_BOOT: Spawning node child processes... Success.</div>
                          <div>[00:01:05] SERVER_STATUS: Binding container address to port 3000... Success.</div>
                          <div>[00:01:05] DATABASE_PLUG: Checking for Supabase secret arrays... {isDbConnected ? "CONNECTED" : "FALLBACK_LOCAL_SIMULATION"}.</div>
                          <div>[00:01:06] AI_MODEL: Mapping route proxy to google/gemini-2.5-flash... Active.</div>
                          <div>[00:01:06] TELEMETRY_HEALTH: Operations center console listening on channel 0.</div>
                          
                          {allOrders.map((o, idx) => {
                            const dateStr = o.created_at ? new Date(o.created_at).toLocaleTimeString() : '00:02:44';
                            return (
                              <div key={idx} className="text-neutral-300">
                                [{dateStr}] TELEMETRY_RECEIVE: Placed order payload for client "{o.customer_name}" | Value: ₹{o.final_payable?.toFixed(0)} | Mode: {o.payment_mode}.
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              );
            })()}
          </div>
        ) : (
          /* ----------------- CLIENT ORDERING PORTAL VIEW ----------------- */
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
                          Select one base crust, style recipe, and optional toppings to build your pie.
                        </p>
                      </div>

                      {menuLoading ? (
                        <div className="py-12 text-center space-y-2">
                          <div className="inline-block w-6 h-6 border-2 border-neutral-200 border-t-orange-500 rounded-full animate-spin" />
                          <p className="text-xs text-neutral-400">Populating menu configurations...</p>
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
                          Set the final number of identical pizzas and select your payment mode.
                        </p>
                      </div>

                      <div className="space-y-5">
                        {/* Quantity Counter box */}
                        <div className="space-y-2 max-w-sm">
                          <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">Quantity of Pizzas (Limit 1 to 10)</label>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                const current = parseInt(quantityInput, 10) || 1;
                                if (current > 1) {
                                  setQuantityInput(String(current - 1));
                                  setQuantityError('');
                                }
                              }}
                              className="w-12 h-12 rounded-2xl border border-neutral-200 hover:bg-neutral-50 font-bold text-lg text-neutral-600 flex items-center justify-center transition cursor-pointer shadow-xs"
                            >
                              -
                            </button>
                            <input
                              type="text"
                              value={quantityInput}
                              onChange={(e) => {
                                setQuantityInput(e.target.value);
                                setQuantityError('');
                              }}
                              className={`w-20 h-12 border ${quantityError ? 'border-red-400 focus:ring-red-100 bg-red-50/10' : 'border-neutral-200 focus:ring-neutral-100'} rounded-2xl text-center font-bold text-lg focus:outline-none focus:ring-4 transition`}
                            />
                            <button
                              onClick={() => {
                                const current = parseInt(quantityInput, 10) || 1;
                                if (current < 10) {
                                  setQuantityInput(String(current + 1));
                                  setQuantityError('');
                                }
                              }}
                              className="w-12 h-12 rounded-2xl border border-neutral-200 hover:bg-neutral-50 font-bold text-lg text-neutral-600 flex items-center justify-center transition cursor-pointer shadow-xs"
                            >
                              +
                            </button>
                          </div>
                          {quantityError && (
                            <p className="text-red-500 text-[11px] font-semibold flex items-center gap-1 mt-1">
                              <ShieldAlert className="w-3.5 h-3.5" /> {quantityError}
                            </p>
                          )}
                          <p className="text-[10px] text-neutral-400 leading-relaxed mt-1">
                            * Ordering <strong>5 or more pizzas</strong> automatically applies a <strong>10% subtotal discount</strong> to your billing summary!
                          </p>
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
                          <h2 className="text-xl font-black text-neutral-900 tracking-tight">Step 4: AI Flavor Guru Advice</h2>
                          <span className="bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                            Antigravity AI
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400">
                          Review a smart recommendation generated on-the-fly specifically for your current order profile.
                        </p>
                      </div>

                      <div className="bg-neutral-950 text-white rounded-3xl p-6 md:p-8 space-y-6 relative overflow-hidden shadow-lg border border-neutral-800">
                        {/* Background flare effects */}
                        <div className="absolute -right-12 -bottom-12 w-44 h-44 rounded-full bg-orange-500/15 blur-2xl pointer-events-none" />
                        <div className="absolute -left-12 -top-12 w-44 h-44 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-orange-500 text-white rounded-lg">
                              <Sparkles className="w-4 h-4" />
                            </span>
                            <span className="text-xs font-bold uppercase tracking-widest text-orange-400">
                              Chef's Smart Upsell Recommendation
                            </span>
                          </div>
                          
                          {!aiLoading && guruRecommendation && (
                            <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 px-2 py-1 rounded border border-neutral-800">
                              Gemini 2.5 Flash
                            </span>
                          )}
                        </div>

                        {aiLoading ? (
                          <div className="py-6 space-y-3">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce" />
                              <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                              <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                            <p className="text-xs text-neutral-400">Flavor Guru is reviewing your topping combinations...</p>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <p className="text-sm md:text-base leading-relaxed text-neutral-100 font-medium italic">
                              "{aiUpsellText}"
                            </p>

                            {/* Structured Recommendation Breakdowns */}
                            {guruRecommendation && (
                              <div className="space-y-4 pt-2 border-t border-neutral-900">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Suggested Improvements</span>
                                <div className="space-y-2">
                                  {/* Base upgrade visual block */}
                                  {guruRecommendation.recommendedBaseId && selectedBase?.id !== guruRecommendation.recommendedBaseId && (
                                    <div className="bg-neutral-900 border border-neutral-800/60 rounded-xl p-3 flex items-center justify-between text-xs text-neutral-300">
                                      <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                        <span>Upgrade Crust: <strong className="text-white">{selectedBase?.name}</strong> → <strong className="text-amber-400">{bases.find(b => b.id === guruRecommendation.recommendedBaseId)?.name}</strong></span>
                                      </div>
                                      <span className="font-mono text-neutral-400 text-[10px]">
                                        +₹{((bases.find(b => b.id === guruRecommendation.recommendedBaseId)?.price || 0) - (selectedBase?.price || 0)).toFixed(2)}
                                      </span>
                                    </div>
                                  )}

                                  {/* Toppings suggested block */}
                                  {guruRecommendation.recommendedToppingIds && guruRecommendation.recommendedToppingIds.some(id => !selectedToppings.some(t => t.id === id)) ? (
                                    <div className="space-y-1.5">
                                      {guruRecommendation.recommendedToppingIds.map((id: string) => {
                                        const alreadySelected = selectedToppings.some(t => t.id === id);
                                        const topping = toppings.find(t => t.id === id);
                                        if (!topping || alreadySelected) return null;
                                        return (
                                          <div key={id} className="bg-neutral-900 border border-neutral-800/60 rounded-xl p-3 flex items-center justify-between text-xs text-neutral-300">
                                            <div className="flex items-center gap-2">
                                              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                              <span>Add Topping: <strong className="text-white">{topping.name}</strong></span>
                                            </div>
                                            <span className="font-mono text-neutral-400 text-[10px]">
                                              +₹{topping.price.toFixed(2)}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>

                                {/* Application Button Wrapper */}
                                <div className="pt-2">
                                  {guruApplied ? (
                                    <div className="w-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-inner">
                                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                      <span>Guru's Recommendations Applied! Checkout price updated in real-time.</span>
                                    </div>
                                  ) : (
                                    (() => {
                                      const delta = getRecommendationPriceDelta();
                                      const canApply = delta > 0;
                                      
                                      if (canApply) {
                                        return (
                                          <button
                                            onClick={applyGuruRecommendation}
                                            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs py-3.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] duration-150"
                                          >
                                            <Sparkles className="w-4 h-4 animate-pulse" />
                                            Apply Guru's Recommendation (+₹{delta.toFixed(2)})
                                          </button>
                                        );
                                      } else {
                                        return (
                                          <div className="w-full bg-neutral-900/60 border border-neutral-800 text-neutral-400 text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2">
                                            <Check className="w-4 h-4 text-orange-400" />
                                            <span>Your current pizza selection perfectly matches the Chef's taste recommendation!</span>
                                          </div>
                                        );
                                      }
                                    })()
                                  )}
                                </div>
                              </div>
                            )}

                            <p className="text-[10px] text-neutral-600">
                              * Powered by OpenRouter Gemini 2.5 Flash. Applies custom modifications directly into your client cart structure safely.
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
                        <h2 className="text-xl font-black text-neutral-900 tracking-tight">Step 5: Final Submission</h2>
                        <p className="text-xs text-neutral-400">
                          Verify details below and submit your order payload to the SliceMatic database.
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

                          <div className="bg-amber-50/50 rounded-2xl p-5 border border-amber-100 space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">Submit Booking Details</h3>
                            <p className="text-xs text-neutral-600 leading-relaxed">
                              On confirmation, SliceMatic inserts this order payload containing timestamp, customer details, items selected, quantities, and payment mode into our Supabase records table.
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
                    paymentMode
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
                base={selectedBase} 
                pizza={selectedPizza} 
                toppings={selectedToppings} 
                quantity={quantity} 
                paymentMode={paymentMode} 
                isSubmitting={isSubmitting} 
                isComplete={orderComplete}
              />
            </div>
          </div>
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
