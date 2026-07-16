"""Travel Planner AI - FastAPI backend.

Provides JWT auth, trip CRUD, AI itinerary generation (Gemini / OpenAI / Anthropic, whichever API key is configured),
chat assistant, budget computation, packing list, favorites, weather, places autocomplete,
currency exchange, transport estimation and dashboard endpoints. Uses MongoDB via motor.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import json
import re
import time
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal, Any, Dict
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt as pyjwt
import httpx

# ── LLM provider SDKs ──────────────────────────────────────────────
# All three are optional imports: only the SDK matching whichever
# *_API_KEY env var you set actually needs to be installed/used.
# This makes the backend deployable on any host (Render, Railway,
# Fly.io, a VPS, Docker, etc.) with no dependency on a third-party
# platform's proxy or managed key service.

# 1) Google Gemini — official google-genai SDK
try:
    from google import genai as google_genai
    from google.genai import types as google_genai_types
except Exception:
    google_genai = None
    google_genai_types = None

# 2) OpenAI — official openai SDK (also works with any OpenAI-compatible
#    endpoint, e.g. Azure OpenAI, Groq, Together, local vLLM, etc. via
#    OPENAI_BASE_URL)
try:
    from openai import AsyncOpenAI
except Exception:
    AsyncOpenAI = None

# 3) Anthropic Claude — official anthropic SDK
try:
    from anthropic import AsyncAnthropic
except Exception:
    AsyncAnthropic = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret")
JWT_ALG = os.environ.get("JWT_ALG", "HS256")
# LLM provider configuration — set ONE (or more, as fallbacks) of these.
# Providers are tried in this order: Gemini -> OpenAI -> Anthropic.
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "")  # optional: Azure/Groq/local, etc.

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")
GOOGLE_MAPS_KEY = os.environ.get("GOOGLE_MAPS_KEY", "")
OPENWEATHER_API_KEY = os.environ.get("OPENWEATHER_API_KEY", "")
UNSPLASH_ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Travel Planner AI")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logger = logging.getLogger("travel_planner")
logging.basicConfig(level=logging.INFO)


# ───────────────────────── In-memory caches ─────────────────────────
# Simple TTL cache for currency, autocomplete, place details
class _TTLCache:
    def __init__(self, ttl: int = 3600):
        self.ttl = ttl
        self._store: Dict[str, tuple[float, Any]] = {}

    def get(self, key: str):
        v = self._store.get(key)
        if not v:
            return None
        expires, val = v
        if time.time() > expires:
            self._store.pop(key, None)
            return None
        return val

    def set(self, key: str, val: Any):
        self._store[key] = (time.time() + self.ttl, val)


autocomplete_cache = _TTLCache(ttl=600)        # 10 min
place_details_cache = _TTLCache(ttl=86400)     # 1 day
currency_cache = _TTLCache(ttl=21600)          # 6 hours
geocode_cache = _TTLCache(ttl=86400)
transport_cache = _TTLCache(ttl=3600)


# ───────────────────────── Country → Currency ─────────────────────────
COUNTRY_CURRENCY = {
    "IN": "INR", "US": "USD", "GB": "GBP", "JP": "JPY", "FR": "EUR", "DE": "EUR",
    "IT": "EUR", "ES": "EUR", "PT": "EUR", "NL": "EUR", "BE": "EUR", "AT": "EUR",
    "GR": "EUR", "IE": "EUR", "FI": "EUR", "LU": "EUR", "SK": "EUR", "SI": "EUR",
    "EE": "EUR", "LV": "EUR", "LT": "EUR", "CY": "EUR", "MT": "EUR", "HR": "EUR",
    "TH": "THB", "SG": "SGD", "MY": "MYR", "ID": "IDR", "PH": "PHP", "VN": "VND",
    "KR": "KRW", "CN": "CNY", "HK": "HKD", "TW": "TWD", "AU": "AUD", "NZ": "NZD",
    "CA": "CAD", "MX": "MXN", "BR": "BRL", "AR": "ARS", "CL": "CLP", "CO": "COP",
    "PE": "PEN", "AE": "AED", "SA": "SAR", "QA": "QAR", "KW": "KWD", "BH": "BHD",
    "OM": "OMR", "TR": "TRY", "IL": "ILS", "EG": "EGP", "ZA": "ZAR", "KE": "KES",
    "NG": "NGN", "MA": "MAD", "RU": "RUB", "UA": "UAH", "PL": "PLN", "CZ": "CZK",
    "HU": "HUF", "RO": "RON", "BG": "BGN", "SE": "SEK", "NO": "NOK", "DK": "DKK",
    "CH": "CHF", "IS": "ISK", "LK": "LKR", "NP": "NPR", "PK": "PKR", "BD": "BDT",
    "MV": "MVR", "BT": "BTN", "MM": "MMK", "KH": "KHR", "LA": "LAK", "MN": "MNT",
}

CURRENCY_SYMBOLS = {
    "INR": "₹", "USD": "$", "EUR": "€", "GBP": "£", "JPY": "¥", "CNY": "¥",
    "KRW": "₩", "THB": "฿", "SGD": "S$", "AUD": "A$", "CAD": "C$", "HKD": "HK$",
    "AED": "د.إ", "RUB": "₽", "TRY": "₺", "VND": "₫", "IDR": "Rp", "PHP": "₱",
    "MYR": "RM", "MXN": "Mex$", "BRL": "R$", "ZAR": "R", "CHF": "CHF", "NZD": "NZ$",
    "TWD": "NT$",
}


# ───────────────────────── Transport availability heuristic ─────────────────────────
# country → list of available transport modes (most→least common)
TRANSPORT_BY_COUNTRY = {
    # Heavy rail / metro countries
    "JP": ["high_speed_rail", "metro", "train", "bus", "taxi", "walking", "bicycle", "flight"],
    "KR": ["high_speed_rail", "metro", "train", "bus", "taxi", "walking", "flight"],
    "CN": ["high_speed_rail", "metro", "train", "bus", "taxi", "walking", "flight"],
    "FR": ["high_speed_rail", "metro", "train", "bus", "taxi", "walking", "bicycle", "rental_car", "flight"],
    "DE": ["high_speed_rail", "metro", "train", "bus", "taxi", "walking", "bicycle", "rental_car", "flight"],
    "GB": ["metro", "train", "bus", "taxi", "walking", "bicycle", "rental_car", "flight"],
    "IT": ["high_speed_rail", "metro", "train", "bus", "taxi", "walking", "rental_car", "flight"],
    "ES": ["high_speed_rail", "metro", "train", "bus", "taxi", "walking", "rental_car", "flight"],
    "NL": ["train", "metro", "bus", "taxi", "bicycle", "walking", "rental_car", "flight"],
    "BE": ["train", "metro", "bus", "taxi", "bicycle", "walking", "rental_car", "flight"],
    "CH": ["train", "metro", "bus", "taxi", "walking", "rental_car", "flight"],
    "AT": ["train", "metro", "bus", "taxi", "walking", "bicycle", "rental_car", "flight"],
    "SE": ["train", "metro", "bus", "taxi", "walking", "bicycle", "rental_car", "flight"],
    "DK": ["train", "metro", "bus", "taxi", "bicycle", "walking", "rental_car", "ferry", "flight"],
    "NO": ["train", "bus", "taxi", "walking", "rental_car", "ferry", "flight"],
    "FI": ["train", "metro", "bus", "taxi", "walking", "rental_car", "flight"],
    "PT": ["train", "metro", "bus", "taxi", "walking", "rental_car", "flight"],
    "IN": ["train", "metro", "bus", "taxi", "rental_car", "scooter", "walking", "flight"],
    "TH": ["bus", "taxi", "metro", "scooter", "walking", "boat", "flight"],
    "SG": ["metro", "bus", "taxi", "walking", "flight"],
    "MY": ["metro", "train", "bus", "taxi", "rental_car", "walking", "flight"],
    "ID": ["taxi", "scooter", "bus", "walking", "ferry", "flight"],
    "PH": ["bus", "taxi", "scooter", "boat", "ferry", "walking", "flight"],
    "VN": ["bus", "taxi", "scooter", "walking", "flight"],
    "US": ["rental_car", "taxi", "metro", "bus", "train", "walking", "flight"],
    "CA": ["rental_car", "taxi", "metro", "bus", "train", "walking", "flight"],
    "AU": ["rental_car", "taxi", "metro", "bus", "train", "walking", "flight"],
    "NZ": ["rental_car", "taxi", "bus", "walking", "flight"],
    "AE": ["metro", "taxi", "bus", "walking", "rental_car", "flight"],
    "TR": ["metro", "bus", "taxi", "train", "ferry", "walking", "flight"],
    "GR": ["metro", "bus", "taxi", "ferry", "walking", "rental_car", "flight"],
    "EG": ["taxi", "bus", "metro", "walking", "flight"],
    "MX": ["bus", "taxi", "metro", "walking", "rental_car", "flight"],
    "BR": ["bus", "taxi", "metro", "walking", "flight"],
    "ZA": ["rental_car", "taxi", "bus", "walking", "flight"],
}
# default fallback
DEFAULT_TRANSPORT = ["taxi", "bus", "walking", "rental_car", "flight"]

# City-specific overrides (place id of city or city name lowercased)
CITY_TRANSPORT_OVERRIDES = {
    "venice": ["walking", "boat", "ferry"],
    "maldives": ["boat", "seaplane", "ferry"],
    "male": ["boat", "seaplane", "ferry"],
    "santorini": ["walking", "bus", "taxi", "ferry", "scooter"],
    "amsterdam": ["bicycle", "metro", "train", "tram", "walking", "boat", "taxi"],
    "hong kong": ["metro", "bus", "tram", "ferry", "taxi", "walking"],
    "macau": ["bus", "taxi", "walking", "ferry"],
}

# Estimated per-km cost in USD for each transport mode (rough averages, converted on demand)
TRANSPORT_COST_PER_KM_USD = {
    "flight": 0.15, "high_speed_rail": 0.20, "train": 0.10, "metro": 0.05,
    "bus": 0.04, "taxi": 1.20, "rental_car": 0.30, "scooter": 0.20,
    "bicycle": 0.02, "walking": 0.0, "ferry": 0.40, "boat": 0.50,
    "seaplane": 2.50, "helicopter": 4.0, "tram": 0.05,
}
TRANSPORT_BASE_FARE_USD = {
    "flight": 80, "high_speed_rail": 25, "train": 8, "metro": 2, "bus": 1.5,
    "taxi": 3, "rental_car": 35, "scooter": 5, "bicycle": 2, "walking": 0,
    "ferry": 5, "boat": 10, "seaplane": 150, "helicopter": 200, "tram": 2,
}


# ───────────────────────── Models ─────────────────────────
class SignupReq(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    preferred_currency: str = "INR"
    preferred_language: str = "en"
    profile_picture: Optional[str] = None
    created_at: str


class CityStop(BaseModel):
    name: str
    days: int = Field(ge=1, le=30)


class LocationData(BaseModel):
    """Selected from Places Autocomplete + Details."""
    place_id: Optional[str] = None
    formatted_address: Optional[str] = None
    name: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class TripCreate(BaseModel):
    destination: str
    days: int = Field(ge=1, le=60)
    cities: Optional[List[CityStop]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget: float
    currency: str = "INR"
    travel_type: Literal["Solo", "Couple", "Family", "Friends"] = "Solo"
    interests: List[str] = []
    transport: str = "Public Transport"  # human-readable
    transport_mode: Optional[str] = None  # machine code: flight, train, metro, etc.
    pace: Literal["Relaxed", "Moderate", "Packed"] = "Moderate"
    food_pref: Literal["Vegetarian", "Vegan", "Non-vegetarian", "Both"] = "Non-vegetarian"
    budget_tier: Literal["Budget", "Standard", "Luxury"] = "Standard"
    notes: Optional[str] = None
    # Enhanced location data
    source: Optional[str] = None
    source_location: Optional[LocationData] = None
    destination_location: Optional[LocationData] = None
    # Computed fields
    budget_breakdown_input: Optional[Dict[str, float]] = None
    exchange_rate: Optional[float] = None
    transport_cost_estimate: Optional[float] = None


class ChatReq(BaseModel):
    trip_id: Optional[str] = None
    message: str
    day_number: Optional[int] = None  # if set, AI regenerates only that day


class FavoriteCreate(BaseModel):
    name: str
    type: str
    location: Optional[str] = None
    rating: Optional[float] = None
    trip_id: Optional[str] = None
    meta: Optional[dict] = None


# ───────────────────────── Helpers ─────────────────────────
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=14),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not creds:
        raise HTTPException(401, "Missing token")
    try:
        payload = pyjwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except pyjwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


def user_to_out(u: Dict[str, Any]) -> UserOut:
    return UserOut(
        id=u["id"], name=u["name"], email=u["email"],
        preferred_currency=u.get("preferred_currency", "INR"),
        preferred_language=u.get("preferred_language", "en"),
        profile_picture=u.get("profile_picture"),
        created_at=u["created_at"],
    )


# ───────────────────────── Auth ─────────────────────────
@api.post("/auth/signup")
async def signup(req: SignupReq):
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "name": req.name,
        "email": req.email.lower(),
        "password_hash": hash_pw(req.password),
        "preferred_currency": "INR",
        "preferred_language": "en",
        "profile_picture": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    return {"token": make_token(uid), "user": user_to_out(doc).model_dump()}


@api.post("/auth/login")
async def login(req: LoginReq):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_pw(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    return {"token": make_token(user["id"]), "user": user_to_out(user).model_dump()}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user_to_out(user).model_dump()


@api.put("/auth/me")
async def update_me(body: dict, user=Depends(current_user)):
    allowed = {k: v for k, v in body.items() if k in {"name", "preferred_currency", "preferred_language", "profile_picture"}}
    if allowed:
        await db.users.update_one({"id": user["id"]}, {"$set": allowed})
    new_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return user_to_out(new_user).model_dump()


# ───────────────────────── Places: Autocomplete + Details ─────────────────────────
AUTOCOMPLETE_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
PLACES_TEXT_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"
DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"


@api.get("/places/autocomplete")
async def places_autocomplete(input: str, session_token: Optional[str] = None):
    """Google Places Autocomplete — returns suggestions including cities, addresses, POIs.
    Globally biased (no country/types restriction)."""
    if not GOOGLE_MAPS_KEY:
        raise HTTPException(503, "Google Maps key not configured")
    inp = (input or "").strip()
    if not inp:
        return {"predictions": []}

    cache_key = f"ac:{inp.lower()}:{session_token or ''}"
    cached = autocomplete_cache.get(cache_key)
    if cached is not None:
        return cached

    params = {"input": inp, "key": GOOGLE_MAPS_KEY, "language": "en"}
    if session_token:
        params["sessiontoken"] = session_token

    async with httpx.AsyncClient(timeout=10) as cli:
        r = await cli.get(AUTOCOMPLETE_URL, params=params)
    if r.status_code != 200:
        raise HTTPException(502, "Places Autocomplete error")
    data = r.json()
    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        logger.warning("Autocomplete status=%s msg=%s", data.get("status"), data.get("error_message"))
        return {"predictions": [], "status": data.get("status")}

    out = []
    for p in (data.get("predictions") or []):
        out.append({
            "place_id": p.get("place_id"),
            "description": p.get("description"),
            "main_text": (p.get("structured_formatting") or {}).get("main_text"),
            "secondary_text": (p.get("structured_formatting") or {}).get("secondary_text"),
            "types": p.get("types", []),
        })
    result = {"predictions": out, "status": data.get("status")}
    autocomplete_cache.set(cache_key, result)
    return result


def _extract_address_components(components: List[Dict[str, Any]]) -> Dict[str, Any]:
    out = {"city": None, "state": None, "country": None, "country_code": None}
    for c in components or []:
        types = c.get("types", [])
        if "country" in types:
            out["country"] = c.get("long_name")
            out["country_code"] = c.get("short_name")
        if "administrative_area_level_1" in types and not out["state"]:
            out["state"] = c.get("long_name")
        if "locality" in types and not out["city"]:
            out["city"] = c.get("long_name")
        elif "administrative_area_level_2" in types and not out["city"]:
            out["city"] = c.get("long_name")
        elif "postal_town" in types and not out["city"]:
            out["city"] = c.get("long_name")
    return out


@api.get("/places/details")
async def places_details(place_id: str, session_token: Optional[str] = None):
    if not GOOGLE_MAPS_KEY:
        raise HTTPException(503, "Google Maps key not configured")
    cache_key = f"pd:{place_id}"
    cached = place_details_cache.get(cache_key)
    if cached is not None:
        return cached
    params = {
        "place_id": place_id,
        "fields": "place_id,name,formatted_address,address_components,geometry/location,types",
        "key": GOOGLE_MAPS_KEY,
        "language": "en",
    }
    if session_token:
        params["sessiontoken"] = session_token
    async with httpx.AsyncClient(timeout=10) as cli:
        r = await cli.get(PLACE_DETAILS_URL, params=params)
    if r.status_code != 200:
        raise HTTPException(502, "Places Details error")
    data = r.json()
    if data.get("status") != "OK":
        raise HTTPException(502, f"Places Details: {data.get('status')}")
    res = data.get("result") or {}
    loc = (res.get("geometry") or {}).get("location") or {}
    comp = _extract_address_components(res.get("address_components") or [])
    suggested_currency = COUNTRY_CURRENCY.get(comp.get("country_code") or "", "USD")
    out = {
        "place_id": res.get("place_id"),
        "name": res.get("name"),
        "formatted_address": res.get("formatted_address"),
        "lat": loc.get("lat"),
        "lng": loc.get("lng"),
        "city": comp.get("city"),
        "state": comp.get("state"),
        "country": comp.get("country"),
        "country_code": comp.get("country_code"),
        "types": res.get("types", []),
        "suggested_currency": suggested_currency,
        "currency_symbol": CURRENCY_SYMBOLS.get(suggested_currency, suggested_currency),
    }
    place_details_cache.set(cache_key, out)
    return out


# ───────────────────────── Currency ─────────────────────────
EXCHANGE_API = "https://open.er-api.com/v6/latest/USD"


async def _get_usd_rates() -> Dict[str, float]:
    cached = currency_cache.get("usd_rates")
    if cached:
        return cached
    async with httpx.AsyncClient(timeout=10) as cli:
        r = await cli.get(EXCHANGE_API)
    if r.status_code != 200:
        raise HTTPException(502, "Exchange rate fetch failed")
    data = r.json()
    if data.get("result") != "success":
        raise HTTPException(502, "Exchange rate API error")
    rates = data.get("rates") or {}
    currency_cache.set("usd_rates", rates)
    return rates


@api.get("/currency/rates")
async def currency_rates():
    rates = await _get_usd_rates()
    return {"base": "USD", "rates": rates, "symbols": CURRENCY_SYMBOLS}


@api.get("/currency/convert")
async def currency_convert(from_: str = "USD", to: str = "USD", amount: float = 1.0):
    """Note: query param is `from` in url, here aliased to `from_`. Use ?from=...&to=...&amount=..."""
    rates = await _get_usd_rates()
    f = from_.upper()
    t = to.upper()
    if f != "USD" and f not in rates:
        raise HTTPException(400, f"Unknown currency {f}")
    if t != "USD" and t not in rates:
        raise HTTPException(400, f"Unknown currency {t}")
    amount_usd = amount / (rates.get(f, 1.0) if f != "USD" else 1.0)
    converted = amount_usd * (rates.get(t, 1.0) if t != "USD" else 1.0)
    return {
        "from": f, "to": t, "amount": amount,
        "rate": (rates.get(t, 1.0) if t != "USD" else 1.0) / (rates.get(f, 1.0) if f != "USD" else 1.0),
        "converted": round(converted, 2),
        "symbol": CURRENCY_SYMBOLS.get(t, t),
    }


# FastAPI route alias because "from" is a reserved word
@app.get("/api/currency/convert")
async def currency_convert_alias(request: Request):
    f = request.query_params.get("from", "USD")
    t = request.query_params.get("to", "USD")
    try:
        amt = float(request.query_params.get("amount", "1"))
    except ValueError:
        raise HTTPException(400, "amount must be a number")
    return await currency_convert(from_=f, to=t, amount=amt)


# ───────────────────────── Budget Breakdown ─────────────────────────
# Default percentages per budget tier
BUDGET_BREAKDOWN_TIERS = {
    "Budget":   {"accommodation": 35, "transport": 25, "food": 20, "activities": 10, "shopping": 5,  "emergency": 5},
    "Standard": {"accommodation": 40, "transport": 20, "food": 20, "activities": 10, "shopping": 5,  "emergency": 5},
    "Luxury":   {"accommodation": 45, "transport": 15, "food": 20, "activities": 10, "shopping": 5,  "emergency": 5},
}


@api.get("/budget/breakdown")
async def budget_breakdown(amount: float, tier: str = "Standard", currency: str = "USD"):
    pcts = BUDGET_BREAKDOWN_TIERS.get(tier, BUDGET_BREAKDOWN_TIERS["Standard"])
    out = {}
    for k, p in pcts.items():
        out[k] = {"percentage": p, "amount": round(amount * p / 100, 2)}
    return {
        "currency": currency,
        "symbol": CURRENCY_SYMBOLS.get(currency, currency),
        "total": amount,
        "tier": tier,
        "breakdown": out,
    }


# ───────────────────────── Transport options & estimate ─────────────────────────
TRANSPORT_LABELS = {
    "flight": "Flight", "high_speed_rail": "High-speed Rail", "train": "Train",
    "metro": "Metro", "bus": "Bus", "taxi": "Taxi", "rental_car": "Rental Car",
    "bicycle": "Bicycle", "scooter": "Scooter", "walking": "Walking",
    "ferry": "Ferry", "boat": "Boat", "seaplane": "Seaplane",
    "helicopter": "Helicopter", "tram": "Tram",
}
TRANSPORT_ICONS = {
    "flight": "Plane", "high_speed_rail": "TrainFront", "train": "TrainTrack",
    "metro": "TrainFrontTunnel", "bus": "Bus", "taxi": "Car",
    "rental_car": "Car", "bicycle": "Bike", "scooter": "Bike",
    "walking": "Footprints", "ferry": "Ship", "boat": "Sailboat",
    "seaplane": "Plane", "helicopter": "Plane", "tram": "TrainFront",
}


@api.get("/transport/options")
async def transport_options(country_code: Optional[str] = None, city: Optional[str] = None):
    """Returns transport modes available at the destination."""
    modes: Optional[List[str]] = None
    if city:
        city_l = city.lower().strip()
        for key, val in CITY_TRANSPORT_OVERRIDES.items():
            if key in city_l:
                modes = val
                break
    if modes is None:
        modes = TRANSPORT_BY_COUNTRY.get((country_code or "").upper(), DEFAULT_TRANSPORT)
    return {
        "options": [
            {"code": m, "label": TRANSPORT_LABELS.get(m, m.title()), "icon": TRANSPORT_ICONS.get(m, "Car")}
            for m in modes
        ]
    }


async def _distance_km(origin: tuple, dest: tuple) -> Optional[float]:
    """Use Google Distance Matrix for driving distance; fall back to haversine."""
    cache_key = f"dm:{origin[0]:.3f},{origin[1]:.3f}:{dest[0]:.3f},{dest[1]:.3f}"
    cached = transport_cache.get(cache_key)
    if cached:
        return cached
    if GOOGLE_MAPS_KEY:
        try:
            async with httpx.AsyncClient(timeout=10) as cli:
                r = await cli.get(DISTANCE_MATRIX_URL, params={
                    "origins": f"{origin[0]},{origin[1]}",
                    "destinations": f"{dest[0]},{dest[1]}",
                    "mode": "driving",
                    "key": GOOGLE_MAPS_KEY,
                })
            data = r.json()
            element = (data.get("rows") or [{}])[0].get("elements", [{}])[0]
            if element.get("status") == "OK":
                meters = element.get("distance", {}).get("value", 0)
                km = meters / 1000.0
                transport_cache.set(cache_key, km)
                return km
        except Exception as e:
            logger.warning("Distance Matrix failed: %s", e)
    # haversine
    from math import radians, sin, cos, asin, sqrt
    lat1, lon1 = radians(origin[0]), radians(origin[1])
    lat2, lon2 = radians(dest[0]), radians(dest[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    km = 6371 * c
    transport_cache.set(cache_key, km)
    return km


@api.post("/transport/estimate")
async def transport_estimate(body: dict):
    """Estimate one-way transport cost between two coords for a given mode.
    Body: { origin_lat, origin_lng, dest_lat, dest_lng, mode, currency, days, budget? }
    """
    try:
        olat = float(body["origin_lat"])
        olng = float(body["origin_lng"])
        dlat = float(body["dest_lat"])
        dlng = float(body["dest_lng"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(400, "Missing/invalid origin/destination coordinates")
    mode = (body.get("mode") or "taxi").lower()
    currency = (body.get("currency") or "USD").upper()
    days = max(1, int(body.get("days") or 1))
    budget = body.get("budget")

    km = await _distance_km((olat, olng), (dlat, dlng))
    if km is None:
        raise HTTPException(502, "Could not compute distance")

    per_km = TRANSPORT_COST_PER_KM_USD.get(mode, 0.5)
    base = TRANSPORT_BASE_FARE_USD.get(mode, 5)

    # For long-haul use flight regardless if user picked train (>1500km) - we still respect user choice but cap walking/bicycle
    if mode in ("walking", "bicycle") and km > 50:
        # impractical; show small local fee per day
        cost_usd_one_way = days * 0
    elif mode in ("metro", "tram", "bus"):
        # Local intra-city; estimate daily passes
        cost_usd_one_way = days * 5  # ~$5/day local public transit per person
    elif mode == "taxi":
        cost_usd_one_way = base + per_km * km + (days * 15)  # daily intra-city taxis
    elif mode == "rental_car":
        cost_usd_one_way = base * days + per_km * km * 2  # daily rental + fuel
    elif mode == "flight":
        # flight cost grows logarithmically not linearly
        from math import log
        cost_usd_one_way = base + per_km * km * 0.4 * (1 + log(max(km, 1)) / 10)
    else:
        cost_usd_one_way = base + per_km * km

    # Convert to user currency
    rates = await _get_usd_rates()
    rate = rates.get(currency, 1.0) if currency != "USD" else 1.0
    cost = round(cost_usd_one_way * rate, 2)

    pct_of_budget = None
    if budget:
        try:
            pct_of_budget = round((cost / float(budget)) * 100, 1)
        except Exception:
            pct_of_budget = None

    return {
        "mode": mode,
        "label": TRANSPORT_LABELS.get(mode, mode.title()),
        "distance_km": round(km, 1),
        "cost": cost,
        "currency": currency,
        "symbol": CURRENCY_SYMBOLS.get(currency, currency),
        "percentage_of_budget": pct_of_budget,
        "rate_to_usd": rate,
    }


# ───────────────────────── AI Itinerary ─────────────────────────
SYSTEM_PROMPT = """You are a world-class travel planner. Always respond with STRICT valid JSON (no markdown, no commentary).

