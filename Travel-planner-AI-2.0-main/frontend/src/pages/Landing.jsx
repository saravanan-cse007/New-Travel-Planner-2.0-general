import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, CloudSun, Wallet, UtensilsCrossed, Map, FileDown, ArrowRight, Plane } from "lucide-react";

const features = [
  { icon: Sparkles, title: "AI Itinerary Generation", desc: "Personalized day-wise plans crafted by Gemini in seconds." },
  { icon: CloudSun, title: "Weather-Aware Plans", desc: "Auto-swap outdoor activities when rain is forecast." },
  { icon: Wallet, title: "Budget Optimization", desc: "Smart spend tracking with category breakdowns and tips." },
  { icon: UtensilsCrossed, title: "Restaurant Picks", desc: "Local cuisine, hidden gems, dietary-aware suggestions." },
  { icon: Map, title: "Map-Ready Routes", desc: "Open destinations in Google Maps in one tap." },
  { icon: FileDown, title: "Export to PDF", desc: "Take your itinerary offline, share, or print anywhere." },
];

const HERO_IMG = "https://images.unsplash.com/photo-1559245718-212fba2d22e2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzJ8MHwxfHNlYXJjaHwzfHx0b2t5byUyMG5pZ2h0JTIwY2l0eSUyMG5lb258ZW58MHx8fHwxNzgyMTgxMTczfDA&ixlib=rb-4.1.0&q=85";

export default function Landing() {
  return (
    <main data-testid="landing-page" className="relative">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 pt-16 md:pt-24 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="lg:col-span-7"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-mono-acc tracking-widest uppercase text-fuchsia-300 mb-6">
            <Sparkles className="w-3.5 h-3.5" /> AI-powered travel intelligence
          </div>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold leading-[1.02] tracking-tight">
            Build <span className="text-glow">personalized</span><br />
            travel plans with AI
          </h1>
          <p className="mt-6 text-lg text-white/70 max-w-xl">
            From Lisbon to Tokyo, get day-wise itineraries tuned to your budget, weather, pace,
            and taste — generated in seconds, not weeks.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" data-testid="hero-cta-signup">
              <button className="btn-primary text-white rounded-full px-7 py-3.5 font-semibold inline-flex items-center gap-2">
                Start planning <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link to="/login" data-testid="hero-cta-login">
              <button className="rounded-full px-7 py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 transition font-semibold">
                I already have an account
              </button>
            </Link>
          </div>
          <div className="mt-10 flex items-center gap-6 text-xs font-mono-acc tracking-widest uppercase text-white/40">
            <span>Gemini 3 Flash</span><span>•</span><span>Weather-aware</span><span>•</span><span>Budget smart</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="lg:col-span-5 relative"
        >
          <div className="relative aspect-[4/5] rounded-3xl overflow-hidden glass">
            <img src={HERO_IMG} alt="Travel" className="absolute inset-0 w-full h-full object-cover opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0F] via-[#0B0B0F]/40 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 glass rounded-2xl p-4">
              <div className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300">Day 02 • Tokyo</div>
              <div className="font-display text-xl mt-1">Shibuya night exploration</div>
              <div className="text-sm text-white/60 mt-1">6:00 PM – 10:00 PM • ₹2,400</div>
            </div>
          </div>
          <div className="absolute -bottom-6 -left-6 glass rounded-2xl p-4 hidden md:block">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl btn-primary flex items-center justify-center"><Plane className="w-5 h-5"/></div>
              <div>
                <div className="text-xs text-white/50 font-mono-acc uppercase tracking-widest">Generated in</div>
                <div className="font-display text-xl">8.4 seconds</div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 pb-24">
        <div className="mb-10">
          <div className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300 mb-3">Features</div>
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight">Everything you need for the perfect trip.</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
              className="glass rounded-2xl p-6 hover:border-fuchsia-500/40 hover:shadow-[0_8px_32px_rgba(138,43,226,0.18)] transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-purple-600/30 border border-white/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-fuchsia-300" />
              </div>
              <h3 className="font-display text-xl">{f.title}</h3>
              <p className="text-sm text-white/60 mt-2 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-16 text-center">
          <Link to="/signup">
            <button data-testid="footer-cta" className="btn-primary text-white rounded-full px-8 py-4 font-semibold inline-flex items-center gap-2">
              Plan your next adventure <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </section>
    </main>
  );
}
