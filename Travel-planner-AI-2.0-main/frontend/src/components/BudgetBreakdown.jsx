import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Hotel, Plane, UtensilsCrossed, Camera, ShoppingBag, Shield, Loader2 } from "lucide-react";

const CATEGORY_META = {
  accommodation: { label: "Accommodation", icon: Hotel,           color: "from-fuchsia-500 to-pink-500" },
  transport:     { label: "Transport",     icon: Plane,           color: "from-purple-500 to-indigo-500" },
  food:          { label: "Food",          icon: UtensilsCrossed, color: "from-rose-500 to-orange-500" },
  activities:    { label: "Activities",    icon: Camera,          color: "from-violet-500 to-fuchsia-500" },
  shopping:      { label: "Shopping",      icon: ShoppingBag,     color: "from-pink-500 to-purple-500" },
  emergency:     { label: "Emergency",     icon: Shield,          color: "from-indigo-500 to-violet-500" },
};

/**
 * BudgetBreakdown
 *  Props:
 *  - amount (number)
 *  - tier ("Budget" | "Standard" | "Luxury")
 *  - currency (e.g. "USD")
 *  - symbol (optional)
 *  - onChange(breakdown): fires when breakdown changes (for backend persistence)
 */
export default function BudgetBreakdown({ amount, tier, currency, onChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!amount || amount <= 0) {
      setData(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data: res } = await api.get("/budget/breakdown", {
          params: { amount, tier: tier || "Standard", currency: currency || "USD" },
        });
        if (!cancelled) {
          setData(res);
          onChange?.(res.breakdown);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [amount, tier, currency, onChange]);

  if (!amount || amount <= 0) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-sm text-white/50">
        Enter a budget to see the AI-estimated breakdown.
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center gap-2 text-sm text-white/60">
        <Loader2 className="w-4 h-4 animate-spin" /> Calculating breakdown…
      </div>
    );
  }
  if (!data) return null;

  const sym = data.symbol || currency;
  return (
    <div
      data-testid="budget-breakdown"
      className="rounded-2xl bg-gradient-to-br from-fuchsia-500/8 to-purple-600/5 border border-fuchsia-500/20 p-4"
    >
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300">
          Estimated Budget Allocation
        </div>
        <div className="text-xs text-white/40">{tier} tier</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        {Object.entries(data.breakdown).map(([key, val]) => {
          const meta = CATEGORY_META[key] || { label: key, icon: Hotel, color: "from-fuchsia-500 to-purple-600" };
          const Icon = meta.icon;
          return (
            <div
              key={key}
              data-testid={`budget-cat-${key}`}
              className="rounded-xl bg-white/5 border border-white/10 p-3"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-xs text-white/70">
                  <Icon className="w-3.5 h-3.5 text-fuchsia-300" />
                  {meta.label}
                </div>
                <div className="text-xs font-mono-acc text-fuchsia-300">{val.percentage}%</div>
              </div>
              <div className="font-display text-base">{sym} {Number(val.amount).toLocaleString()}</div>
              <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${meta.color}`}
                  style={{ width: `${val.percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
