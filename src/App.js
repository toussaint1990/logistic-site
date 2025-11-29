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
      "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-800 focus:ring-2 focus:ring-neutral-200 " +
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
    const perMile = 3; // $3 /mi
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

  const apiKey = process.env.REACT_APP_ORS_API_KEY;

  const estimate = useQuoteEstimate({
    distanceMi: quote.distance,
    weightLbs: Number(quote.weight),
    urgency: quote.urgency,
    accessories: quote.accessories,
  });

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

  return (
    <>
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

      <div className="min-h-screen bg-[#E9F5FF]">
        {/* HEADER */}
        <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <img
                src={process.env.PUBLIC_URL + "/logo.png"}
                alt={BRAND.name}
                className="h-16 w-auto rounded-xl shadow-sm md:h-20"
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

            <div className="hidden items-center gap-4 md:flex">
              <a
                href="#services"
                className="text-sm text-neutral-700 hover:text-black"
              >
                Services
              </a>
              <a
                href="#coverage"
                className="text-sm text-neutral-700 hover:text-black"
              >
                Coverage
              </a>
              <a
                href="#quote"
                className="rounded-xl border px-4 py-2 text-sm hover:bg-neutral-50"
              >
                Get a Quote
              </a>
              <a
                href="#contact"
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-black"
              >
                Contact
              </a>
            </div>

            <button
              type="button"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center justify-center rounded-xl border px-3 py-2 md:hidden"
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

          <div
            id="mobile-nav"
            className={[
              "md:hidden overflow-hidden border-t bg-white/95",
              "transition-all duration-500",
              menuOpen ? "max-h-48 opacity-100" : "max-h-0 opacity-0",
            ].join(" ")}
          >
            <nav className="flex flex-col gap-2 p-4 text-sm">
              {[
                ["Home", "#home"],
                ["Services", "#services"],
                ["Coverage", "#coverage"],
                ["Get a Quote", "#quote"],
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
            className="border-b py-16 md:py-24"
            style={{
              backgroundImage:
                "radial-gradient(circle at top left, #ffffff 0, #E9F5FF 45%, #D7ECFF 100%)",
            }}
          >
            <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 md:grid-cols-2">
              <div className="rounded-2xl bg-white/80 p-8 shadow-sm backdrop-blur">
                <h1 className="text-4xl font-semibold md:text-5xl">
                  Coast-to-coast coverage{" "}
                  <br className="hidden md:block" />
                  for cargo vans &amp; final-mile
                </h1>
                <p className="mt-4 text-neutral-700">
                  We move freight fast and safely. Expedited loads, dedicated
                  lanes, white-glove delivery, and nationwide partner capacity.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href="#quote"
                    className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-black"
                  >
                    {BRAND.ctaPrimary}
                  </a>
                  <a
                    href="#contact"
                    className="rounded-xl border px-5 py-2.5 text-sm font-medium hover:bg-neutral-50"
                  >
                    Talk to Dispatch
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl border bg-white/80 p-5 shadow-sm">
                  <p className="text-3xl font-semibold">300+</p>
                  <p className="text-sm opacity-90">Partner Drivers</p>
                </div>
                <div className="rounded-2xl border bg-white/80 p-5 shadow-sm">
                  <p className="text-3xl font-semibold">48</p>
                  <p className="text-sm opacity-90">States Covered</p>
                </div>
                <div className="rounded-2xl border bg-white/80 p-5 shadow-sm">
                  <p className="text-3xl font-semibold">3–5h</p>
                  <p className="text-sm opacity-90">Avg ETA</p>
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
                  text: "Time-critical cargo van moves with 24/7 dispatch.",
                },
                {
                  title: "Dedicated Lanes",
                  text: "Recurring lanes, drop trailers, and route coverage.",
                },
                {
                  title: "White-Glove",
                  text: "Inside delivery, room-of-choice, and POD visibility.",
                },
              ].map((s) => (
                <div
                  key={s.title}
                  className="rounded-2xl border bg-white p-6 shadow-sm"
                >
                  <p className="text-lg font-semibold">{s.title}</p>
                  <p className="mt-2 text-neutral-700">{s.text}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* COVERAGE */}
          <Section
            id="coverage"
            title="Coverage"
            subtitle="Headquartered in Miami—serving the Southeast and nationwide partner network."
          >
            <div className="rounded-2xl border bg-white p-6 text-neutral-700 shadow-sm">
              Reliable capacity across FL, GA, AL, SC, NC, TN, TX and beyond,
              with vetted partner vans coast-to-coast.
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
              <div className="space-y-6 rounded-2xl border bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Lane Details</h3>

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

                <div>
                  <button
                    type="button"
                    onClick={handleAutoDistance}
                    disabled={autoLoading}
                    className="rounded-full bg-neutral-900 px-5 py-2 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
                  >
                    {autoLoading ? "Calculating..." : "Use Auto Distance"}
                  </button>
                  <span className="ml-3 text-xs text-neutral-500">
                    or enter distance manually below if you already know it.
                  </span>
                  {autoError && (
                    <p className="mt-2 text-xs font-medium text-red-500">
                      {autoError}
                    </p>
                  )}
                </div>

                {/* Labeled distance / weight / pallets */}
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
                      className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-800 focus:ring-2 focus:ring-neutral-200"
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
                    className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-800 focus:ring-2 focus:ring-neutral-200"
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
                <div className="rounded-2xl border bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-semibold">Pricing Snapshot</h3>
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
                        This is a non-binding estimate. Rates can change based
                        on live capacity and exact requirements.
                      </p>
                      <hr className="my-4" />
                      <p className="text-lg font-semibold">
                        Estimated Total: ${estimate.total.toFixed(2)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-neutral-600">
                      Enter lane details to see an estimate.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                  <div className="h-64 w-full">
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
                  </div>
                  {/* Plain-text attribution, no icon */}
                  <p className="px-3 pb-2 text-[10px] text-neutral-500">
                    Map data © OpenStreetMap contributors
                  </p>
                </div>
              </div>
            </div>
          </Section>

          {/* CONTACT */}
          <Section id="contact" title="Contact Dispatch">
            <div className="rounded-2xl border bg-white p-6 text-neutral-700 shadow-sm">
              <p>
                Email us at{" "}
                <a
                  href={`mailto:${BRAND.email}`}
                  className="font-medium text-neutral-900 underline"
                >
                  {BRAND.email}
                </a>{" "}
                or call{" "}
                <span className="font-medium">{BRAND.phone}</span> to book a
                lane or request carrier setup.
              </p>
            </div>
          </Section>

          <footer className="border-t bg-[#E9F5FF] py-8 text-center text-sm text-neutral-600">
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </footer>
        </main>
      </div>
    </>
  );
}
