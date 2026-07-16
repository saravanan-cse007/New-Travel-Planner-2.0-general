import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { MapPin, X, Loader2, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Simple debounce
function useDebounced(value, delay = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/**
 * Google Places Autocomplete (server-proxied).
 * Props:
 *  - value: LocationData | null  (selected place — has place_id, name, etc.)
 *  - onChange(loc): called when user selects a suggestion
 *  - placeholder, label, testIdPrefix, icon, disabled
 *  - allowClear (default true)
 */
export default function PlacesAutocomplete({
  value,
  onChange,
  placeholder = "Search any city or place…",
  testIdPrefix = "place",
  icon: Icon = MapPin,
  disabled = false,
  allowClear = true,
}) {
  const [input, setInput] = useState(value?.formatted_address || value?.name || "");
  const [predictions, setPredictions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [error, setError] = useState(null);
  const sessionTokenRef = useRef(Math.random().toString(36).slice(2));
  const wrapRef = useRef(null);
  const debounced = useDebounced(input, 180);

  // Sync from external value
  useEffect(() => {
    if (value?.formatted_address) setInput(value.formatted_address);
    else if (value?.name) setInput(value.name);
    else if (!value) setInput("");
  }, [value]);

  const fetchPredictions = useCallback(async (q) => {
    if (!q.trim()) {
      setPredictions([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/places/autocomplete", {
        params: { input: q, session_token: sessionTokenRef.current },
      });
      setPredictions(data.predictions || []);
      if ((data.predictions || []).length === 0) {
        if (data.status && data.status !== "ZERO_RESULTS" && data.status !== "OK") {
          setError("Search unavailable — please try again");
        }
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Search failed");
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-query when debounced input changes
  useEffect(() => {
    if (debounced && debounced !== (value?.formatted_address || value?.name || "")) {
      fetchPredictions(debounced);
    } else if (!debounced) {
      setPredictions([]);
    }
  }, [debounced, fetchPredictions, value?.formatted_address, value?.name]);

  // Close on outside click
  useEffect(() => {
    function onClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const selectPrediction = async (pred) => {
    setShowDropdown(false);
    setLoading(true);
    try {
      const { data } = await api.get("/places/details", {
        params: { place_id: pred.place_id, session_token: sessionTokenRef.current },
      });
      // New session token for next search
      sessionTokenRef.current = Math.random().toString(36).slice(2);
      setInput(data.formatted_address || data.name || pred.description);
      onChange?.(data);
    } catch (err) {
      setError("Could not load place details");
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setInput("");
    setPredictions([]);
    onChange?.(null);
  };

  const handleKey = (e) => {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0 && predictions[activeIdx]) {
      e.preventDefault();
      selectPrediction(predictions[activeIdx]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative" data-testid={`${testIdPrefix}-autocomplete`}>
      <div className="relative">
        <Icon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-fuchsia-300 pointer-events-none" />
        <input
          data-testid={`${testIdPrefix}-input`}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowDropdown(true);
            setActiveIdx(-1);
            if (value && e.target.value !== (value.formatted_address || value.name)) {
              onChange?.(null);
            }
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className="w-full h-11 pl-10 pr-10 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-fuchsia-500/50 transition disabled:opacity-50"
        />
        {loading && (
          <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-white/40" />
        )}
        {!loading && allowClear && input && (
          <button
            type="button"
            onClick={clear}
            data-testid={`${testIdPrefix}-clear`}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && (predictions.length > 0 || error || (input && !loading && predictions.length === 0)) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 left-0 right-0 mt-1.5 rounded-2xl bg-[#0F0E1A]/95 backdrop-blur-xl border border-fuchsia-500/20 shadow-[0_20px_60px_rgba(180,0,255,0.25)] overflow-hidden max-h-[320px] overflow-y-auto"
          >
            {error && (
              <div className="px-4 py-3 text-sm text-red-300 flex items-center gap-2">
                <Globe className="w-4 h-4" /> {error}
              </div>
            )}
            {!error && predictions.length === 0 && input && !loading && (
              <div className="px-4 py-4 text-sm text-white/50">No locations found</div>
            )}
            {predictions.map((p, idx) => {
              const active = idx === activeIdx;
              return (
                <button
                  key={p.place_id}
                  type="button"
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => selectPrediction(p)}
                  data-testid={`${testIdPrefix}-option-${idx}`}
                  className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition border-b border-white/5 last:border-b-0 ${
                    active
                      ? "bg-fuchsia-500/15"
                      : "hover:bg-white/5"
                  }`}
                >
                  <MapPin className="w-4 h-4 text-fuchsia-300 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white truncate">{p.main_text || p.description}</div>
                    {p.secondary_text && (
                      <div className="text-xs text-white/50 truncate mt-0.5">{p.secondary_text}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
