import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { log } from "@/lib/log";
import { useAuthStore } from "@/store/auth";
import { motion } from "framer-motion";
import { Sparkles, MapPin, Calendar, Wallet, Bookmark, ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, t] = await Promise.all([api.get("/dashboard"), api.get("/trips")]);
      setData(d.data);
      setTrips(t.data);
    } catch (err) {
      log.error("Dashboard load failed", err);
      toast.error("Failed to load dashboard");
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteTrip = async (id) => {
    if (!window.confirm("Delete this trip?")) return;
    await api.delete(`/trips/${id}`);
    toast.success("Trip deleted");
    load();
  };

  return (
    <main data-testid="dashboard-page" className="max-w-7xl mx-auto px-5 md:px-8 py-10">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
        <div>
          <div className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300 mb-2">Dashboard</div>
          <h1 className="font-display text-4xl md:text-5xl">Welcome back, {user?.name?.split(" ")[0]}</h1>
          <p className="text-white/60 mt-2">Your travel command center.</p>
        </div>
        <Link to="/planner" data-testid="dashboard-new-trip">
          <Button className="btn-primary text-white border-0 rounded-full px-6 h-12">
            <Sparkles className="w-4 h-4 mr-2"/> Plan a new trip
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <Stat icon={MapPin} label="Total Trips" value={data?.total_trips ?? "—"} loading={loading} />
        <Stat icon={Calendar} label="Upcoming" value={data?.upcoming?.length ?? 0} loading={loading} />
        <Stat icon={Wallet} label="Budget Planned" value={data ? `${(data.total_budget_planned/1000).toFixed(1)}K` : "—"} loading={loading} />
        <Stat icon={Bookmark} label="Favorites" value={data?.favorites_count ?? 0} loading={loading} />
      </div>

      {/* Trips list */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl">Your trips</h2>
        <span className="text-xs font-mono-acc uppercase tracking-widest text-white/40">{trips.length} total</span>
      </div>

      {renderTripsSection({ loading, trips, deleteTrip })}
    </main>
  );
}

function renderTripsSection({ loading, trips, deleteTrip }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {["sk-1", "sk-2", "sk-3"].map((k) => <Skeleton key={k} className="h-56 bg-white/5 rounded-2xl" />)}
      </div>
    );
  }
  if (trips.length === 0) {
    return (
      <div className="glass rounded-3xl p-12 text-center">
        <div className="w-16 h-16 rounded-2xl btn-primary mx-auto flex items-center justify-center mb-4">
          <Sparkles className="w-7 h-7"/>
        </div>
        <h3 className="font-display text-2xl">No trips yet</h3>
        <p className="text-white/60 mt-2 mb-6">Create your first AI-powered itinerary in seconds.</p>
        <Link to="/planner"><Button data-testid="empty-state-cta" className="btn-primary text-white border-0 rounded-full px-6 h-11">Start planning</Button></Link>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {trips.map((t, i) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="glass rounded-2xl p-5 hover:border-fuchsia-500/40 transition-all group"
          data-testid={`trip-card-${t.id}`}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300">{t.days} days • {t.travel_type}</div>
              <h3 className="font-display text-2xl mt-1">{t.destination}</h3>
            </div>
            <button
              data-testid={`trip-delete-${t.id}`}
              onClick={() => deleteTrip(t.id)}
              className="p-2 rounded-full bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-300 transition opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-4 h-4"/>
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {(t.interests || []).slice(0, 3).map((interest) => (
              <span key={interest} className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10">{interest}</span>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60"><Wallet className="w-4 h-4 inline mr-1.5"/>{t.currency} {Number(t.budget).toLocaleString()}</span>
            <Link to={`/trips/${t.id}`} className="text-fuchsia-300 hover:text-fuchsia-200 inline-flex items-center font-medium" data-testid={`trip-open-${t.id}`}>
              View <ArrowRight className="w-3.5 h-3.5 ml-1"/>
            </Link>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function Stat({ icon: Icon, label, value, loading }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono-acc uppercase tracking-widest text-white/40">{label}</span>
        <Icon className="w-4 h-4 text-fuchsia-300"/>
      </div>
      {loading ? <Skeleton className="h-8 w-20 bg-white/5"/> : <div className="font-display text-3xl">{value}</div>}
    </div>
  );
}
