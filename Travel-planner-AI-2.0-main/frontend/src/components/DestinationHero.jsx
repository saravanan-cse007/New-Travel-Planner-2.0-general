import { useEffect, useState } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Renders a real Unsplash photo of `query` as a backdrop, with required
 * photographer attribution (per Unsplash API guidelines).
 */
export default function DestinationHero({ query, height = "h-56", overlay = true, children }) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    if (!query) return;
    axios.get(`${API}/images/destination`, { params: { q: query, count: 1 } })
      .then((r) => setImg(r.data.results[0] || null))
      .catch(() => setImg(null));
  }, [query]);

  return (
    <div className={`relative ${height} rounded-2xl overflow-hidden glass`} data-testid="destination-hero">
      {img && (
        <img
          src={img.url}
          alt={img.alt}
          className="absolute inset-0 w-full h-full object-cover opacity-80"
          loading="lazy"
        />
      )}
      {overlay && <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0F] via-[#0B0B0F]/60 to-transparent" />}
      {children}
      {img && (
        <a
          href={`${img.photographer_url}?utm_source=travel_planner_ai&utm_medium=referral`}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-2 right-3 text-[10px] text-white/50 hover:text-white/80 font-mono-acc tracking-wider"
        >
          Photo by {img.photographer} on Unsplash
        </a>
      )}
    </div>
  );
}