Generate a detailed day-wise itinerary using this exact JSON schema:
{
  "summary": "1-2 sentence trip overview",
  "best_time_to_visit": "string",
  "highlights": ["3-5 highlights"],
  "days": [
    {
      "day": 1,
      "title": "Day theme",
      "weather_aware_note": "Brief note on how today's plan is optimized for the forecast",
      "morning":  {"activity": "...", "place_name": "...", "time": "9:00 AM - 12:00 PM", "duration_hours": 3, "location": "...", "cost": 1000, "rating": 4.5, "opening_hours": "9:00 - 18:00", "travel_from_prev_min": 0, "travel_from_prev_km": 0, "tips": "...", "rain_alt": "..."},
      "afternoon":{"activity": "...", "place_name": "...", "time": "12:30 PM - 5:00 PM", "duration_hours": 4, "location": "...", "cost": 1500, "rating": 4.3, "opening_hours": "10:00 - 22:00", "travel_from_prev_min": 15, "travel_from_prev_km": 3.2, "tips": "...", "rain_alt": "..."},
      "evening":  {"activity": "...", "place_name": "...", "time": "6:00 PM - 10:00 PM", "duration_hours": 4, "location": "...", "cost": 2000, "rating": 4.6, "opening_hours": "17:00 - 23:00", "travel_from_prev_min": 10, "travel_from_prev_km": 2.0, "tips": "...", "rain_alt": "..."},
      "daily_budget": {"accommodation": 0, "transport": 0, "food": 0, "activities": 0, "shopping": 0, "emergency": 0, "total": 0},
      "estimated_cost": 4500,
      "travel_time_notes": "..."
    }
  ],
  "budget_breakdown": {"accommodation": 0, "transport": 0, "food": 0, "activities": 0, "shopping": 0, "emergency": 0},
  "restaurants": [{"name":"...","cuisine":"...","price_level":"$$","rating":4.5,"meal":"lunch"}],
  "packing_list": ["item 1","item 2"],
  "safety": {"emergency_number":"112","tips":["..."]},
  "hidden_gems": ["..."],
  "optimization_tips": ["if over budget, do X"]
}

