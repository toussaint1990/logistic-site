// src/App.js
import React, { useMemo, useState, useEffect } from "react";
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const BRAND = {
  name: "T&S EXPRESS LOGISTICS",
  tagline: "On-time. Every time.",
  phone: "+1 (305) 555-0137",
  email: "hello@ts-logistics.com",
  ctaPrimary: "Get a Quote",
};

const Section = ({ id, title, subtitle, children }) => (
  <section id={id} className="scroll-mt-24 py-16 md:py-24">
    <div className="mx-auto max-w-7xl px-4">
      {title && (
        <div className="mb-10 md:mb-14">
          <h2 className="text-3xl font-semibold md:text-4xl">{title}</h2>
          {subtitle && (
            <p className="mt-3 max-w-2xl text-neutral-600 md:text-lg">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  </section>
);

const Input = (props) => (
  <input
    {...props}
    className={
      "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200 " +
      (props.className || "")
    }
  />
);

function FitBoundsToRoute({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length > 1) {
      map.fitBounds(coords);
    }
  }, [coords, map]);
  return null;
}

function useQuoteEstimate({ distanceMi, weightLbs, urgency, accessories }) {
  return useMemo(() => {
    if (!distanceMi) return null;

    const base = 89;
    const perMile = 3;
    const fuelSurcharge = 0.18;

    const dist = Number(distanceMi || 0);
    const heavySurcharge = weightLbs > 150 ? 45 : 0;
    const rushFee = urgency === "expedited" ? 95 : 0;

    const accessorialsTotal =
      (accessories.inside ? 35 : 0) +
      (accessories.whiteGlove ? 55 : 0) +
      (accessories.afterHours ? 40 : 0);

    const linehaul = base + dist * perMile;
    const subtotal = linehaul + heavySurcharge + rushFee + accessorialsTotal;
    const total = Math.round(subtotal * (1 + fuelSurcharge) * 100) / 100;

    return {
      base,
      perMile,
      fuelSurcharge,
      heavySurcharge,
      rushFee,
      accessorialsTotal,
      dist,
      linehaul,
      subtotal,
      total,
    };
  }, [distanceMi, weightLbs, urgency, accessories]);
}

export default function App() {
  const [quote, setQuote] = useState({
    origin: "Miami, FL",
    destination: "Atlanta, GA",
    distance: 663,
    weight: 120,
    pallets: 2,
    urgency: "expedited",
    pickupDate: "",
    deliveryDate: "",
    accessories: {
      inside: false,
      whiteGlove: false,
      afterHours: false,
    },
    notes: "",
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [routeCoords, setRouteCoords] = useState(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoError, setAutoError] = useState("");

  const [showIntro, setShowIntro] = useState(true);
  const [showHauloverDetails, setShowHauloverDetails] = useState(false);

  const [contact, setContact] = useState({
    name: "",
    email: "",
    company: "",
    message: "",
  });

  const apiKey = process.env.REACT_APP_ORS_API_KEY;

  const estimate = useQuoteEstimate({
    distanceMi: quote.distance,
    weightLbs: Number(quote.weight),
    urgency: quote.urgency,
    accessories: quote.accessories,
  });

  // Intro visible for 5 seconds
  useEffect(() => {
    const t = setTimeout(() => setShowIntro(false), 5000);
    return () => clearTimeout(t);
  }, []);

  const handleAccessoryToggle = (key) => {
    setQuote((q) => ({
      ...q,
      accessories: { ...q.accessories, [key]: !q.accessories[key] },
    }));
  };

  const handleAutoDistance = async () => {
    if (!apiKey) {
      setAutoError("API key missing. Check .env (REACT_APP_ORS_API_KEY).");
      return;
    }

    const qEnc = encodeURIComponent;

    try {
      setAutoLoading(true);
      setAutoError("");

      const [fromRes, toRes] = await Promise.all([
        fetch(
          `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${qEnc(
            quote.origin
          )}&boundary.country=US&size=1`
        ),
        fetch(
          `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${qEnc(
            quote.destination
          )}&boundary.country=US&size=1`
        ),
      ]);

      const fromData = await fromRes.json();
      const toData = await toRes.json();

      if (!fromData.features?.length || !toData.features?.length) {
        setAutoError("No route found. Try a more specific city / state.");
        setRouteCoords(null);
        return;
      }

      const [fromLon, fromLat] = fromData.features[0].geometry.coordinates;
      const [toLon, toLat] = toData.features[0].geometry.coordinates;

      const dirRes = await fetch(
        `https://api.openrouteservice.org/v2/directions/driving-hgv/geojson`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: apiKey,
          },
          body: JSON.stringify({
            coordinates: [
              [fromLon, fromLat],
              [toLon, toLat],
            ],
          }),
        }
      );

      const dirData = await dirRes.json();
      const feature = dirData.features && dirData.features[0];

      if (!feature) {
        setAutoError("No route found. Try a more specific city / state.");
        setRouteCoords(null);
        return;
      }

      const coords = feature.geometry.coordinates || [];
      const segment = feature.properties?.segments?.[0];

      const distanceKm = segment?.distance ? segment.distance / 1000 : 0;
      const distanceMi = distanceKm * 0.621371;

      const leafletCoords = coords.map(([lon, lat]) => [lat, lon]);

      setRouteCoords(leafletCoords);
      setQuote((q) => ({
        ...q,
        distance: Math.round(distanceMi),
      }));
    } catch (err) {
      console.error(err);
      setAutoError("Error talking to routing service. Try again.");
      setRouteCoords(null);
    } finally {
      setAutoLoading(false);
    }
  };

  // Haulover preset + expanded details
  const applyHauloverPreset = () => {
    setAutoError("");
    setRouteCoords(null);
    setQuote((q) => ({
      ...q,
      origin: "Miami, FL (Haulover)",
      destination: "Orlando, FL",
      distance: 235,
      weight: 120,
      pallets: 2,
      urgency: "expedited",
    }));
    setShowHauloverDetails(true);
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    const subject = encodeURIComponent("New load / dispatch inquiry");
    const body = encodeURIComponent(
      `Name: ${contact.name}\nCompany: ${contact.company}\nEmail: ${contact.email}\n\nMessage:\n${contact.message}`
    );
    window.location.href = `mailto:t.s.express.logistic@gmail.com?subject=${subject}&body=${body}`;
  };

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    window.alert(
      "Demo checkout only. Your real payment will be handled by dispatch."
    );
  };

  const reviews = [
    {
      name: "Carlos M.",
      role: "Operations Manager • Miami, FL",
      text: "T&S moved a last-minute hot shot from Miami to Atlanta overnight. Clear communication and live updates the whole way.",
      rating: 5,
    },
    {
      name: "Jennifer L.",
      role: "Logistics Coordinator • Orlando, FL",
      text: "Reliable vans, on-time pickups, and fair pricing. They quickly became our go-to for final-mile in the Southeast.",
      rating: 5,
    },
    {
      name: "Robert S.",
      role: "3PL Partner • Dallas, TX",
      text: "Their dispatch team understands 3PL needs. Good PODs, tracking, and quick responses on every load.",
      rating: 5,
    },
    {
      name: "Michelle K.",
      role: "Retail Distribution • Atlanta, GA",
      text: "White-glove deliveries were handled professionally. Our customers complimented the drivers on their attitude.",
      rating: 5,
    },
    {
      name: "David P.",
      role: "Warehouse Supervisor • Jacksonville, FL",
      text: "We had multiple same-day lanes and they covered every one. No excuses, just results.",
      rating: 5,
    },
    {
      name: "Lisa R.",
      role: "Medical Supplier • Tampa, FL",
      text: "Time-sensitive medical freight arrived exactly when promised. Dispatch kept us informed at each stop.",
      rating: 5,
    },
    {
      name: "Andre G.",
      role: "Freight Broker • Charlotte, NC",
      text: "Honest about capacity and transit times. If they book a load, they deliver it. Simple as that.",
      rating: 5,
    },
  ];

  return (
    <>
      {/* Global custom CSS for animations + modern styling */}
      <style>{`
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
            "Inter", "Segoe UI", sans-serif;
        }

        @keyframes vanDrive {
          0% { transform: translateX(-140%) scale(0.95); opacity: 0; }
          40% { transform: translateX(-10%) scale(1.02); opacity: 1; }
          100% { transform: translateX(0) scale(1); opacity: 1; }
        }
        .van-drive {
          animation: vanDrive 1.8s ease-out forwards;
        }

        @keyframes blinkSign {
          0%, 60%, 100% { opacity: 1; }
          30%, 80% { opacity: 0.25; }
        }
        .blink-sign {
          animation: blinkSign 1.1s infinite;
        }

        @keyframes flagWave {
          0% { transform: perspective(600px) rotateY(0deg) translateY(0); }
          50% { transform: perspective(600px) rotateY(-12deg) translateY(-1px); }
          100% { transform: perspective(600px) rotateY(0deg) translateY(0); }
        }

        /* Modern pill-style waving US flag */
        .flag-wave {
          position: relative;
          overflow: hidden;
          border-radius: 999px;
          background-image: repeating-linear-gradient(
            to bottom,
            #b91c1c 0,
            #b91c1c 12%,
            #ffffff 12%,
            #ffffff 24%
          );
          background-size: 100% 200%;
          box-shadow:
            0 18px 40px rgba(15,23,42,0.45),
            0 0 0 1px rgba(15,23,42,0.55);
          animation: flagWave 2s ease-in-out infinite;
          transform-origin: left center;
        }
        .flag-wave::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          width: 40%;
          height: 52%;
          border-top-left-radius: 999px;
          border-bottom-left-radius: 999px;
          background-color: #111827;
          background-image: radial-gradient(#f9fafb 1px, transparent 1px);
          background-size: 4px 4px;
        }
        .flag-wave::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: radial-gradient(circle at top left, rgba(255,255,255,0.5), transparent 55%);
          mix-blend-mode: screen;
          pointer-events: none;
        }

        .hero-zoom {
          transition: transform 0.5s ease, box-shadow 0.5s ease;
          transform-origin: center;
          position: relative;
          z-index: 1;
        }
        .hero-zoom:hover {
          transform: scale(1.15); /* slightly smaller zoom */
          box-shadow: 0 26px 70px rgba(15,23,42,0.55);
          z-index: 20;
        }

        @keyframes logoZoomIn {
          0% { transform: scale(0.5); opacity: 0; filter: blur(4px); }
          60% { opacity: 1; filter: blur(0); }
          100% { transform: scale(1); opacity: 1; }
        }
        .logo-zoom-in {
          animation: logoZoomIn 1.4s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
          transform-origin: center;
        }

        .glass-panel {
          backdrop-filter: blur(18px);
          background: radial-gradient(circle at top left, rgba(255,255,255,0.95), rgba(246,248,252,0.9));
        }

        .primary-btn {
          background: linear-gradient(135deg, #111827, #020617);
          box-shadow: 0 18px 40px rgba(15,23,42,0.6);
        }
        .primary-btn:hover {
          background: linear-gradient(135deg, #020617, #000000);
          box-shadow: 0 24px 60px rgba(15,23,42,0.8);
          transform: translateY(-1px);
        }

        .outline-pill {
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,0.12);
          background: rgba(255,255,255,0.92);
        }
      `}</style>

      {/* SEO JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: BRAND.name,
            url: "https://www.ts-logistics.com/",
            image: process.env.PUBLIC_URL + "/og-cover.jpg",
            telephone: "+13055550137",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Miami",
              addressRegion: "FL",
              postalCode: "33101",
              addressCountry: "US",
            },
          }),
        }}
      />

      <div className="min-h-screen bg-gradient-to-b from-[#dbeafe] via-[#e5f2ff] to-[#f9fafb]">
        {/* INTRO OVERLAY */}
        {showIntro && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-gradient-to-br from-neutral-900 via-black to-slate-900">
            <div className="mx-6 flex max-w-xl flex-col items-center gap-6 text-center text-white">
              <img
                src={process.env.PUBLIC_URL + "/logo.png"}
                alt="Toussaint & Santana Logistics"
                className="logo-zoom-in h-48 w-auto rounded-3xl bg-white/95 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.75)]"
              />
              <p className="text-xs uppercase tracking-[0.28em] text-neutral-300">
                Toussaint &amp; Santana Logistics
              </p>
              <p className="text-xl font-semibold md:text-2xl">
                Coast-to-coast cargo van &amp; final-mile coverage
              </p>
              <div className="mt-2 w-full overflow-hidden rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="van-drive flex items-center gap-4">
                  <img
                    src={process.env.PUBLIC_URL + "/hero.jpg"}
                    alt="Sprinter van driving"
                    className="h-32 w-64 rounded-2xl object-cover shadow-[0_16px_40px_rgba(0,0,0,0.7)]"
                  />
                  <div className="text-left text-sm md:text-base">
                    <p className="font-semibold">
                      Sprinter &amp; cargo van fleet
                    </p>
                    <p className="text-neutral-300">
                      Expedited • Dedicated lanes • White-glove delivery
                    </p>
                  </div>
                </div>
              </div>

              {/* Bigger horizontal American flag */}
              <div className="mt-4 flex justify-center">
                <div className="flag-wave h-20 w-48" />
              </div>

              <p className="text-xs text-neutral-400 tracking-wide">
                Loading dispatch board…
              </p>
            </div>
          </div>
        )}

        {/* HEADER */}
        <header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 shadow-sm backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
            {/* Left: brand */}
            <div className="flex items-center gap-3">
              <img
                src={process.env.PUBLIC_URL + "/logo.png"}
                alt={BRAND.name}
                className="h-14 w-auto rounded-2xl shadow-md md:h-16"
              />
              <div className="leading-tight">
                <p className="text-sm font-semibold md:text-base">
                  Toussaint &amp; Santana Logistics
                </p>
                <p className="text-[11px] text-neutral-500">
                  {BRAND.tagline}
                </p>
              </div>
            </div>

            {/* Middle: stylish waving flag in navbar (desktop only) */}
            <div className="hidden flex-1 justify-center md:flex">
              <div className="flag-wave h-7 w-16" />
            </div>

            {/* Right: nav links */}
            <div className="hidden items-center gap-4 md:flex">
              {[
                ["Services", "#services"],
                ["Reviews", "#reviews"],
                ["Coverage", "#coverage"],
                ["Get a Quote", "#quote"],
                ["Checkout", "#checkout"],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  className="text-sm text-neutral-700 transition-colors hover:text-black"
                >
                  {label}
                </a>
              ))}
              <a
                href="#contact"
                className="primary-btn rounded-full px-5 py-2 text-sm font-medium text-white transition-transform"
              >
                Contact
              </a>
            </div>

            {/* Mobile menu button */}
            <button
              type="button"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white/90 px-3 py-2 shadow-sm md:hidden"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  d="M4 7h16M4 12h16M4 17h16"
                />
              </svg>
            </button>
          </div>

          {/* Mobile nav */}
          <div
            id="mobile-nav"
            className={[
              "md:hidden overflow-hidden border-t border-neutral-200 bg-white/95",
              "transition-all duration-500",
              menuOpen ? "max-h-72 opacity-100" : "max-h-0 opacity-0",
            ].join(" ")}
          >
            <nav className="flex flex-col gap-2 p-4 text-sm">
              {[
                ["Home", "#home"],
                ["Services", "#services"],
                ["Reviews", "#reviews"],
                ["Coverage", "#coverage"],
                ["Get a Quote", "#quote"],
                ["Checkout", "#checkout"],
                ["Contact", "#contact"],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-2 py-2 hover:bg-neutral-50"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </header>

        <main>
          {/* HERO */}
          <section
            id="home"
            className="border-b border-white/60 py-16 md:py-24"
            style={{
              backgroundImage:
                "radial-gradient(circle at top left, #ffffff 0, #E4F1FF 45%, #D0E6FF 100%)",
            }}
          >
            <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 md:grid-cols-2">
              {/* LEFT: TEXT / CTA */}
              <div className="glass-panel rounded-3xl p-8 shadow-[0_18px_55px_rgba(15,23,42,0.18)]">
                <div className="mb-4 inline-flex items-center gap-3 outline-pill px-5 py-2 text-xs font-medium text-emerald-900 shadow-sm md:text-sm">
                  <span className="blink-sign inline-flex h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.35)]" />
                  <span className="uppercase tracking-wide">
                    Book today – open to take new loads
                  </span>
                </div>
                <h1 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
                  Coast-to-coast coverage{" "}
                  <br className="hidden md:block" />
                  for cargo vans &amp; final-mile
                </h1>
                <p className="mt-4 text-sm leading-relaxed text-neutral-700 md:text-base">
                  Expedited hot shots, dedicated lanes, and white-glove final
                  mile — powered by a vetted nationwide Sprinter and cargo van
                  network.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href="#quote"
                    className="primary-btn rounded-full px-6 py-2.5 text-sm font-medium text-white transition-transform"
                  >
                    {BRAND.ctaPrimary}
                  </a>
                  <a
                    href="#contact"
                    className="outline-pill px-6 py-2.5 text-sm font-medium text-neutral-900 hover:bg-white"
                  >
                    Talk to Dispatch
                  </a>
                </div>
              </div>

              {/* RIGHT: HERO IMAGE WITH HOVER ZOOM */}
              <div>
                <div className="hero-zoom overflow-visible rounded-3xl border border-white/60 bg-neutral-900/90 shadow-[0_20px_55px_rgba(15,23,42,0.5)]">
                  <img
                    src={process.env.PUBLIC_URL + "/hero.jpg"}
                    alt="Sprinter cargo van on the road"
                    className="h-full w-full max-h-[300px] rounded-3xl object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-tr from-black/40 via-transparent to-transparent" />
                </div>

                {/* Stats moved under hero image */}
                <div className="mt-4 flex flex-wrap gap-3 text-xs md:text-sm">
                  {[
                    ["300+", "Partner Drivers"],
                    ["48", "States Covered"],
                    ["3–5h", "Avg Response ETA"],
                  ].map(([value, label]) => (
                    <div
                      key={label}
                      className="outline-pill px-4 py-2 shadow-sm transition-transform duration-300 hover:scale-105"
                    >
                      <p className="text-base font-semibold md:text-lg">
                        {value}
                      </p>
                      <p className="text-[11px] uppercase tracking-wide text-neutral-600">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* SERVICES */}
          <Section
            id="services"
            title="Services"
            subtitle="Expedited freight • Dedicated routes • Scheduled runs • White-glove delivery."
          >
            <div className="grid gap-5 md:grid-cols-3">
              {[
                {
                  title: "Expedited / Hot Shot",
                  text: "Time-critical cargo van moves with 24/7 dispatch and live tracking updates.",
                },
                {
                  title: "Dedicated Lanes",
                  text: "Recurring lanes, drop trailers, and route coverage for regional and national programs.",
                },
                {
                  title: "White-Glove",
                  text: "Inside delivery, room-of-choice, and POD visibility with professional driver teams.",
                },
              ].map((s) => (
                <div
                  key={s.title}
                  className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition-transform duration-300 hover:-translate-y-1 hover:scale-105"
                >
                  <p className="text-lg font-semibold text-slate-900">
                    {s.title}
                  </p>
                  <p className="mt-2 text-sm text-neutral-700">{s.text}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* REVIEWS */}
          <Section
            id="reviews"
            title="Feedback from Partners"
            subtitle="Shippers, brokers, and distribution teams that trust T&S Express Logistics."
          >
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r) => (
                <article
                  key={r.name}
                  className="flex h-full flex-col rounded-3xl border border-white/70 bg-white/90 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition-transform duration-300 hover:-translate-y-1 hover:scale-105"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                      {r.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {r.name}
                      </p>
                      <p className="text-xs text-neutral-500">{r.role}</p>
                    </div>
                  </div>

                  <p className="flex-1 text-sm text-neutral-700">{r.text}</p>

                  <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
                    <div className="flex items-center gap-1 text-amber-500">
                      {Array.from({ length: r.rating }).map((_, i) => (
                        <span key={i} aria-hidden="true">
                          ★
                        </span>
                      ))}
                    </div>
                    <span>Verified partner</span>
                  </div>
                </article>
              ))}
            </div>
          </Section>

          {/* COVERAGE */}
          <Section
            id="coverage"
            title="Coverage"
            subtitle="Headquartered in Miami—serving all 50 states with a focus on major cargo hubs."
          >
            <div className="rounded-3xl border border-white/70 bg-white/95 p-6 text-neutral-700 shadow-[0_18px_50px_rgba(15,23,42,0.12)] transition-transform duration-300 hover:-translate-y-1 hover:scale-105">
              <p className="mb-4 text-sm">
                Reliable capacity across the entire U.S. — from local final-mile
                in Florida to cross-country Sprinter moves.
              </p>

              <div className="grid gap-6 text-sm md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Southeast
                  </p>
                  <p className="mb-2">
                    FL, GA, AL, SC, NC, TN, MS, LA, AR, KY, WV
                  </p>
                  <p className="text-xs text-neutral-500">
                    Key: Miami, Orlando, Tampa, Jacksonville, Atlanta,
                    Charlotte, Nashville, New Orleans.
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Northeast
                  </p>
                  <p className="mb-2">
                    NY, NJ, PA, MA, CT, RI, NH, VT, ME, MD, DE, DC
                  </p>
                  <p className="text-xs text-neutral-500">
                    Key: New York, Newark, Philadelphia, Boston, Baltimore,
                    Washington D.C.
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Midwest
                  </p>
                  <p className="mb-2">
                    IL, OH, MI, IN, WI, MN, IA, MO, KS, NE, SD, ND
                  </p>
                  <p className="text-xs text-neutral-500">
                    Key: Chicago, Detroit, Columbus, Cincinnati, St. Louis,
                    Minneapolis, Kansas City.
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    South / Central
                  </p>
                  <p className="mb-2">
                    TX, OK, NM, CO, AZ (southern corridor)
                  </p>
                  <p className="text-xs text-neutral-500">
                    Key: Dallas, Fort Worth, Houston, San Antonio, Austin, El
                    Paso, Denver, Phoenix.
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    West
                  </p>
                  <p className="mb-2">
                    CA, WA, OR, NV, UT, ID, MT, WY
                  </p>
                  <p className="text-xs text-neutral-500">
                    Key: Los Angeles, Long Beach, Oakland, San Diego, Seattle,
                    Portland, Salt Lake City, Las Vegas.
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Alaska (partner network)
                  </p>
                  <p className="mb-2">AK</p>
                  <p className="text-xs text-neutral-500">
                    Key: Anchorage, Fairbanks.
                  </p>
                </div>
              </div>
            </div>
          </Section>

          {/* INSTANT QUOTE + MAP */}
          <Section
            id="quote"
            title="Instant Estimate"
            subtitle="Use this tool for a quick ballpark quote. Final rates are confirmed by dispatch based on live capacity."
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)]">
              {/* LEFT: FORM */}
              <div className="space-y-6 rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
                <h3 className="text-lg font-semibold text-slate-900">
                  Lane Details
                </h3>

                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    placeholder="Origin (City, ST)"
                    value={quote.origin}
                    onChange={(e) =>
                      setQuote((q) => ({ ...q, origin: e.target.value }))
                    }
                    aria-label="Origin"
                  />
                  <Input
                    placeholder="Destination (City, ST)"
                    value={quote.destination}
                    onChange={(e) =>
                      setQuote((q) => ({ ...q, destination: e.target.value }))
                    }
                    aria-label="Destination"
                  />
                </div>

                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAutoDistance}
                      disabled={autoLoading}
                      className="primary-btn rounded-full px-5 py-2 text-[11px] font-medium text-white disabled:opacity-60"
                    >
                      {autoLoading ? "Calculating..." : "Use Auto Distance"}
                    </button>
                    <span className="text-xs text-neutral-500">
                      or enter distance manually below if you already know it.
                    </span>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={applyHauloverPreset}
                      className="mt-1 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 text-[11px] font-medium text-neutral-800 hover:bg-white"
                    >
                      Haulover Express preset (Miami ⇢ Orlando)
                    </button>
                  </div>
                  {showHauloverDetails && (
                    <div className="mt-2 rounded-2xl bg-neutral-50 px-4 py-3 text-[11px] text-neutral-700">
                      <p className="font-semibold text-neutral-900">
                        Haulover Express lane expanded
                      </p>
                      <p>
                        Origin: Miami, FL (Haulover) → Destination: Orlando,
                        FL. Approx. 235 miles, expedited Sprinter / cargo van
                        service with 2 pallets, 120 lbs default. Adjust any
                        field as needed.
                      </p>
                    </div>
                  )}
                  {autoError && (
                    <p className="mt-1 text-xs font-medium text-red-500">
                      {autoError}
                    </p>
                  )}
                </div>

                {/* Distance / weight / pallets */}
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Distance (mi)
                    </label>
                    <Input
                      type="number"
                      placeholder="Distance (mi)"
                      value={quote.distance}
                      onChange={(e) =>
                        setQuote((q) => ({ ...q, distance: e.target.value }))
                      }
                      aria-label="Distance (miles)"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Weight (lbs)
                    </label>
                    <Input
                      type="number"
                      placeholder="Weight (lbs)"
                      value={quote.weight}
                      onChange={(e) =>
                        setQuote((q) => ({ ...q, weight: e.target.value }))
                      }
                      aria-label="Weight (lbs)"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                      # of Pallets
                    </label>
                    <Input
                      type="number"
                      placeholder="# of Pallets"
                      value={quote.pallets}
                      onChange={(e) =>
                        setQuote((q) => ({ ...q, pallets: e.target.value }))
                      }
                      aria-label="Number of pallets"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Urgency
                    </label>
                    <select
                      className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
                      value={quote.urgency}
                      onChange={(e) =>
                        setQuote((q) => ({ ...q, urgency: e.target.value }))
                      }
                    >
                      <option value="standard">Standard</option>
                      <option value="expedited">Expedited / Hot Shot</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Pickup Date
                    </label>
                    <Input
                      type="date"
                      value={quote.pickupDate}
                      onChange={(e) =>
                        setQuote((q) => ({ ...q, pickupDate: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Delivery Date
                    </label>
                    <Input
                      type="date"
                      value={quote.deliveryDate}
                      onChange={(e) =>
                        setQuote((q) => ({
                          ...q,
                          deliveryDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Accessorials
                  </p>
                  <div className="flex flex-wrap gap-5 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={quote.accessories.inside}
                        onChange={() => handleAccessoryToggle("inside")}
                      />
                      Inside Delivery
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={quote.accessories.whiteGlove}
                        onChange={() => handleAccessoryToggle("whiteGlove")}
                      />
                      White Glove / Room of Choice
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={quote.accessories.afterHours}
                        onChange={() => handleAccessoryToggle("afterHours")}
                      />
                      After-Hours / Weekend
                    </label>
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Notes for Dispatch
                  </p>
                  <textarea
                    rows={3}
                    className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
                    placeholder="Dock hours, reference numbers, special handling, etc."
                    value={quote.notes}
                    onChange={(e) =>
                      setQuote((q) => ({ ...q, notes: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* RIGHT: PRICING + MAP */}
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Pricing Snapshot
                  </h3>
                  {estimate ? (
                    <>
                      <p className="mt-3 text-sm text-neutral-700">
                        <span className="font-medium">Base:</span> $
                        {estimate.base}
                        <br />
                        <span className="font-medium">Distance:</span>{" "}
                        {estimate.dist} mi × ${estimate.perMile}/mi
                        <br />
                        <span className="font-medium">Fuel Surcharge:</span>{" "}
                        {Math.round(estimate.fuelSurcharge * 100)}%
                      </p>
                      <p className="mt-3 text-xs text-neutral-500">
                        Non-binding estimate. Final rate confirmed by dispatch
                        based on live capacity and exact requirements.
                      </p>
                      <hr className="my-4" />
                      <p className="text-lg font-semibold text-slate-900">
                        Estimated Total: ${estimate.total.toFixed(2)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-neutral-600">
                      Enter lane details to see an estimate.
                    </p>
                  )}
                </div>

                {/* Map (only render after intro so it never overlaps) */}
                <div className="overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.12)] transition-transform duration-300 hover:-translate-y-1 hover:scale-105">
                  <div className="h-64 w-full">
                    {!showIntro && (
                      <MapContainer
                        center={[27, -83]}
                        zoom={5}
                        scrollWheelZoom={false}
                        attributionControl={false}
                        className="h-full w-full"
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        {routeCoords && (
                          <>
                            <FitBoundsToRoute coords={routeCoords} />
                            <Polyline positions={routeCoords} />
                          </>
                        )}
                      </MapContainer>
                    )}
                  </div>
                  <p className="px-3 pb-2 text-[10px] text-neutral-500">
                    Map data © OpenStreetMap contributors
                  </p>
                </div>
              </div>
            </div>
          </Section>

          {/* CHECKOUT SECTION WITH PAYMENT UI */}
          <Section
            id="checkout"
            title="Checkout"
            subtitle="Review your lane estimate and stage payment details before confirming with dispatch."
          >
            <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)]">
              {/* Summary */}
              <div className="rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
                {estimate ? (
                  <>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Lane Summary
                    </h3>
                    <p className="mt-2 text-sm text-neutral-700">
                      <span className="font-medium">From:</span> {quote.origin}
                      <br />
                      <span className="font-medium">To:</span>{" "}
                      {quote.destination}
                      <br />
                      <span className="font-medium">Distance:</span>{" "}
                      {estimate.dist} mi ·{" "}
                      <span className="font-medium">Weight:</span>{" "}
                      {quote.weight} lbs ·{" "}
                      <span className="font-medium">Pallets:</span>{" "}
                      {quote.pallets}
                      <br />
                      <span className="font-medium">Urgency:</span>{" "}
                      {quote.urgency === "expedited"
                        ? "Expedited / Hot Shot"
                        : "Standard"}
                    </p>

                    <hr className="my-4" />

                    <h4 className="text-sm font-semibold text-slate-900">
                      Price breakdown
                    </h4>
                    <div className="mt-2 space-y-1 text-sm text-neutral-700">
                      <div className="flex justify-between">
                        <span>Linehaul (base + miles)</span>
                        <span>${estimate.linehaul.toFixed(2)}</span>
                      </div>
                      {estimate.heavySurcharge > 0 && (
                        <div className="flex justify-between">
                          <span>Heavy freight surcharge</span>
                          <span>${estimate.heavySurcharge.toFixed(2)}</span>
                        </div>
                      )}
                      {estimate.rushFee > 0 && (
                        <div className="flex justify-between">
                          <span>Expedited / rush fee</span>
                          <span>${estimate.rushFee.toFixed(2)}</span>
                        </div>
                      )}
                      {estimate.accessorialsTotal > 0 && (
                        <div className="flex justify-between">
                          <span>Accessorials</span>
                          <span>${estimate.accessorialsTotal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Subtotal (before fuel)</span>
                        <span>${estimate.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-neutral-500">
                        <span>Fuel surcharge ({Math.round(
                          estimate.fuelSurcharge * 100
                        )}
                        %)</span>
                        <span>Included in total</span>
                      </div>
                      <hr className="my-3" />
                      <div className="flex items-center justify-between text-base font-semibold text-slate-900">
                        <span>Estimated total</span>
                        <span>${estimate.total.toFixed(2)}</span>
                      </div>
                    </div>

                    <p className="mt-4 text-xs text-neutral-500">
                      This checkout is for planning only. Final confirmed rate
                      and live payment link are sent directly by dispatch.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-neutral-700">
                    Start by entering your lane details in the{" "}
                    <a href="#quote" className="font-medium underline">
                      Instant Estimate
                    </a>{" "}
                    section. Your estimate and checkout breakdown will appear
                    here.
                  </p>
                )}
              </div>

              {/* Payment UI (front-end only) */}
              <form
                onSubmit={handlePaymentSubmit}
                className="rounded-3xl border border-white/70 bg-slate-900 text-slate-50 shadow-[0_18px_60px_rgba(15,23,42,0.6)]"
              >
                <div className="border-b border-white/10 px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                    Secure payment staging
                  </p>
                  <p className="mt-1 text-sm text-slate-200">
                    Enter card details so dispatch can generate a secure
                    payment link.
                  </p>
                </div>

                <div className="space-y-4 px-6 py-5 text-sm">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-600 bg-slate-950/40 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
                      placeholder="As shown on card"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">
                      Card Number
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={19}
                      className="w-full rounded-xl border border-slate-600 bg-slate-950/40 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
                      placeholder="4111 1111 1111 1111"
                      required
                    />
                  </div>
                  <div className="grid gap-3 grid-cols-[1.1fr_1fr_1.1fr]">
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">
                        Expiry
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={5}
                        className="w-full rounded-xl border border-slate-600 bg-slate-950/40 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
                        placeholder="MM/YY"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">
                        CVC
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        className="w-full rounded-xl border border-slate-600 bg-slate-950/40 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
                        placeholder="123"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">
                        ZIP / Postal
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-slate-600 bg-slate-950/40 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
                        placeholder="33101"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-300">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-slate-950">
                      ✓
                    </span>
                    Card data is for demo only — final payment is processed via
                    a secure link from dispatch.
                  </div>

                  <button
                    type="submit"
                    className="mt-2 w-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_18px_45px_rgba(16,185,129,0.7)] transition-transform hover:-translate-y-[1px]"
                  >
                    Stage Secure Checkout
                  </button>
                </div>
              </form>
            </div>
          </Section>

          {/* CONTACT – ONLY FORM */}
          <Section id="contact" title="Contact Dispatch">
            <form
              onSubmit={handleContactSubmit}
              className="mx-auto max-w-3xl space-y-4 rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.12)]"
            >
              <h3 className="text-lg font-semibold text-slate-900">
                Send load details
              </h3>
              <p className="text-sm text-neutral-600">
                Share your lane, pickup window, and any special handling. Our
                dispatch team will reach back out as soon as possible.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Your name"
                  value={contact.name}
                  onChange={(e) =>
                    setContact((c) => ({ ...c, name: e.target.value }))
                  }
                  required
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={contact.email}
                  onChange={(e) =>
                    setContact((c) => ({ ...c, email: e.target.value }))
                  }
                  required
                />
              </div>
              <Input
                placeholder="Company (optional)"
                value={contact.company}
                onChange={(e) =>
                  setContact((c) => ({ ...c, company: e.target.value }))
                }
              />
              <textarea
                rows={4}
                className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
                placeholder="Example: Sprinter load from Miami, FL to Atlanta, GA. Pickup today before 3pm, 2 pallets, 1,200 lbs, inside delivery."
                value={contact.message}
                onChange={(e) =>
                  setContact((c) => ({ ...c, message: e.target.value }))
                }
                required
              />
              <button
                type="submit"
                className="primary-btn w-full rounded-full px-5 py-3 text-sm font-medium text-white"
              >
                Submit to Dispatch
              </button>
              <p className="text-[11px] text-neutral-500">
                Your details will open in your email app so you can send them
                directly to dispatch.
              </p>
            </form>
          </Section>

          <footer className="border-t border-white/70 bg-[#E9F5FF] py-8 text-center text-sm text-neutral-600">
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </footer>
        </main>
      </div>
    </>
  );
}
