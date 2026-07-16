import { useMemo } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { Hotel, Plane, UtensilsCrossed, Camera, ShoppingBag, Shield, TrendingDown, TrendingUp } from "lucide-react";

const PIE_COLORS = ["#FF00FF", "#8A2BE2", "#B266FF", "#FF66FF", "#7B2FE0", "#C77DFF"];
const CAT_ICONS = {
  accommodation: Hotel, transport: Plane, food: UtensilsCrossed,
  activities: Camera, shopping: ShoppingBag, emergency: Shield,
  hotel: Hotel,
};

/**
 * BudgetTab — pie (allocation) + bar (planned vs actual) + summary list + remaining bar.
 */
export default function BudgetTab({ trip }) {
  const breakdownData = useMemo(() => {
    const breakdown = (trip?.itinerary?.budget_breakdown) || {};
    return Object.entries(breakdown)
      .filter(([, v]) => Number(v) > 0)
      .map(([k, v]) => ({ name: k, value: Number(v) }));
  }, [trip]);

  const totalSpend = breakdownData.reduce((s, x) => s + x.value, 0);
  const totalBudget = Number(trip?.budget || 0);
  const remaining = totalBudget - totalSpend;
  const pctUsed = totalBudget > 0 ? Math.min(100, Math.round((totalSpend / totalBudget) * 100)) : 0;
  const overBudget = remaining < 0;
  const currency = trip?.currency || "USD";

  // Per-day estimated cost from days array, for bar chart
  const days = trip?.itinerary?.days || [];
  const dailyData = days.map((d) => ({
    day: `D${d.day}`,
    total: Number(d.estimated_cost || (d.daily_budget?.total) || 0),
    accommodation: Number(d.daily_budget?.accommodation || 0),
    food: Number(d.daily_budget?.food || 0),
    transport: Number(d.daily_budget?.transport || 0),
    activities: Number(d.daily_budget?.activities || 0),
  }));

  return (
    <div className="space-y-6" data-testid="budget-tab">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie */}
        <div className="glass rounded-3xl p-6">
          <h3 className="font-display text-2xl">Budget Allocation</h3>
          <p className="text-white/60 text-sm mb-4">AI-estimated spend by category</p>
          {breakdownData.length === 0 ? (
            <p className="text-white/50">No breakdown available yet.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={breakdownData} dataKey="value" nameKey="name" outerRadius={110} innerRadius={60} paddingAngle={2}>
                    {breakdownData.map((entry, i) => <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "rgba(21,21,29,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "white" }}
                    formatter={(v) => `${currency} ${Number(v).toLocaleString()}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="glass rounded-3xl p-6 space-y-3">
          <h3 className="font-display text-2xl mb-3">Summary</h3>
          <div className="flex justify-between py-1">
            <span className="text-white/60 text-sm">Total Budget</span>
            <span className="font-display text-lg">{currency} {totalBudget.toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-white/60 text-sm">Estimated Spend</span>
            <span className="font-display text-lg">{currency} {totalSpend.toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-white/60 text-sm">Remaining</span>
            <span className={`font-display text-lg flex items-center gap-1 ${overBudget ? "text-red-300" : "text-emerald-300"}`}>
              {overBudget ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
              {currency} {Math.abs(remaining).toLocaleString()}
            </span>
          </div>

          <div className="mt-3">
            <div className="flex justify-between text-xs text-white/50 mb-1.5">
              <span>{pctUsed}% used</span>
              <span>{100 - pctUsed}% left</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full ${overBudget ? "bg-gradient-to-r from-red-500 to-orange-500" : "bg-gradient-to-r from-fuchsia-500 to-purple-600"}`}
                style={{ width: `${pctUsed}%` }}
              />
            </div>
          </div>

          <div className="pt-4 space-y-2">
            {breakdownData.map((b, i) => {
              const Icon = CAT_ICONS[b.name] || Hotel;
              return (
                <div key={b.name} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 border border-white/5">
                  <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <Icon className="w-3.5 h-3.5 text-fuchsia-300" />
                  <span className="capitalize text-white/70 text-sm flex-1">{b.name}</span>
                  <span className="font-mono-acc text-fuchsia-200 text-sm">{currency} {b.value.toLocaleString()}</span>
                </div>
              );
            })}
          </div>

          {overBudget && (trip?.itinerary?.optimization_tips || []).length > 0 && (
            <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
              <div className="text-sm font-semibold text-red-300 mb-2">
                Over budget by {currency} {Math.abs(remaining).toLocaleString()}
              </div>
              <ul className="text-sm text-white/70 space-y-1 list-disc list-inside">
                {trip.itinerary.optimization_tips.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Per-day */}
      {dailyData.length > 0 && (
        <div className="glass rounded-3xl p-6">
          <h3 className="font-display text-2xl mb-1">Daily spend</h3>
          <p className="text-white/60 text-sm mb-4">Per-day estimated cost across your itinerary</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "rgba(21,21,29,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "white" }}
                  formatter={(v, k) => [`${currency} ${Number(v).toLocaleString()}`, k]}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="total" fill="#FF00FF" radius={[8, 8, 0, 0]} name="Daily total" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