All costs must be integers in the user's currency. Keep entries concise. Plan attractions in geographic proximity to minimise travel time. Adapt activities to the forecasted weather provided in the prompt."""


def extract_json(text: str) -> Dict[str, Any]:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1:
        text = text[start: end + 1]
    return json.loads(text)


# ───────────────────────── LLM Clients ─────────────────────────
_llm_client_cache: Dict[str, Any] = {}


def _get_gemini_client():
    if not GEMINI_API_KEY or google_genai is None:
        return None
    if "gemini" not in _llm_client_cache:
        _llm_client_cache["gemini"] = google_genai.Client(api_key=GEMINI_API_KEY)
    return _llm_client_cache["gemini"]


def _get_openai_client():
    if not OPENAI_API_KEY or AsyncOpenAI is None:
        return None
    if "openai" not in _llm_client_cache:
        kwargs = {"api_key": OPENAI_API_KEY}
        if OPENAI_BASE_URL:
            kwargs["base_url"] = OPENAI_BASE_URL
        _llm_client_cache["openai"] = AsyncOpenAI(**kwargs)
    return _llm_client_cache["openai"]


def _get_anthropic_client():
    if not ANTHROPIC_API_KEY or AsyncAnthropic is None:
        return None
    if "anthropic" not in _llm_client_cache:
        _llm_client_cache["anthropic"] = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    return _llm_client_cache["anthropic"]


