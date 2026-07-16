import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { Plane, Sun, Sunset, Moon, MapPin, CloudRain, Sparkles, ArrowRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import DestinationHero from "@/components/DestinationHero";
import ShareMeta from "@/components/SEO/ShareMeta";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Public, unauthenticated read-only view of a shared trip itinerary.
 * Mounted at /share/:shareId.
 */
export default function SharedTrip() {
  const { shareId } = useParams();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API}/share/${shareId}`)
      .then((r) => setTrip(r.data))
      .catch((e) => setError(e.response?.status === 404 ? "This itinerary is no longer public." : "Failed to load itinerary."));
  }, [shareId]);

  if (error) return (
    <main className="min-h-screen flex items-center justify-center px-5">
      <div className="glass rounded-3xl p-10 max-w-md text-center">
        <h1 className="font-display text-3xl mb-3">Oops</h1>
        <p className="text-white/60">{error}</p>
        <Link to="/" className="inline-block mt-6 text-fuchsia-300 hover:underline">Go home →</Link>
      </div>
    </main>
  );

  if (!trip) return (
    <main className="max-w-5xl mx-auto px-5 py-10">
      <Skeleton className="h-12 w-72 bg-white/5 mb-4"/>
      <Skeleton className="h-72 w-full bg-white/5 rounded-3xl"/>
    </main>
  );

  const it = trip.itinerary || {};

  return (
    <main data-testid="shared-trip-page" className="max-w-5xl mx-auto px-5 md:px-8 py-10">
      <ShareMeta
        destination={trip.destination}
        days={trip.days}
        summary={it.summary}
        shareId={shareId}
      />
      <div className="flex items-center gap-2 mb-6 text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300">
        <Sparkles className="w-3.5 h-3.5"/> Shared by {trip.shared_by} · Travel Planner AI
      </div>

      <DestinationHero query={trip.destination} height="h-56 md:h-72"/>

      <div className="glass rounded-3xl p-6 md:p-8 mb-8 mt-4">
        <div className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300 mb-2">
          {trip.days} days • {trip.travel_type} • {trip.pace}
        </div>
        <h1 className="font-display text-4xl md:text-5xl tracking-tight">{trip.destination}</h1>
        <p className="text-white/70 mt-3 max-w-2xl">{it.summary}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          {(it.highlights || []).slice(0, 5).map((h) => (
            <span key={h} className="text-xs px-2.5 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-200">{h}</span>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-3">
          <Link to="/signup" data-testid="shared-cta-signup">
            <button className="btn-primary text-white rounded-full px-5 py-2.5 inline-flex items-center gap-2">
              Plan your own with AI <ArrowRight className="w-4 h-4"/>
            </button>
          </Link>
          <Link to="/" className="text-sm text-white/60 hover:text-white">Learn more</Link>
        </div>
      </div>

      <div className="relative pl-8 before:absolute before:inset-y-0 before:left-[14px] before:w-[2px] before:bg-gradient-to-b before:from-fuchsia-500 before:via-purple-500/60 before:to-purple-500/0">
        <Accordion type="multiple" defaultValue={["day-1"]} className="space-y-4">
          {(it.days || []).map((d, i) => (
            <motion.div key={d.day} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
              <AccordionItem value={`day-${d.day}`} className="border-0 -ml-8">
                <div className="relative">
                  <div className="absolute -left-[26px] top-5 w-3 h-3 rounded-full bg-fuchsia-400 shadow-[0_0_12px_rgba(255,0,255,0.7)]" />
                  <div className="glass rounded-2xl">
                    <AccordionTrigger className="px-6 py-5 hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4 text-left">
                        <div>
                          <div className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300">Day {d.day}</div>
                          <div className="font-display text-xl mt-0.5">{d.title}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-white/50 font-mono-acc uppercase tracking-widest">Cost</div>
                          <div className="font-display text-lg">{trip.currency} {Number(d.estimated_cost || 0).toLocaleString()}</div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 space-y-3">
                      {[["morning", Sun], ["afternoon", Sunset], ["evening", Moon]].map(([slot, Icon]) => {
                        const s = d[slot]; if (!s) return null;
                        return (
                          <div key={slot} className="rounded-2xl p-4 bg-white/5 border border-white/10">
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className="w-4 h-4 text-fuchsia-300"/>
                              <span className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300">{slot}</span>
                              <span className="text-xs text-white/40 ml-auto">{s.time}</span>
                            </div>
                            <div className="font-display text-lg">{s.activity}</div>
                            {s.location && <div className="text-sm text-white/60 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3"/>{s.location}</div>}
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              <span className="text-fuchsia-300 font-mono-acc">{trip.currency} {Number(s.cost || 0).toLocaleString()}</span>
                              {s.tips && <span className="text-white/60 italic flex-1">{s.tips}</span>}
                            </div>
                            {s.rain_alt && (
                              <div className="mt-2 text-xs text-white/50 flex gap-1.5 items-start">
                                <CloudRain className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"/>
                                <span><span className="font-semibold text-white/70">Rain plan:</span> {s.rain_alt}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </AccordionContent>
                  </div>
                </div>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </div>

      <div className="mt-12 text-center text-xs text-white/40 font-mono-acc uppercase tracking-widest">
        Made with <Plane className="w-3 h-3 inline-block mx-1"/> Travel Planner AI
      </div>
    </main>
  );
}
