import { Helmet } from "react-helmet-async";

const SITE = process.env.REACT_APP_BACKEND_URL || "";
const FALLBACK_IMG = "/default-trip-cover.jpg";

export default function ShareMeta({ destination, days, image, summary, shareId }) {
  if (!destination) return null;
  const title = `${destination} Trip Itinerary | Travel Planner AI`;
  const description = (summary || `${days}-day AI-generated itinerary for ${destination}. Explore attractions, restaurants, and activities planned with AI.`).slice(0, 280);
  const url = `${SITE}/share/${shareId}`;
  const img = image || FALLBACK_IMG;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta name="robots" content="index,follow" />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="en_US" />
      <meta property="og:site_name" content="Travel Planner AI" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={img} />
      <meta property="og:url" content={url} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={img} />
    </Helmet>
  );
}
