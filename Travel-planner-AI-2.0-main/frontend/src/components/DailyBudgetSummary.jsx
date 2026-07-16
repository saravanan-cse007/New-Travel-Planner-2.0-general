import { Hotel, Plane, UtensilsCrossed, Camera, ShoppingBag, Shield } from "lucide-react";

const CATEGORIES = [
  { key: "accommodation", label: "Stay",     icon: Hotel },
  { key: "transport",     label: "Transit",  icon: Plane },
  { key: "food",          label: "Food",     icon: UtensilsCrossed },
  { key: "activities",    label: "Activities", icon: Camera },
  { key: "shopping",      label: "Shopping", icon: ShoppingBag },
  { key: "emergency",     label: "Emergency", icon: Shield },
];

/**
 * DailyBudgetSummary — compact card at the bottom of every day,
 * showing each spend category + Daily Total.
 */
export default function DailyBudgetSummary({ daily, currency, estimatedCost }) {
  // daily may be undefined or missing some keys — we still render with zeros
  const total = (daily?.total) ||
    CATEGORIES.reduce((s, c) => s + Number(daily?.[c.key] || 0), 0) ||
    Number(estimatedCost || 0);

  return (
    <div className="mt-3 rounded-2xl bg-gradient-to-br from-fuchsia-500/8 to-purple-600/5 border border-fuchsia-500/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300">Daily budget</div>
        <div className="text-xs text-white/50">{currency}</div>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {CATEGORIES.map(({ key, label, icon: Icon }) => {
          const val = Number(daily?.[key] || 0);
          return (
            <div key={key} className="text-center px-1">
              <div className="flex items-center justify-center mb-1 text-fuchsia-300">
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono-acc">{label}</div>
              <div className="text-sm font-display mt-0.5">{val.toLocaleString()}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
        <div className="text-xs text-white/60 font-mono-acc uppercase tracking-widest">Daily total</div>
        <div className="font-display text-xl">{currency} {Number(total).toLocaleString()}</div>
      </div>
    </div>
  );
}