async def _call_gemini(system_prompt: str, user_prompt: str, expect_json: bool) -> str:
    import anyio
    gem = _get_gemini_client()
    config_kwargs = {"system_instruction": system_prompt, "temperature": 0.7}
    if expect_json:
        config_kwargs["response_mime_type"] = "application/json"

    def _run():
        config = google_genai_types.GenerateContentConfig(**config_kwargs)
        resp = gem.models.generate_content(model=GEMINI_MODEL, contents=user_prompt, config=config)
        return resp.text or ""

    return await anyio.to_thread.run_sync(_run)


async def _call_openai(system_prompt: str, user_prompt: str, expect_json: bool) -> str:
    client = _get_openai_client()
    kwargs = {}
    if expect_json:
        kwargs["response_format"] = {"type": "json_object"}
    resp = await client.chat.completions.create(
        model=OPENAI_MODEL,
        temperature=0.7,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        **kwargs,
    )
    return resp.choices[0].message.content or ""


async def _call_anthropic(system_prompt: str, user_prompt: str, expect_json: bool) -> str:
    client = _get_anthropic_client()
    prompt = user_prompt
    if expect_json:
        prompt += "\n\nRespond with ONLY the raw JSON object, no markdown fences, no commentary."
    resp = await client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=4096,
        temperature=0.7,
        system=system_prompt,
        messages=[{"role": "user", "content": prompt}],
    )
    return "".join(block.text for block in resp.content if block.type == "text")


