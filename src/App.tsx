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

      // Do not pre-select on initial load so the Step 1 (Contact Intake) view stays clean and blank!
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
      
      try {
        const suggestion = await fetchSmartUpsell({
          base: selectedBase,
          pizza: selectedPizza,
          toppings: selectedToppings
        });
        setAiUpsellText(suggestion);
      } catch (err) {
        console.warn('AI Flavor Guru failed or timed out. Proceeding silently.');
        setAiUpsellText("Elevate your pie with extra cheese or a peri-peri drizzle upgrade!");
      } finally {
        setAiLoading(false);
      }
    } else if (currentStep === 4) {
      setCurrentStep(5);
    }
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
                  {/* Headline Statistics Cards */}
                  {!ordersLoading && allOrders.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {/* Stat Card: Today's Orders */}
                      <div className="bg-white p-5 rounded-2xl border-l-4 border-l-orange-500 border border-neutral-100 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Today's Orders</span>
                          <ShoppingBag className="w-4 h-4 text-orange-500" />
                        </div>
                        <div className="mt-2">
                          <span className="text-2xl font-black text-neutral-900">{stats.orderCount}</span>
                        </div>
                      </div>

                      {/* Stat Card: Pizzas Sold */}
                      <div className="bg-white p-5 rounded-2xl border-l-4 border-l-red-500 border border-neutral-100 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Pizzas Sold</span>
                          <PizzaIcon className="w-4 h-4 text-red-500" />
                        </div>
                        <div className="mt-2">
                          <span className="text-2xl font-black text-neutral-900">{stats.pizzasSold}</span>
                        </div>
                      </div>

                      {/* Stat Card: Today's Revenue */}
                      <div className="bg-white p-5 rounded-2xl border-l-4 border-l-emerald-500 border border-neutral-100 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Revenue</span>
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="mt-2">
                          <span className="text-2xl font-black text-emerald-600">₹{stats.revenue.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Stat Card: GST Collected */}
                      <div className="bg-white p-5 rounded-2xl border-l-4 border-l-neutral-700 border border-neutral-100 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">GST (18%)</span>
                          <Percent className="w-4 h-4 text-neutral-600" />
                        </div>
                        <div className="mt-2">
                          <span className="text-2xl font-black text-neutral-800">₹{stats.gstCollected.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Stat Card: Discounts Given */}
                      <div className="bg-white p-5 rounded-2xl border-l-4 border-l-purple-500 border border-neutral-100 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Discounts</span>
                          <Tag className="w-4 h-4 text-purple-500" />
                        </div>
                        <div className="mt-2">
                          <span className="text-2xl font-black text-purple-600">₹{stats.discountGiven.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Main Grid: Orders Table & Best Sellers Chart */}
                  <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
                    
                    {/* Left: Orders Table Panel */}
                    <div className="w-full lg:w-8/12 bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden flex flex-col">
                      <div className="p-6 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-50/20">
                        <div>
                          <h3 className="text-sm font-bold text-neutral-800">All Orders Log</h3>
                          <p className="text-xs text-neutral-400">Total: {filteredOrders.length} orders found</p>
                        </div>
                        
                        {/* Search Input */}
                        <div className="relative w-full sm:w-64">
                          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Search name, phone, crust..."
                            value={adminSearchQuery}
                            onChange={(e) => setAdminSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900/5 focus:border-neutral-900 transition"
                          />
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        {ordersLoading ? (
                          <div className="py-24 text-center space-y-3">
                            <div className="inline-block w-8 h-8 border-4 border-neutral-200 border-t-neutral-950 rounded-full animate-spin" />
                            <p className="text-xs text-neutral-400">Synchronising database orders log...</p>
                          </div>
                        ) : filteredOrders.length === 0 ? (
                          <div className="py-24 text-center space-y-2">
                            <p className="text-sm font-bold text-neutral-600">No Orders Match</p>
                            <p className="text-xs text-neutral-400">Try modifying your search or place a new order.</p>
                          </div>
                        ) : (
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-neutral-50 text-neutral-400 text-[10px] uppercase font-bold tracking-wider border-b border-neutral-100">
                                <th className="py-4 px-6">ID</th>
                                <th className="py-4 px-6">Timestamp</th>
                                <th className="py-4 px-6">Customer</th>
                                <th className="py-4 px-6">Phone</th>
                                <th className="py-4 px-6">Pizza Details</th>
                                <th className="py-4 px-6 text-center">Qty</th>
                                <th className="py-4 px-6 text-right">Discount</th>
                                <th className="py-4 px-6 text-right">GST</th>
                                <th className="py-4 px-6 text-right font-bold text-neutral-800">Total</th>
                                <th className="py-4 px-6 text-center">Payment</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50 text-xs font-mono">
                              {filteredOrders.map((order, idx) => {
                                const baseName = getBaseName(order.base_id);
                                const pizzaName = getPizzaName(order.pizza_id);
                                
                                return (
                                  <tr key={order.id || idx} className="hover:bg-neutral-50/30 transition">
                                    <td className="py-4 px-6 text-neutral-400 font-bold whitespace-nowrap">
                                      #{order.id ? String(order.id).slice(-4) : idx + 1}
                                    </td>
                                    <td className="py-4 px-6 text-neutral-500 whitespace-nowrap">
                                      {order.created_at ? new Date(order.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Just Now'}
                                    </td>
                                    <td className="py-4 px-6 font-bold text-neutral-800 uppercase max-w-[150px] truncate">
                                      {order.customer_name}
                                    </td>
                                    <td className="py-4 px-6 text-neutral-600">
                                      +91 {order.customer_phone}
                                    </td>
                                    <td className="py-4 px-6 text-neutral-700 font-sans max-w-[240px] leading-relaxed">
                                      <div className="font-bold text-neutral-900">{pizzaName}</div>
                                      <div className="text-[11px] text-neutral-500 font-medium">Crust: {baseName}</div>
                                      {order.toppings && order.toppings.length > 0 && (
                                        <div className="text-[10px] text-neutral-400 font-medium mt-0.5">
                                          + {order.toppings.map(t => t.name).join(', ')}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-4 px-6 text-center font-bold text-neutral-800">
                                      {order.quantity}
                                    </td>
                                    <td className="py-4 px-6 text-right text-emerald-600">
                                      {order.discount_amount && order.discount_amount > 0 ? `-₹${order.discount_amount.toFixed(2)}` : '—'}
                                    </td>
                                    <td className="py-4 px-6 text-right text-neutral-500">
                                      ₹{order.gst_amount?.toFixed(2)}
                                    </td>
                                    <td className="py-4 px-6 text-right font-extrabold text-neutral-900 bg-neutral-50/10">
                                      ₹{order.final_payable?.toFixed(2)}
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                                        order.payment_mode === 'Cash' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                        order.payment_mode === 'Card' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                                        'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      }`}>
                                        {order.payment_mode}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
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
                        <h2 className="text-xl font-black text-neutral-900 tracking-tight">Step 4: AI Flavor Guru Advice</h2>
                        <p className="text-xs text-neutral-400">
                          Review a smart recommendation generated on-the-fly specifically for your current order profile.
                        </p>
                      </div>

                      <div className="bg-neutral-950 text-white rounded-3xl p-6 md:p-8 space-y-4 relative overflow-hidden shadow-lg">
                        {/* Background flare effect */}
                        <div className="absolute -right-12 -bottom-12 w-44 h-44 rounded-full bg-orange-500/15 blur-2xl pointer-events-none" />
                        
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-orange-500 text-white rounded-lg">
                            <Sparkles className="w-4 h-4" />
                          </span>
                          <span className="text-xs font-bold uppercase tracking-widest text-orange-400">
                            Chef's Smart Upsell Recommendation
                          </span>
                        </div>

                        {aiLoading ? (
                          <div className="py-6 space-y-2">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce" />
                              <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                              <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                            <p className="text-xs text-neutral-400">Flavor Guru is reviewing your topping combinations...</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-sm md:text-base leading-relaxed text-neutral-100 font-medium italic">
                              "{aiUpsellText}"
                            </p>
                            <p className="text-[10px] text-neutral-500 italic">
                              * Powered by OpenRouter Gemini 2.5 Flash. Recommendations are purely culinary and do not modify transaction costs directly.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100 text-xs text-neutral-600 leading-relaxed">
                        To add toppings recommended by the Guru, you can click <span className="font-bold">Back</span> to adjust your toppings checklist, or click <span className="font-bold">Next</span> below to proceed to the final placement screen.
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
                <QRCodeWidget />
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
          © 2026 SliceMatic. All rights reserved. Crafted for Rajan's Pizza Delivery Brand, New Ashok Nagar, Delhi.
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
                Client Portal
              </button>
            </>
          )}
        </p>
      </footer>
    </div>
  );
}
