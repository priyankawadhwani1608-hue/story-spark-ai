import React, { useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";
import { RootState } from "../../../redux/store";
import { getBaseUrl } from "../../../helpers/config";

// Declare global types cleanly
declare global {
  interface Window {
    Razorpay: any;
  }
}

const API_BASE_URL = getBaseUrl();

interface PaymentProps {
  plan: "basic" | "pro" | "premium";
  planLabel: string;
  displayAmount: string; // e.g. "₹499"
}

export const PaymentComponent = ({ plan, planLabel, displayAmount }: PaymentProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useSelector((state: RootState) => state.auth.user);

  // Dynamic fallback mapping for display logic since form inputs are removed
  const planName = planLabel || plan.charAt(0).toUpperCase() + plan.slice(1);
  const planPrice = displayAmount.replace("₹", "");

  // Dynamically load the Razorpay script window element safely
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Load Razorpay SDK
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setError("Failed to load payment gateway. Please try again.");
        setLoading(false);
        return;
      }

      // 2. Create order on backend — send plan name, NOT amount
      const orderRes = await fetch(`${API_BASE_URL}/api/v1/payment/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });

      if (!orderRes.ok) {
        const data = await orderRes.json();
        setError(data.message || "Could not initiate payment.");
        setLoading(false);
        return;
      }

      const { orderId, amount, currency } = await orderRes.json();

      // 3. Configure Razorpay overlay configuration option states
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount,
        currency,
        name: "Story Spark AI",
        description: `${planName} Plan`,
        order_id: orderId,
        prefill: {
          name: user?.name ?? "",
          email: user?.email ?? "",
        },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          // 4. Verify payment on backend securely
          const verifyRes = await fetch(`${API_BASE_URL}/api/v1/payment/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          const verifyData = await verifyRes.json();

          if (verifyData.success) {
            window.location.href = "/dashboard?upgraded=true";
          } else {
            setError("Payment verification failed. Please contact support.");
          }
          setLoading(false);
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
        theme: { color: "#7c3aed" },
      };

      const paymentObject = new ((window as unknown) as RazorpayWindow).Razorpay(
        options
      );

      paymentObject.on(
        "payment.failed",
        (response: RazorpayFailureResponse) => {
          console.error(response.error);

          alert(response.error?.description || "Payment failed.");
        }
      );

      paymentObject.open();
    } catch (error) {
      console.error(error);
      alert("Something went wrong.");
    }
  };

  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const formatCardNumber = (value: string) => {
    return value
      .replace(/\D/g, "")
      .slice(0, 16)
      .replace(/(.{4})/g, "$1 ")
      .trim();
  };

  const formatExpiry = (value: string) => {
    return value
      .replace(/\D/g, "")
      .slice(0, 4)
      .replace(/^(\d{2})(\d)/, "$1/$2");
  };

  const isFormValid =
    name.trim() &&
    cardNumber.length === 19 &&
    expiry.length === 5 &&
    cvv.length === 3;

  const handlePay = () => {
    if (!isFormValid) return;

    setLoading(true);

    setTimeout(() => {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Payment error:", err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 px-4 py-10 relative overflow-hidden transition-colors duration-300 w-full box-border sm:px-6 lg:px-8">
      {/* Decorative ambient background spots */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none select-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none select-none" />

      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center w-full box-border relative z-10">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start box-border">
          
          {/* Main Checkout Section */}
          <section className="bg-white dark:bg-[#111827]/40 border border-slate-200 dark:border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-sm hover:shadow-xl transition-all duration-300 w-full box-border">
            <div className="mb-8 flex items-start justify-between gap-4 w-full box-border">
              <div className="min-w-0 flex-1">
                <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/10 dark:border-cyan-400/20 bg-cyan-500/5 dark:bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 select-none">
                  Secure checkout
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Complete Your Subscription
                </h1>
                <p className="mt-2 text-xs sm:text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                  Finish your upgrade with secure Razorpay payment integration setup protocols.
                </p>
              </div>
              <div className="hidden rounded-xl border border-slate-200 dark:border-cyan-400/20 bg-slate-50 dark:bg-cyan-400/10 p-3 text-slate-500 dark:text-cyan-300 sm:flex shrink-0 select-none">
                <CreditCard size={20} />
              </div>
            </div>

            <div className="mb-6 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-cyan-400/10 bg-slate-50/50 dark:bg-cyan-400/5 p-4 sm:p-5 w-full box-border">
              <div className="flex items-center justify-between gap-4 w-full box-border">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider select-none">
                    Selected Plan
                  </p>
                  <h2 className="mt-1 text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                    {planName} Plan
                  </h2>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xl sm:text-2xl font-extrabold text-cyan-600 dark:text-cyan-400 tracking-tight">
                    ₹{planPrice}
                  </p>
                  <p className="text-[11px] sm:text-xs font-medium text-slate-400 dark:text-slate-500 select-none">
                    per month
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message Layout */}
            {error && (
              <p className="text-sm text-red-500 text-center mb-4 font-medium bg-red-500/10 py-2.5 px-4 rounded-xl border border-red-500/20">
                {error}
              </p>
            )}

            {/* Payment Action Submission Trigger Form */}
            <form className="space-y-5" onSubmit={handlePayment}>
              <button
                type="submit"
                disabled={loading}
                className="motion-cta inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-4 text-base font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:shadow-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    Proceed to Pay - ₹{planPrice}/mo
                  </>
                )}
              </button>

              <p className="text-xs leading-5 text-slate-400">
                Your verification processing details are protected with standard gateway layers. 
                Sensitive financial credentials are safe inside standard sandboxed overlay systems.
              </p>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 w-full box-border">
              <Link
                to="/pricing"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors select-none group"
              >
                <ArrowLeft size={14} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
                Back to Pricing
              </Link>
            </div>
          </section>

          {/* Right Summary Sidebar Layout Panel */}
          <aside className="bg-white dark:bg-[#111827]/20 border border-slate-200 dark:border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-sm w-full box-border">
            <div className="mb-6 flex items-center gap-3 w-full box-border select-none">
              <div className="rounded-xl border border-slate-200 dark:border-emerald-400/20 bg-slate-50 dark:bg-emerald-400/10 p-2.5 text-slate-500 dark:text-emerald-400 shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  What you get
                </h2>
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                  A quick summary before you confirm.
                </p>
              </div>
            </div>

            <div className="space-y-4 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4 sm:p-5 w-full box-border">
              <div className="flex items-center justify-between gap-4 w-full box-border">
                <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 tracking-tight truncate">
                  {planName} subscription
                </span>
                <span className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight shrink-0">
                  ₹{planPrice}/mo
                </span>
              </div>

              <div className="h-px bg-slate-200 dark:bg-slate-800 w-full" />

              <ul className="space-y-3 list-none p-0 m-0 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
                <li className="flex items-start gap-2.5 leading-relaxed">
                  <CheckCircle2 size={14} className="text-cyan-500 dark:text-cyan-400 shrink-0 mt-0.5 select-none" />
                  <span>Unlimited AI writing tools</span>
                </li>
                <li className="flex items-start gap-2.5 leading-relaxed">
                  <CheckCircle2 size={14} className="text-cyan-500 dark:text-cyan-400 shrink-0 mt-0.5 select-none" />
                  <span>Priority access to premium features</span>
                </li>
                <li className="flex items-start gap-2.5 leading-relaxed">
                  <CheckCircle2 size={14} className="text-cyan-500 dark:text-cyan-400 shrink-0 mt-0.5 select-none" />
                  <span>Cancel anytime from your account settings</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-cyan-400/10 bg-slate-50/30 dark:bg-cyan-400/5 p-4 sm:p-5 w-full box-border">
              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-cyan-400 select-none tracking-tight">
                Need help?
              </p>
              <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                If your payment transaction parameters fail, please refresh to loop again or reach out to platform operations support.
              </p>
            </div>
          </aside>
          
        </div>
      </div>
    </div>
  );
};