async def _llm_generate(system_prompt: str, user_prompt: str, session_id: str = "default", expect_json: bool = True) -> str:
    """Generate a completion using whichever LLM provider is configured.

    Tries, in order: Google Gemini (GEMINI_API_KEY) -> OpenAI or any
    OpenAI-compatible endpoint (OPENAI_API_KEY[, OPENAI_BASE_URL]) ->
    Anthropic Claude (ANTHROPIC_API_KEY). Configure exactly one for a
    single provider, or several to have automatic fallover if a call
    fails. This has no dependency on any third-party proxy service, so
    the backend can be deployed anywhere (Docker, a VPS, Render,
    Railway, Fly.io, AWS, etc.) using only the provider's own API key.
    """
    providers = [
        ("gemini", _get_gemini_client, _call_gemini),
        ("openai", _get_openai_client, _call_openai),
        ("anthropic", _get_anthropic_client, _call_anthropic),
    ]
    configured = [(name, call) for name, get_client, call in providers if get_client() is not None]

    if not configured:
        raise HTTPException(
            503,
            "No LLM credentials configured. Set one of GEMINI_API_KEY, "
            "OPENAI_API_KEY, or ANTHROPIC_API_KEY in the backend environment.",
        )

    last_error = None
    for name, call in configured:
        try:
            return await call(system_prompt, user_prompt, expect_json)
        except Exception as e:
            logger.exception("%s LLM call failed: %s", name, e)
            last_error = e
    raise HTTPException(502, f"All configured LLM providers failed: {last_error}")


async def _fetch_weather_summary(destination: str, days: int, start_date: Optional[str]) -> List[Dict[str, Any]]:
    """Brief per-day weather summary used by the AI prompt."""
    try:
        res = await weather(destination=destination, days=days, start_date=start_date)
        return [{"day": d.get("day"), "date": d.get("date"), "condition": d.get("condition"),
                 "temp_c": d.get("temp_c"), "rain_chance": d.get("rain_chance")}
                for d in (res.get("forecast") or [])]
    except Exception as e:
        logger.warning("Weather summary fetch failed: %s", e)
        return []


async def generate_itinerary(trip: Dict[str, Any]) -> Dict[str, Any]:
    cities_str = ""
    if trip.get("cities"):
        chain = " → ".join(f"{c['name']} ({c['days']}d)" for c in trip["cities"])
        cities_str = (
            f"\nMulti-city route: {chain}. "
            f"Plan day-by-day numbered across the entire trip, include city transitions "
            f"with transit time, mode (train/flight/bus), and approx cost. "
            f"On transition days, slot 'morning' or 'afternoon' as the journey itself.\n"
        )

    source_str = ""
    if trip.get("source"):
        source_str = f"\nSource (Origin): {trip['source']}"

    transport_str = trip.get("transport_mode") or trip.get("transport") or "Public Transport"
    transport_cost_str = ""
    if trip.get("transport_cost_estimate"):
        transport_cost_str = f" (estimated round-trip transport cost: {trip['currency']} {trip['transport_cost_estimate']:.0f})"

    weather_lines = await _fetch_weather_summary(trip['destination'], trip['days'], trip.get('start_date'))
    weather_str = ""
    if weather_lines:
        weather_str = "\n\nDaily forecast (adapt activities accordingly):\n" + "\n".join(
            f"  Day {w['day']} ({w.get('date','')}): {w.get('condition','-')}, "
            f"{w.get('temp_c','?')}°C, rain {w.get('rain_chance',0)}%"
            for w in weather_lines
        )
        weather_str += (
            "\nFor rainy/snowy days emphasise indoor museums, cafes, malls, aquariums. "
            "For sunny days emphasise parks, walking tours, viewpoints. "
            "For cloudy days emphasise photography, markets, shopping."
        )

    user_prompt = f"""Create a {trip['days']}-day itinerary.

Destination: {trip['destination']}{source_str}
Days: {trip['days']}{cities_str}
Budget: {trip['currency']} {trip['budget']:.0f} ({trip['budget_tier']})
Travel type: {trip['travel_type']}
Interests: {', '.join(trip['interests']) or 'General'}
Transport preference: {transport_str}{transport_cost_str}
Pace: {trip['pace']}
Food preference: {trip['food_pref']}
Start date: {trip.get('start_date') or 'Flexible'}
Notes: {trip.get('notes') or 'None'}{weather_str}

Return ONLY the JSON object."""
    resp = await _llm_generate(SYSTEM_PROMPT, user_prompt, session_id=f"itinerary-{trip['id']}", expect_json=True)
    try:
        return extract_json(resp)
    except Exception as e:
        logger.exception("Failed to parse itinerary JSON: %s", e)
        raise HTTPException(502, "AI returned invalid itinerary format. Please try again.")


# ───────────────────────── Trips ─────────────────────────
@api.post("/trips")
async def create_trip(body: TripCreate, user=Depends(current_user)):
    trip_id = str(uuid.uuid4())
    trip = {
        "id": trip_id,
        "user_id": user["id"],
        **body.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "itinerary": None,
        "status": "generating",
    }
    await db.trips.insert_one(trip)
    try:
        itinerary = await generate_itinerary(trip)
        await db.trips.update_one(
            {"id": trip_id},
            {"$set": {"itinerary": itinerary, "status": "ready"}},
        )
        trip["itinerary"] = itinerary
        trip["status"] = "ready"
    except HTTPException:
        await db.trips.update_one({"id": trip_id}, {"$set": {"status": "error"}})
        raise
    trip.pop("_id", None)
    return trip


@api.get("/trips")
async def list_trips(user=Depends(current_user)):
    cur = db.trips.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    trips = await cur.to_list(200)
    return trips


