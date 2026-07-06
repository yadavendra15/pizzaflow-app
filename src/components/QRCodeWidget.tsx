import { QRCodeSVG } from 'qrcode.react';
import { useState, useEffect } from 'react';
import { QrCode, Sparkles, X, Check } from 'lucide-react';

interface QRCodeWidgetProps {
  state?: {
    customerName: string;
    customerPhone: string;
    currentStep: number;
    selectedBaseId?: string;
    selectedPizzaId?: string;
    selectedToppingsIds?: string[];
    quantity: number;
    paymentMode: string;
  };
}

export default function QRCodeWidget({ state }: QRCodeWidgetProps) {
  const [currentUrl, setCurrentUrl] = useState('https://ai.studio/build');
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.origin + window.location.pathname);
      if (state) {
        if (state.customerName) url.searchParams.set('name', encodeURIComponent(state.customerName));
        if (state.customerPhone) url.searchParams.set('phone', encodeURIComponent(state.customerPhone));
        if (state.currentStep) url.searchParams.set('step', String(state.currentStep));
        if (state.selectedBaseId) url.searchParams.set('base', state.selectedBaseId);
        if (state.selectedPizzaId) url.searchParams.set('pizza', state.selectedPizzaId);
        if (state.selectedToppingsIds && state.selectedToppingsIds.length > 0) {
          url.searchParams.set('toppings', state.selectedToppingsIds.join(','));
        }
        if (state.quantity) url.searchParams.set('qty', String(state.quantity));
        if (state.paymentMode) url.searchParams.set('payment', state.paymentMode);
      }
      setCurrentUrl(url.toString());
    }
  }, [state]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('[SliceMatic] Failed to copy link to clipboard');
    }
  };

  return (
    <div id="qrcode-container-widget" className="bg-neutral-50 rounded-2xl p-5 border border-neutral-100 flex flex-col sm:flex-row items-center gap-4">
      <div className="bg-white p-3 rounded-xl shadow-sm border border-neutral-100 shrink-0">
        <QRCodeSVG 
          value={currentUrl} 
          size={84}
          bgColor="#ffffff"
          fgColor="#171717"
          level="M"
        />
      </div>

      <div className="flex-1 text-center sm:text-left space-y-1">
        <div className="flex items-center justify-center sm:justify-start gap-1.5 text-neutral-800 font-bold text-sm">
          <QrCode className="w-4 h-4 text-neutral-600" />
          Scan & Share order
        </div>
        <p className="text-xs text-neutral-500 leading-relaxed max-w-xs">
          Scanning this QR code syncs this session, allowing you or counter staff to finish ordering on any mobile phone.
        </p>

        <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="text-[11px] bg-neutral-900 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-neutral-800 transition shadow-sm cursor-pointer"
          >
            Show full-screen
          </button>
          <button
            onClick={handleCopyLink}
            className="text-[11px] bg-white text-neutral-700 font-semibold px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition cursor-pointer flex items-center gap-1"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" /> Copied
              </>
            ) : (
              'Copy URL link'
            )}
          </button>
        </div>
      </div>

      {/* Modal Popup for fullscreen view */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-6 relative shadow-2xl border border-neutral-100 transform scale-100 transition-all duration-300">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 p-1.5 hover:bg-neutral-50 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-amber-50 text-amber-500">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-neutral-800">Scan to Continue</h3>
              <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                Scan with your phone's camera to seamlessly take over the order form and complete payment at the counter.
              </p>
            </div>

            <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100 inline-block">
              <QRCodeSVG 
                value={currentUrl} 
                size={180}
                bgColor="#ffffff"
                fgColor="#171717"
                level="Q"
                includeMargin={true}
              />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Client Portal Sync Link</span>
              <div className="text-xs text-neutral-600 font-mono bg-neutral-50 px-3 py-1.5 rounded-lg truncate border border-neutral-100">
                {currentUrl}
              </div>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="w-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-3 rounded-xl transition cursor-pointer"
            >
              Back to Form
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
