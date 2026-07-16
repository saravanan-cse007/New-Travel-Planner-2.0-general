import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  Sparkles, Loader2, Plus, X, ArrowLeftRight, MapPin, Navigation,
  Calendar, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";
import TransportPicker from "@/components/TransportPicker";
import BudgetBreakdown from "@/components/BudgetBreakdown";

const INTERESTS = ["History", "Food", "Adventure", "Beaches", "Nightlife", "Shopping", "Nature", "Art & Culture", "Photography", "Wellness"];

const COMMON_CURRENCIES = ["INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD", "THB", "CNY", "KRW", "AED"];

function diffDaysInclusive(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s) || isNaN(e)) return 0;
  const ms = e.setHours(0, 0, 0, 0) - s.setHours(0, 0, 0, 0);
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

export default function Planner() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [multiCity, setMultiCity] = useState(false);
  const [cities, setCities] = useState([{ name: "", days: 2 }]);

  // Locations
  const [sourceLoc, setSourceLoc] = useState(null);
  const [destLoc, setDestLoc] = useState(null);

  // Form
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState(50000);
  const [currency, setCurrency] = useState("INR");
  const [currencyManuallyChanged, setCurrencyManuallyChanged] = useState(false);
  const [travelType, setTravelType] = useState("Couple");
  const [interests, setInterests] = useState(["History", "Food"]);
  const [transportMode, setTransportMode] = useState(null);
  const [transportEstimate, setTransportEstimate] = useState(null);
  const [pace, setPace] = useState("Moderate");
  const [foodPref, setFoodPref] = useState("Non-vegetarian");
  const [budgetTier, setBudgetTier] = useState("Standard");
  const [notes, setNotes] = useState("");
  const [budgetBreakdown, setBudgetBreakdown] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);

  // ── Auto-detect currency on destination select ──
  useEffect(() => {
    if (destLoc?.suggested_currency && !currencyManuallyChanged) {
      setCurrency(destLoc.suggested_currency);
    }
  }, [destLoc, currencyManuallyChanged]);

  // ── Fetch exchange rate to USD ──
  useEffect(() => {
    if (!currency) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/currency/convert", {
          params: { from: "USD", to: currency, amount: 1 },
        });
        if (!cancelled) setExchangeRate(data.rate);
      } catch {/* ignore */}
    })();
    return () => { cancelled = true; };
  }, [currency]);

  // ── Auto-calculated number of days (single-city mode) ──
  const computedDays = useMemo(() => {
    if (multiCity) return cities.reduce((s, c) => s + (Number(c.days) || 0), 0);
    return diffDaysInclusive(startDate, endDate);
  }, [startDate, endDate, multiCity, cities]);

  // ── Date validation ──
  const dateError = useMemo(() => {
    if (!startDate || !endDate) return null;
    const s = new Date(startDate), e = new Date(endDate);
    if (e < s) return "End date cannot be before start date";
    return null;
  }, [startDate, endDate]);

  // Swap source ↔ destination
  const swapLocations = useCallback(() => {
    setSourceLoc(destLoc);
    setDestLoc(sourceLoc);
  }, [sourceLoc, destLoc]);

  const toggleInterest = (i) => {
    setInterests((arr) => arr.includes(i) ? arr.filter((x) => x !== i) : [...arr, i]);
  };

  const addCity = () => setCities([...cities, { name: "", days: 2 }]);
  const removeCity = (idx) => setCities(cities.filter((_, i) => i !== idx));
  const updateCity = (idx, key, val) =>
    setCities(cities.map((c, i) => (i === idx ? { ...c, [key]: val } : c)));

  // ── Validation: enable Generate button only when ready ──
  const validation = useMemo(() => {
    const errs = {};
    if (!multiCity && !destLoc) errs.destination = "Select a destination";
    if (!multiCity && !sourceLoc) errs.source = "Select a source";
    if (multiCity) {
      const cleaned = cities.filter((c) => c.name.trim());
      if (cleaned.length < 2) errs.cities = "Add at least 2 cities";
    }
    if (!startDate) errs.startDate = "Start date required";
    if (!endDate) errs.endDate = "End date required";
    if (dateError) errs.dateRange = dateError;
    if (!budget || Number(budget) <= 0) errs.budget = "Budget required";
    if (!interests.length) errs.interests = "Select at least one interest";
    if (!travelType) errs.travelType = "Travel type required";
    return errs;
  }, [multiCity, sourceLoc, destLoc, cities, startDate, endDate, dateError, budget, interests, travelType]);

  const isValid = Object.keys(validation).length === 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!isValid) {
      toast.error("Please complete all required fields");
      return;
    }
    setLoading(true);
    try {
      let payload;
      const destinationStr = multiCity
        ? cities.filter((c) => c.name.trim()).map((c) => c.name).join(" → ")
        : (destLoc?.formatted_address || destLoc?.name);

      const base = {
        start_date: startDate,
        end_date: endDate,
        budget: Number(budget),
        currency,
        travel_type: travelType,
        interests,
        transport: transportMode || "Public Transport",
        transport_mode: transportMode || null,
        pace,
        food_pref: foodPref,
        budget_tier: budgetTier,
        notes: notes || null,
        source: sourceLoc?.formatted_address || sourceLoc?.name || null,
        source_location: sourceLoc || null,
        destination_location: destLoc || null,
        exchange_rate: exchangeRate || null,
        budget_breakdown_input: budgetBreakdown || null,
        transport_cost_estimate: transportEstimate?.cost || null,
      };

      if (multiCity) {
        const cleaned = cities.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), days: Number(c.days) || 1 }));
        const totalDays = cleaned.reduce((s, c) => s + c.days, 0);
        payload = { ...base, destination: cleaned.map((c) => c.name).join(" → "), days: totalDays, cities: cleaned };
      } else {
        payload = { ...base, destination: destinationStr, days: computedDays };
      }

      const { data } = await api.post("/trips", payload);
      toast.success("Itinerary generated!");
      nav(`/trips/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to generate itinerary");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main data-testid="planner-page" className="max-w-4xl mx-auto px-5 md:px-8 py-10">
      <div className="mb-8">
        <div className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300 mb-2">Trip Planner</div>
        <h1 className="font-display text-4xl md:text-5xl">Tell us about your trip</h1>
        <p className="text-white/60 mt-2">Live data from Google Maps & OpenWeather — your AI itinerary in seconds.</p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        onSubmit={submit}
        className="glass rounded-3xl p-6 md:p-8 space-y-7"
      >
        {/* Multi-city toggle */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
          <div>
            <div className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300 mb-1">Trip Style</div>
            <div className="font-display text-lg">{multiCity ? "Multi-city journey" : "Single destination"}</div>
          </div>
          <button
            type="button"
            data-testid="planner-multicity-toggle"
            onClick={() => setMultiCity(!multiCity)}
            className="px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
          >
            {multiCity ? "Switch to single city" : "+ Multi-city"}
          </button>
        </div>

        {multiCity && (
          <div className="space-y-3 p-5 rounded-2xl bg-fuchsia-500/5 border border-fuchsia-500/20">
            <div className="flex items-center justify-between">
              <Label className="text-white/80 text-xs font-mono-acc uppercase tracking-widest">Cities (in order)</Label>
              <button type="button" onClick={addCity} data-testid="planner-add-city"
                className="text-xs px-3 py-1.5 rounded-full bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-200 inline-flex items-center gap-1">
                <Plus className="w-3 h-3"/> Add city
              </button>
            </div>
            {cities.map((c, idx) => (
              <div key={`city-${idx}`} className="flex gap-2 items-center">
                <span className="w-7 h-7 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/40 flex items-center justify-center text-xs font-mono-acc">{idx + 1}</span>
                <Input
                  data-testid={`planner-city-${idx}-name`}
                  placeholder="City name"
                  value={c.name}
                  onChange={(e) => updateCity(idx, "name", e.target.value)}
                  className="bg-white/5 border-white/10 text-white h-10 flex-1" />
                <Input
                  data-testid={`planner-city-${idx}-days`}
                  type="number" min="1" max="30"
                  value={c.days}
                  onChange={(e) => updateCity(idx, "days", e.target.value)}
                  className="bg-white/5 border-white/10 text-white h-10 w-20" />
                <span className="text-xs text-white/50">days</span>
                {cities.length > 1 && (
                  <button type="button" onClick={() => removeCity(idx)} data-testid={`planner-city-${idx}-remove`}
                    className="p-2 text-white/40 hover:text-red-300"><X className="w-4 h-4"/></button>
                )}
              </div>
            ))}
            <div className="text-xs text-white/50 pt-2 border-t border-white/5">
              Total: {cities.reduce((s, c) => s + (Number(c.days) || 0), 0)} days across {cities.filter(c => c.name.trim()).length} cities
            </div>
          </div>
        )}

        {/* Source & Destination autocomplete */}
        {!multiCity && (
          <div className="space-y-4">
            <Field label="Source (From)">
              <PlacesAutocomplete
                value={sourceLoc}
                onChange={setSourceLoc}
                placeholder="Where are you starting from?"
                testIdPrefix="source"
                icon={Navigation}
              />
            </Field>

            <div className="flex justify-center -my-2">
              <button
                type="button"
                onClick={swapLocations}
                disabled={!sourceLoc && !destLoc}
                data-testid="planner-swap"
                className="p-2 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-200 hover:bg-fuchsia-500/25 hover:rotate-180 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Swap source and destination"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            </div>

            <Field label="Destination (To)">
              <PlacesAutocomplete
                value={destLoc}
                onChange={(loc) => {
                  setDestLoc(loc);
                  setCurrencyManuallyChanged(false);
                }}
                placeholder="Where are you going?"
                testIdPrefix="destination"
                icon={MapPin}
              />
              {destLoc?.country && (
                <div className="mt-2 text-xs text-white/50 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-200">
                    {destLoc.country}
                  </span>
                  {destLoc.suggested_currency && (
                    <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                      Local: {destLoc.currency_symbol} {destLoc.suggested_currency}
                    </span>
                  )}
                </div>
              )}
            </Field>
          </div>
        )}

        {/* Date inputs - day auto-calc */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="Start date" error={validation.startDate}>
            <Input data-testid="planner-start" type="date" value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white/5 border-white/10 text-white h-11" />
          </Field>
          <Field label="End date" error={validation.endDate || validation.dateRange}>
            <Input data-testid="planner-end" type="date" value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`bg-white/5 border-white/10 text-white h-11 ${dateError ? "border-red-400/60" : ""}`} />
          </Field>
          <Field label="Number of days (auto)">
            <div
              data-testid="planner-days"
              className="h-11 px-3 rounded-md bg-white/5 border border-white/10 flex items-center gap-2 text-white"
            >
              <Calendar className="w-4 h-4 text-fuchsia-300" />
              <span className="font-display text-lg">
                {computedDays > 0 ? `${computedDays} ${computedDays === 1 ? "Day" : "Days"}` : "—"}
              </span>
            </div>
          </Field>
        </div>

        {dateError && (
          <div className="flex items-center gap-2 text-sm text-red-300 -mt-3" data-testid="date-error">
            <AlertCircle className="w-4 h-4" /> {dateError}
          </div>
        )}

        {/* Budget */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Budget">
            <div className="flex gap-2">
              <Select
                value={currency}
                onValueChange={(v) => { setCurrency(v); setCurrencyManuallyChanged(true); }}
              >
                <SelectTrigger data-testid="planner-currency" className="w-28 bg-white/5 border-white/10 h-11">
                  <SelectValue/>
                </SelectTrigger>
                <SelectContent className="glass-strong border-white/10 text-white max-h-72">
                  {COMMON_CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  {destLoc?.suggested_currency && !COMMON_CURRENCIES.includes(destLoc.suggested_currency) && (
                    <SelectItem value={destLoc.suggested_currency}>{destLoc.suggested_currency}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Input data-testid="planner-budget" type="number" min="0" value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="bg-white/5 border-white/10 text-white h-11 flex-1" />
            </div>
          </Field>
          <Field label="Budget tier">
            <Select value={budgetTier} onValueChange={setBudgetTier}>
              <SelectTrigger data-testid="planner-budget-tier" className="bg-white/5 border-white/10 h-11"><SelectValue/></SelectTrigger>
              <SelectContent className="glass-strong border-white/10 text-white">
                {["Budget","Standard","Luxury"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Budget breakdown card */}
        <BudgetBreakdown
          amount={Number(budget) || 0}
          tier={budgetTier}
          currency={currency}
          onChange={setBudgetBreakdown}
        />

        {/* Travel type / Pace / Food */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="Travel type">
            <Select value={travelType} onValueChange={setTravelType}>
              <SelectTrigger data-testid="planner-type" className="bg-white/5 border-white/10 h-11"><SelectValue/></SelectTrigger>
              <SelectContent className="glass-strong border-white/10 text-white">
                {["Solo","Couple","Family","Friends"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Pace">
            <Select value={pace} onValueChange={setPace}>
              <SelectTrigger data-testid="planner-pace" className="bg-white/5 border-white/10 h-11"><SelectValue/></SelectTrigger>
              <SelectContent className="glass-strong border-white/10 text-white">
                {["Relaxed","Moderate","Packed"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Food preference">
            <Select value={foodPref} onValueChange={setFoodPref}>
              <SelectTrigger data-testid="planner-food" className="bg-white/5 border-white/10 h-11"><SelectValue/></SelectTrigger>
              <SelectContent className="glass-strong border-white/10 text-white">
                {["Vegetarian","Non-vegetarian","Both","Vegan"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Smart Transport */}
        <Field label="Transport mode">
          <TransportPicker
            destinationLocation={destLoc}
            sourceLocation={sourceLoc}
            days={computedDays}
            budget={Number(budget) || 0}
            currency={currency}
            value={transportMode}
            onChange={setTransportMode}
            onEstimate={setTransportEstimate}
          />
        </Field>

        {/* Interests */}
        <Field label="Interests" error={validation.interests}>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const active = interests.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleInterest(i)}
                  data-testid={`interest-${i.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  className={`px-4 py-2 rounded-full text-sm border transition ${
                    active
                      ? "bg-gradient-to-r from-fuchsia-500 to-purple-600 border-transparent text-white shadow-[0_0_15px_rgba(255,0,255,0.35)]"
                      : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                  }`}
                >{i}</button>
              );
            })}
          </div>
        </Field>

        {/* Notes */}
        <Field label="Notes (optional)">
          <Textarea data-testid="planner-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Avoid crowded places, prefer rooftop bars, etc."
            className="bg-white/5 border-white/10 text-white min-h-[90px]" />
        </Field>

        {/* Submit + validation hint */}
        <div className="space-y-3">
          <Button
            data-testid="planner-submit"
            type="submit"
            disabled={loading || !isValid}
            className="btn-primary text-white border-0 w-full h-12 rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Generating itinerary…</>
              : <><Sparkles className="w-4 h-4 mr-2"/>Generate AI Itinerary</>}
          </Button>
          {!isValid && !loading && (
            <div data-testid="validation-message" className="text-xs text-white/50 text-center flex items-center justify-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {Object.values(validation)[0]}
            </div>
          )}
        </div>
      </motion.form>
    </main>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label className="text-white/80 text-xs font-mono-acc uppercase tracking-widest">{label}</Label>
        {error && <span className="text-xs text-red-300">{error}</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