@api.get("/trips/{trip_id}")
async def get_trip(trip_id: str, user=Depends(current_user)):
    trip = await db.trips.find_one({"id": trip_id, "user_id": user["id"]}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Trip not found")
    return trip


@api.delete("/trips/{trip_id}")
async def delete_trip(trip_id: str, user=Depends(current_user)):
    res = await db.trips.delete_one({"id": trip_id, "user_id": user["id"]})
    await db.chat_history.delete_many({"trip_id": trip_id})
    return {"deleted": res.deleted_count}


@api.post("/trips/{trip_id}/regenerate")
async def regenerate(trip_id: str, user=Depends(current_user)):
    trip = await db.trips.find_one({"id": trip_id, "user_id": user["id"]}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Trip not found")
    itinerary = await generate_itinerary(trip)
    await db.trips.update_one({"id": trip_id}, {"$set": {"itinerary": itinerary, "status": "ready"}})
    trip["itinerary"] = itinerary
    return trip


@api.post("/trips/{trip_id}/regenerate-day")
async def regenerate_day(trip_id: str, body: dict, user=Depends(current_user)):
    """Regenerate ONE specific day, optionally with user instructions like 'replace museum with shopping'."""
    trip = await db.trips.find_one({"id": trip_id, "user_id": user["id"]}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Trip not found")
    day_number = int(body.get("day_number", 0))
    instruction = (body.get("instruction") or "").strip()
    if not day_number:
        raise HTTPException(400, "day_number required")
    it = trip.get("itinerary") or {}
    days = it.get("days") or []
    target = next((d for d in days if d.get("day") == day_number), None)
    if not target:
        raise HTTPException(404, "Day not found")

    chat_system = (
        "You are a travel planner. Regenerate a single day of an itinerary. "
        "Respond ONLY with strict JSON for the new day, no markdown, using this schema: "
        '{"day": N, "title": "...", "morning": {...}, "afternoon": {...}, "evening": {...}, '
        '"estimated_cost": 0, "travel_time_notes": "..."}'
    )

    prompt = f"""Trip context:
Destination: {trip['destination']}
Day {day_number} of {trip.get('days')}
Budget: {trip['currency']} {trip['budget']:.0f} (~{trip['currency']} {trip['budget']/max(trip.get('days') or 1, 1):.0f} per day)
Travel type: {trip['travel_type']}, Interests: {', '.join(trip.get('interests') or [])}
Pace: {trip['pace']}, Food: {trip['food_pref']}

Current day to replace:
{json.dumps(target, ensure_ascii=False)}

User instruction: {instruction or 'Regenerate with different attractions while keeping similar themes.'}

Return JSON for the new day only."""
    resp = await _llm_generate(chat_system, prompt, session_id=f"itinerary-day-{trip_id}-{day_number}", expect_json=True)
    try:
        new_day = extract_json(resp)
    except Exception:
        raise HTTPException(502, "AI returned invalid JSON")
    new_day["day"] = day_number
    new_days = [new_day if d.get("day") == day_number else d for d in days]
    it["days"] = new_days
    await db.trips.update_one({"id": trip_id}, {"$set": {"itinerary": it}})
    return {"day": new_day, "trip_id": trip_id}


# ───────────────────────── Weather (OpenWeather + mock fallback) ─────────────────────────
def _mock_weather(destination: str, days: int) -> Dict[str, Any]:
    import hashlib
    h = int(hashlib.sha256(destination.lower().encode()).hexdigest(), 16)
    base_temp = 18 + (h % 15)
    conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Light Rain", "Clear"]
    forecast = []
    for i in range(min(days, 7)):
        seed = (h + i * 31) % 100
        forecast.append({
            "day": i + 1,
            "date": (datetime.now(timezone.utc) + timedelta(days=i)).date().isoformat(),
            "condition": conditions[seed % len(conditions)],
            "temp_c": base_temp + (seed % 8) - 2,
            "feels_like": base_temp + (seed % 8) - 4,
            "rain_chance": (seed * 7) % 90,
            "humidity": 40 + (seed % 50),
            "wind_speed": 5 + (seed % 15),
            "uv": 1 + (seed % 10),
            "icon": "02d",
        })
    return {"destination": destination, "current": forecast[0], "forecast": forecast, "source": "mock"}


@api.get("/weather")
async def weather(destination: str, days: int = 7, start_date: Optional[str] = None):
    if not OPENWEATHER_API_KEY:
        return _mock_weather(destination, days)
    try:
        async with httpx.AsyncClient(timeout=15) as cli:
            # Get coords via geocoding to use One Call when possible
            geo_r = await cli.get(
                "https://api.openweathermap.org/geo/1.0/direct",
                params={"q": destination, "limit": 1, "appid": OPENWEATHER_API_KEY},
            )
            geo_data = geo_r.json() if geo_r.status_code == 200 else []
            lat = lng = None
            if geo_data:
                lat = geo_data[0].get("lat")
                lng = geo_data[0].get("lon")

            # Try forecast endpoint (5-day / 3-hour) — free tier
            r = await cli.get(
                "https://api.openweathermap.org/data/2.5/forecast",
                params={"q": destination, "units": "metric", "appid": OPENWEATHER_API_KEY},
            )
            sun_data = {}
            if lat is not None and lng is not None:
                # current weather has sunrise/sunset
                cw = await cli.get(
                    "https://api.openweathermap.org/data/2.5/weather",
                    params={"lat": lat, "lon": lng, "units": "metric", "appid": OPENWEATHER_API_KEY},
                )
                if cw.status_code == 200:
                    sd = cw.json().get("sys") or {}
                    sun_data = {"sunrise": sd.get("sunrise"), "sunset": sd.get("sunset")}

        if r.status_code != 200:
            logger.warning("OpenWeather %s: %s", r.status_code, r.text[:200])
            return _mock_weather(destination, days)
        data = r.json()
        by_day: Dict[str, list] = {}
        for item in data.get("list", []):
            day = item["dt_txt"][:10]
            by_day.setdefault(day, []).append(item)
        out = []
        for i, (day, items) in enumerate(list(by_day.items())[:days]):
            mid = items[len(items) // 2]
            temps = [it["main"]["temp"] for it in items]
            feels = [it["main"].get("feels_like", it["main"]["temp"]) for it in items]
            rain_chances = [it.get("pop", 0) for it in items]
            humids = [it["main"]["humidity"] for it in items]
            winds = [it.get("wind", {}).get("speed", 0) for it in items]
            out.append({
                "day": i + 1,
                "date": day,
                "condition": mid["weather"][0]["main"],
                "description": mid["weather"][0]["description"],
                "icon": mid["weather"][0]["icon"],
                "temp_c": round(sum(temps) / len(temps), 1),
                "feels_like": round(sum(feels) / len(feels), 1),
                "temp_min": round(min(temps), 1),
                "temp_max": round(max(temps), 1),
                "rain_chance": round(max(rain_chances) * 100),
                "humidity": round(sum(humids) / len(humids)),
                "wind_speed": round(sum(winds) / len(winds), 1),
                "uv": None,
                "hourly": [
                    {
                        "time": it["dt_txt"],
                        "temp": it["main"]["temp"],
                        "condition": it["weather"][0]["main"],
                        "icon": it["weather"][0]["icon"],
                        "pop": round(it.get("pop", 0) * 100),
                    } for it in items
                ],
            })
        if not out:
            return _mock_weather(destination, days)
        return {
            "destination": destination,
            "lat": lat, "lng": lng,
            "current": {**out[0], **sun_data},
            "forecast": out,
            "sunrise": sun_data.get("sunrise"),
            "sunset": sun_data.get("sunset"),
            "source": "openweather",
        }
    except Exception as e:
        logger.warning("OpenWeather fetch failed: %s", e)
        return _mock_weather(destination, days)


@api.get("/weather/air-quality")
async def air_quality(lat: float, lng: float):
    if not OPENWEATHER_API_KEY:
        raise HTTPException(503, "OpenWeather key not configured")
    async with httpx.AsyncClient(timeout=10) as cli:
        r = await cli.get(
            "https://api.openweathermap.org/data/2.5/air_pollution",
            params={"lat": lat, "lon": lng, "appid": OPENWEATHER_API_KEY},
        )
    if r.status_code != 200:
        raise HTTPException(502, "Air pollution API error")
    data = r.json()
    item = (data.get("list") or [{}])[0]
    aqi = (item.get("main") or {}).get("aqi")
    labels = {1: "Good", 2: "Fair", 3: "Moderate", 4: "Poor", 5: "Very Poor"}
    return {
        "aqi": aqi,
        "label": labels.get(aqi, "Unknown"),
        "components": item.get("components") or {},
    }


# ───────────────────────── Google Places: nearby + restaurants ─────────────────────────
@api.get("/places/restaurants")
async def places_restaurants(destination: str, food_pref: str = "Non-vegetarian", limit: int = 12):
    if not GOOGLE_MAPS_KEY:
        raise HTTPException(503, "Google Maps key not configured")
    query_terms = {
        "Vegetarian": "vegetarian restaurants",
        "Vegan": "vegan restaurants",
        "Non-vegetarian": "popular restaurants",
        "Both": "popular restaurants",
    }
    q = f"{query_terms.get(food_pref, 'restaurants')} in {destination}"
    async with httpx.AsyncClient(timeout=15) as cli:
        r = await cli.get(PLACES_TEXT_URL, params={"query": q, "key": GOOGLE_MAPS_KEY})
    if r.status_code != 200:
        raise HTTPException(502, "Places API error")
    data = r.json()
    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        raise HTTPException(502, f"Places API: {data.get('status')}")
    out = []
    for p in (data.get("results") or [])[:limit]:
        loc = p.get("geometry", {}).get("location", {})
        out.append({
            "place_id": p.get("place_id"),
            "name": p.get("name"),
            "address": p.get("formatted_address"),
            "rating": p.get("rating"),
            "user_ratings_total": p.get("user_ratings_total"),
            "price_level": p.get("price_level"),
            "lat": loc.get("lat"),
            "lng": loc.get("lng"),
            "open_now": (p.get("opening_hours") or {}).get("open_now"),
            "types": p.get("types", []),
            "photo_ref": (p.get("photos") or [{}])[0].get("photo_reference") if p.get("photos") else None,
        })
    return {"destination": destination, "results": out}


@api.get("/places/nearby")
async def places_nearby(
    lat: float, lng: float,
    type: str = "restaurant",
    radius: int = 5000,
    keyword: Optional[str] = None,
    limit: int = 20,
):
    """Generic nearby search. type can be: restaurant, tourist_attraction, hospital,
    police, embassy, atm, pharmacy, lodging, transit_station, etc."""
    if not GOOGLE_MAPS_KEY:
        raise HTTPException(503, "Google Maps key not configured")
    params = {
        "location": f"{lat},{lng}",
        "radius": radius,
        "type": type,
        "key": GOOGLE_MAPS_KEY,
    }
    if keyword:
        params["keyword"] = keyword
    async with httpx.AsyncClient(timeout=15) as cli:
        r = await cli.get(PLACES_NEARBY_URL, params=params)
    if r.status_code != 200:
        raise HTTPException(502, "Places nearby API error")
    data = r.json()
    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        logger.warning("Places nearby status=%s", data.get("status"))
        return {"results": [], "status": data.get("status")}
    out = []
    for p in (data.get("results") or [])[:limit]:
        loc = p.get("geometry", {}).get("location", {})
        out.append({
            "place_id": p.get("place_id"),
            "name": p.get("name"),
            "address": p.get("vicinity") or p.get("formatted_address"),
            "rating": p.get("rating"),
            "user_ratings_total": p.get("user_ratings_total"),
            "lat": loc.get("lat"),
            "lng": loc.get("lng"),
            "open_now": (p.get("opening_hours") or {}).get("open_now"),
            "types": p.get("types", []),
            "photo_ref": (p.get("photos") or [{}])[0].get("photo_reference") if p.get("photos") else None,
        })
    return {"results": out}


@api.get("/places/photo")
async def places_photo(ref: str, maxwidth: int = 600):
    """Return a redirect/proxy URL for a Google Places photo (signed with key)."""
    if not GOOGLE_MAPS_KEY:
        raise HTTPException(503, "Google Maps key not configured")
    from starlette.responses import RedirectResponse
    url = (
        f"https://maps.googleapis.com/maps/api/place/photo"
        f"?maxwidth={maxwidth}&photo_reference={ref}&key={GOOGLE_MAPS_KEY}"
    )
    return RedirectResponse(url=url, status_code=302)


@api.get("/places/geocode")
async def places_geocode(q: str):
    if not GOOGLE_MAPS_KEY:
        raise HTTPException(503, "Google Maps key not configured")
    cached = geocode_cache.get(f"gc:{q.lower()}")
    if cached:
        return cached
    async with httpx.AsyncClient(timeout=15) as cli:
        r = await cli.get(GEOCODE_URL, params={"address": q, "key": GOOGLE_MAPS_KEY})
    if r.status_code != 200:
        raise HTTPException(502, "Geocode API error")
    data = r.json()
    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        raise HTTPException(502, f"Geocode API: {data.get('status')}")
    out = []
    for p in (data.get("results") or [])[:5]:
        loc = p.get("geometry", {}).get("location", {})
        out.append({
            "formatted_address": p.get("formatted_address"),
            "lat": loc.get("lat"),
            "lng": loc.get("lng"),
            "place_id": p.get("place_id"),
        })
    result = {"query": q, "results": out}
    geocode_cache.set(f"gc:{q.lower()}", result)
    return result


@api.get("/directions")
async def directions(origin: str, destination: str, mode: str = "driving"):
    if not GOOGLE_MAPS_KEY:
        raise HTTPException(503, "Google Maps key not configured")
    async with httpx.AsyncClient(timeout=15) as cli:
        r = await cli.get(DIRECTIONS_URL, params={
            "origin": origin, "destination": destination, "mode": mode, "key": GOOGLE_MAPS_KEY,
        })
    if r.status_code != 200:
        raise HTTPException(502, "Directions API error")
    data = r.json()
    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        raise HTTPException(502, f"Directions API: {data.get('status')}")
    return data


# ───────────────────────── Chat Assistant ─────────────────────────
@api.post("/chat")
async def chat_assistant(req: ChatReq, user=Depends(current_user)):
    context = ""
    if req.trip_id:
        trip = await db.trips.find_one({"id": req.trip_id, "user_id": user["id"]}, {"_id": 0})
        if trip:
            context = f"\nUser is planning a trip to {trip['destination']} for {trip['days']} days, budget {trip['currency']} {trip['budget']:.0f}, travel type {trip['travel_type']}, interests {trip['interests']}."

    history = await db.chat_history.find(
        {"user_id": user["id"], "trip_id": req.trip_id},
        {"_id": 0},
    ).sort("timestamp", 1).to_list(20)

    session_id = f"chat-{user['id']}-{req.trip_id or 'global'}"
    chat_system = (
        "You are a friendly, expert travel concierge. Give concise, actionable answers "
        "(2-4 short paragraphs max). Use bullet points where helpful. "
        "When relevant, suggest hidden gems, less crowded times, and budget tips." + context
    )

    # Build a conversation transcript from history for context
    history_str = ""
    if history:
        lines = []
        for h in history[-10:]:
            lines.append(f"User: {h.get('message','')}\nAssistant: {h.get('response','')}")
        history_str = "\n\nConversation so far:\n" + "\n\n".join(lines) + "\n\n"

    user_prompt = f"{history_str}User: {req.message}\nAssistant:"
    resp = await _llm_generate(chat_system, user_prompt, session_id=session_id, expect_json=False)

    entry = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "trip_id": req.trip_id,
        "message": req.message,
        "response": resp,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.chat_history.insert_one(entry)
    entry.pop("_id", None)
    return entry


@api.get("/chat/history")
async def chat_history(trip_id: Optional[str] = None, user=Depends(current_user)):
    q = {"user_id": user["id"]}
    if trip_id:
        q["trip_id"] = trip_id
    cur = db.chat_history.find(q, {"_id": 0}).sort("timestamp", 1)
    return await cur.to_list(200)


@api.delete("/chat/history")
async def clear_chat(trip_id: Optional[str] = None, user=Depends(current_user)):
    q = {"user_id": user["id"]}
    if trip_id:
        q["trip_id"] = trip_id
    await db.chat_history.delete_many(q)
    return {"ok": True}


# ───────────────────────── Favorites ─────────────────────────
@api.post("/favorites")
async def add_favorite(body: FavoriteCreate, user=Depends(current_user)):
    fav = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        **body.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.favorites.insert_one(fav)
    fav.pop("_id", None)
    return fav


@api.get("/favorites")
async def list_favorites(user=Depends(current_user)):
    cur = db.favorites.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cur.to_list(200)


@api.delete("/favorites/{fav_id}")
async def delete_favorite(fav_id: str, user=Depends(current_user)):
    res = await db.favorites.delete_one({"id": fav_id, "user_id": user["id"]})
    return {"deleted": res.deleted_count}


# ───────────────────────── Dashboard ─────────────────────────
@api.get("/dashboard")
async def dashboard(user=Depends(current_user)):
    trips = await db.trips.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    favs = await db.favorites.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    today = datetime.now(timezone.utc).date().isoformat()
    upcoming = [t for t in trips if t.get("start_date") and t["start_date"] >= today]
    past = [t for t in trips if t.get("end_date") and t["end_date"] < today]
    total_budget = sum(t.get("budget", 0) for t in trips)
    return {
        "total_trips": len(trips),
        "upcoming": upcoming[:5],
        "past": past[:5],
        "recent": trips[:5],
        "favorites_count": len(favs),
        "total_budget_planned": total_budget,
    }


# ───────────────────────── Unsplash destination images ─────────────────────────
@api.get("/images/destination")
async def destination_image(q: str, count: int = 5):
    if not UNSPLASH_ACCESS_KEY:
        raise HTTPException(503, "Unsplash key not configured")
    async with httpx.AsyncClient(timeout=15) as cli:
        r = await cli.get(
            "https://api.unsplash.com/search/photos",
            params={"query": f"{q} travel", "per_page": min(count, 30), "orientation": "landscape"},
            headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
        )
    if r.status_code != 200:
        logger.warning("Unsplash %s: %s", r.status_code, r.text[:200])
        raise HTTPException(502, "Unsplash API error")
    data = r.json()
    out = []
    for p in data.get("results", []):
        out.append({
            "id": p.get("id"),
            "url": p["urls"].get("regular"),
            "thumb": p["urls"].get("small"),
            "alt": p.get("alt_description") or q,
            "photographer": p["user"].get("name"),
            "photographer_url": p["user"]["links"].get("html"),
        })
    return {"query": q, "results": out}


# ───────────────────────── Shareable Public Links ─────────────────────────
@api.post("/trips/{trip_id}/share")
async def toggle_share(trip_id: str, user=Depends(current_user)):
    trip = await db.trips.find_one({"id": trip_id, "user_id": user["id"]})
    if not trip:
        raise HTTPException(404, "Trip not found")
    if trip.get("share_id") and trip.get("is_public"):
        await db.trips.update_one({"id": trip_id}, {"$set": {"is_public": False}})
        return {"is_public": False, "share_id": trip["share_id"]}
    share_id = trip.get("share_id") or str(uuid.uuid4())
    await db.trips.update_one(
        {"id": trip_id},
        {"$set": {"share_id": share_id, "is_public": True}},
    )
    return {"is_public": True, "share_id": share_id}


@api.get("/share/{share_id}")
async def get_shared_trip(share_id: str):
    trip = await db.trips.find_one({"share_id": share_id, "is_public": True}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Shared trip not found or no longer public")
    owner = await db.users.find_one({"id": trip["user_id"]}, {"_id": 0, "name": 1})
    trip.pop("user_id", None)
    trip["shared_by"] = owner["name"] if owner else "A traveler"
    return trip


@api.get("/share/{share_id}/meta")
async def get_shared_trip_meta(share_id: str):
    trip = await db.trips.find_one({"share_id": share_id, "is_public": True}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Not found")
    destination = trip.get("destination", "Trip")
    days = trip.get("days", 0)
    summary = (trip.get("itinerary") or {}).get("summary", "")
    description = f"{days}-day itinerary for {destination}. {summary}"[:300] or \
        f"{days}-day AI-generated trip itinerary for {destination}."
    image = "/default-trip-cover.jpg"
    if UNSPLASH_ACCESS_KEY:
        try:
            async with httpx.AsyncClient(timeout=10) as cli:
                r = await cli.get(
                    "https://api.unsplash.com/search/photos",
                    params={"query": f"{destination} travel", "per_page": 1, "orientation": "landscape"},
                    headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
                )
            if r.status_code == 200:
                results = r.json().get("results") or []
                if results:
                    image = results[0]["urls"].get("regular", image)
        except Exception as e:
            logger.warning("Unsplash meta fetch failed: %s", e)
    return {
        "title": f"{destination} Trip Itinerary | Travel Planner AI",
        "description": description,
        "image": image,
        "destination": destination,
        "days": days,
    }


# ───────────────────────── Crawler SSR for share pages ─────────────────────────
from fastapi.responses import HTMLResponse
import html as _html

CRAWLER_UAS = ("facebookexternalhit", "twitterbot", "linkedinbot", "whatsapp",
               "telegrambot", "discordbot", "slackbot", "skypeuripreview",
               "pinterestbot", "redditbot", "googlebot", "bingbot")


@app.get("/share/{share_id}", response_class=HTMLResponse)
async def share_ssr(share_id: str, request: Request) -> HTMLResponse:
    ua = request.headers.get("user-agent", "").lower()
    is_crawler = any(b in ua for b in CRAWLER_UAS)
    if not is_crawler:
        from starlette.responses import RedirectResponse
        return RedirectResponse(url=f"/?share={share_id}", status_code=302)
    try:
        meta = await get_shared_trip_meta(share_id)
    except HTTPException:
        return HTMLResponse("<html><body>Not found</body></html>", status_code=404)
    e = _html.escape
    url = f"{request.url.scheme}://{request.url.netloc}/share/{share_id}"
    return f"""<!doctype html><html lang="en"><head>
<meta charset="utf-8"><title>{e(meta['title'])}</title>
<meta name="description" content="{e(meta['description'])}">
<link rel="canonical" href="{e(url)}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website">
<meta property="og:locale" content="en_US">
<meta property="og:site_name" content="Travel Planner AI">
<meta property="og:title" content="{e(meta['title'])}">
<meta property="og:description" content="{e(meta['description'])}">
<meta property="og:image" content="{e(meta['image'])}">
<meta property="og:url" content="{e(url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(meta['title'])}">
<meta name="twitter:description" content="{e(meta['description'])}">
<meta name="twitter:image" content="{e(meta['image'])}">
</head><body><h1>{e(meta['title'])}</h1><p>{e(meta['description'])}</p>
<img src="{e(meta['image'])}" alt="{e(meta['destination'])}" /></body></html>"""


@api.get("/")
async def root():
    return {"app": "Travel Planner AI", "status": "ok"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def _shutdown():
    client.close()
