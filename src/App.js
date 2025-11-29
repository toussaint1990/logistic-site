// src/App.js
import React, { useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const BRAND = {
  name: "T&S Express Logistics",
  tagline: "On-time. Every time.",
  phone: "+1 (305) 555-0137",
  email: "dispatch@ts-express.com",
  ctaPrimary: "Get a Quote",
};

const Section = ({ id, title, eyebrow, subtitle, children }) => (
  <section id={id} className="scroll-mt-24 py-16 md:py-24">
    <div className="mx-auto max-w-7xl px-4">
      {(title || subtitle || eyebrow) && (
        <div className="mb-8 md:mb-10">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
              {eyebrow}
            </p>
          )}
          {title && (
            <h2 className="mt-2 text-3xl font-semibold md:text-4xl">{title}</h2>
          )}
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
      "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none " +
      "focus:border-sky-600 focus:ring-2 focus:ring-sky-100 " +
      (props.className || "")
    }
  />
);

const Checkbox = ({ label, ...rest }) => (
  <label className="flex items-center gap-2 text-sm text-neutral-700">
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
      {...rest}
    />
    <span>{label}</span>
  </label>
);

function useQuoteEstimate(quote) {
  return useMemo(() => {
    const base = 89;
    const perMile = 3; // $3/mi as requested
    const fuelSurcharge = 0.18; // 18%

    const distanceMi = Number(quote.distance || 0);
    const weightLbs = Number(quote.weight || 0);
    const stops = Number(quote.stops || 0);

    const heavySurcharge = weightLbs > 150 ? 55 : 0;
    const stopFee = stops > 0 ? stops * 40 : 0;

    let urgencyMultiplier = 1;
    if (quote.urgency === "expedited") urgencyMultiplier = 1.25;
    if (quote.urgency === "overnight") urgencyMultiplier = 1.5;

    let accessorials = 0;
    if (quote.insideDelivery) accessorials += 45;
    if (quote.whiteGlove) accessorials += 85;
    if (quote.weekend) accessorials += 60;

    const mileage = distanceMi * perMile;
    const subtotal =
      (base + mileage + heavySurcharge + stopFee + accessorials) *
      urgencyMultiplier;

    const fuel = subtotal * fuelSurcharge;
    const total = Math.round((subtotal + fuel) * 100) / 100;

    return {
      base,
      perMile,
      fuelSurcharge,
      heavySurcharge,
      stopFee,
      mileage,
      accessorials,
      subtotal,
      fuel,
      total,
      distanceMi,
    };
  }, [quote]);
}

// --- OpenRouteService helpers ---

async function geocodePlace(text, apiKey) {
  const url =
    "https://api.openrouteservice.org/geocode/search" +
    "?api_key=" +
    apiKey +
    "&text=" +
    encodeURIComponent(text) +
    "&boundary.country=USA" + // correct 3-letter country code
    "&size=1";

  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocode failed");
  const data = await res.json();
  const feat = data.features?.[0];
  if (!feat) throw new Error("No result");
  const [lng, lat] = feat.geometry.coordinates;
  return { lat, lng };
}

async function getRoute(originText, destText, apiKey) {
  const from = await geocodePlace(originText, apiKey);
  const to = await geocodePlace(destText, apiKey);

  const res = await fetch(
    "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        coordinates: [
          [from.lng, from.lat],
          [to.lng, to.lat],
        ],
      }),
    }
  );

  if (!res.ok) throw new Error("Directions failed");
  const data = await res.json();
  const feat = data.features?.[0];
  if (!feat) throw new Error("No route geometry");

  const meters = feat.properties?.summary?.distance ?? 0;
  const km = meters / 1000;
  const miles = km * 0.621371;

  const coords = feat.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

  return {
    distanceMiles: Math.round(miles),
    coords,
    midpoint: coords[Math.floor(coords.length / 2)] ?? [from.lat, from.lng],
  };
}

export default function App() {
  const [quote, setQuote] = useState({
    origin: "Miami, FL",
    destination: "Atlanta, GA",
    distance: 663,
    weight: 120,
    stops: 0,
    urgency: "expedited",
    pickupDate: "",
    deliveryDate: "",
    insideDelivery: false,
    whiteGlove: false,
    weekend: false,
    notes: "",
  });

  const [routeCoords, setRouteCoords] = useState([]);
  const [routeCenter, setRouteCenter] = useState([27.5, -82.5]); // Gulf region
  const [routeStatus, setRouteStatus] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);

  const estimate = useQuoteEstimate(quote);
  const apiKey = process.env.REACT_APP_ORS_API_KEY;

  const handleAutoDistance = async () => {
    if (!apiKey) {
      setRouteStatus("API key missing. Check your .env file.");
      return;
    }
    if (!quote.origin || !quote.destination) {
      setRouteStatus("Enter both origin and destination.");
      return;
    }
    setRouteLoading(true);
    setRouteStatus("");
    try {
      const result = await getRoute(quote.origin, quote.destination, apiKey);
      setQuote((q) => ({ ...q, distance: result.distanceMiles }));
      setRouteCoords(result.coords);
      setRouteCenter(result.midpoint);
    } catch (err) {
      console.error(err);
      setRouteCoords([]);
      setRouteStatus("No route found. Try a more specific city / state.");
    } finally {
      setRouteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sky-50 text-neutral-900">
      {/* JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: BRAND.name,
            url: "https://www.ts-express.com/",
            image: process.env.PUBLIC_URL + "/og-cover.jpg",
            telephone: BRAND.phone,
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

      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-sky-100 bg-sky-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm md:h-16 md:w-16">
              <img
                src={process.env.PUBLIC_URL + "/logo.png"}
                alt={BRAND.name}
                className="h-11 w-auto md:h-13"
              />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold md:text-base">
                Toussaint &amp; Santana Logistics
              </p>
              <p className="text-[11px] text-neutral-500 md:text-xs">
                {BRAND.tagline}
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <a
              href="#quote"
              className="rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-medium hover:border-sky-400 hover:bg-sky-50"
            >
              {BRAND.ctaPrimary}
            </a>
            <a
              href="#contact"
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
            >
              Contact
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="border-b border-sky-100 bg-gradient-to-b from-sky-50 to-sky-100 py-16 md:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="rounded-3xl bg-white/80 p-8 shadow-lg shadow-sky-100 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-600">
                CARGO VAN • FINAL MILE • HOT SHOT
              </p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">
                Coast-to-coast coverage for cargo vans &amp; final-mile.
              </h1>
              <p className="mt-4 text-neutral-700 md:text-lg">
                We move freight fast, safe, and professionally. Expedited
                loads, dedicated lanes, white-glove delivery, and nationwide
                partner capacity.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="#quote"
                  className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-black"
                >
                  Get Instant Estimate
                </a>
                <a
                  href="#contact"
                  className="rounded-xl border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium hover:border-neutral-500 hover:bg-neutral-50"
                >
                  Talk to Dispatch
                </a>
              </div>
              <div className="mt-6 flex flex-wrap gap-4 text-xs text-neutral-600">
                <span className="rounded-full bg-sky-50 px-3 py-1">
                  ✔ 24/7 Dispatch
                </span>
                <span className="rounded-full bg-sky-50 px-3 py-1">
                  ✔ Real-time lane pricing
                </span>
                <span className="rounded-full bg-sky-50 px-3 py-1">
                  ✔ Fully insured partner fleet
                </span>
              </div>
            </div>

            <div className="grid gap-4 text-center md:grid-cols-1">
              <div className="rounded-3xl bg-white p-5 shadow-md shadow-sky-100">
                <p className="text-3xl font-semibold md:text-4xl">300+</p>
                <p className="mt-1 text-sm text-neutral-600">Partner Drivers</p>
              </div>
              <div className="rounded-3xl bg-white p-5 shadow-md shadow-sky-100">
                <p className="text-3xl font-semibold md:text-4xl">48</p>
                <p className="mt-1 text-sm text-neutral-600">States Covered</p>
              </div>
              <div className="rounded-3xl bg-white p-5 shadow-md shadow-sky-100">
                <p className="text-3xl font-semibold md:text-4xl">3–5h</p>
                <p className="mt-1 text-sm text-neutral-600">
                  Avg pickup on hot-shot
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SERVICES */}
        <Section
          id="services"
          eyebrow="What we move"
          title="Cargo van & final-mile services"
          subtitle="Designed for brokers, 3PLs, and shippers who need fast, reliable capacity across the Southeast and beyond."
        >
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Expedited / Hot Shot",
                text: "Time-critical cargo van moves with 24/7 dispatch and live tracking.",
              },
              {
                title: "Dedicated Lanes",
                text: "Scheduled coverage for recurring lanes, store routes, and DC transfers.",
              },
              {
                title: "White-Glove Final Mile",
                text: "Inside delivery, room of choice, and extra-care handling for sensitive freight.",
              },
            ].map((s) => (
              <div
                key={s.title}
                className="rounded-2xl bg-white p-6 shadow-sm shadow-sky-100"
              >
                <p className="text-lg font-semibold">{s.title}</p>
                <p className="mt-2 text-sm text-neutral-700">{s.text}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* INSTANT QUOTE + MAP */}
        <Section
          id="quote"
          eyebrow="Instant estimate"
          title="Build a quick lane estimate"
          subtitle="Use this tool for a quick ballpark quote. Final rates are confirmed by dispatch based on live capacity."
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            {/* LEFT: FORM */}
            <div className="rounded-3xl bg-white p-6 shadow-md shadow-sky-100">
              <h3 className="text-sm font-semibold text-neutral-800">
                Lane Details
              </h3>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Origin (City, ST)"
                  value={quote.origin}
                  onChange={(e) =>
                    setQuote((q) => ({ ...q, origin: e.target.value }))
                  }
                />
                <Input
                  placeholder="Destination (City, ST)"
                  value={quote.destination}
                  onChange={(e) =>
                    setQuote((q) => ({ ...q, destination: e.target.value }))
                  }
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleAutoDistance}
                  disabled={routeLoading}
                  className="rounded-xl bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
                >
                  {routeLoading ? "Calculating…" : "Use Auto Distance"}
                </button>
                <p className="text-xs text-neutral-500">
                  or enter distance manually below if you already know it.
                </p>
              </div>

              {routeStatus && (
                <p className="mt-2 text-xs text-red-500">{routeStatus}</p>
              )}

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Input
                  type="number"
                  placeholder="Distance (mi)"
                  value={quote.distance}
                  onChange={(e) =>
                    setQuote((q) => ({ ...q, distance: e.target.value }))
                  }
                />
                <Input
                  type="number"
                  placeholder="Weight (lbs)"
                  value={quote.weight}
                  onChange={(e) =>
                    setQuote((q) => ({ ...q, weight: e.target.value }))
                  }
                />
                <Input
                  type="number"
                  placeholder="# of extra stops"
                  value={quote.stops}
                  onChange={(e) =>
                    setQuote((q) => ({ ...q, stops: e.target.value }))
                  }
                />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="col-span-1">
                  <label className="mb-1 block text-xs font-medium text-neutral-700">
                    Urgency
                  </label>
                  <select
                    value={quote.urgency}
                    onChange={(e) =>
                      setQuote((q) => ({ ...q, urgency: e.target.value }))
                    }
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="standard">Standard</option>
                    <option value="expedited">Expedited / Hot Shot</option>
                    <option value="overnight">Overnight Priority</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700">
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
                  <label className="mb-1 block text-xs font-medium text-neutral-700">
                    Delivery Date
                  </label>
                  <Input
                    type="date"
                    value={quote.deliveryDate}
                    onChange={(e) =>
                      setQuote((q) => ({ ...q, deliveryDate: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold text-neutral-800">
                  Accessorials
                </p>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  <Checkbox
                    label="Inside Delivery"
                    checked={quote.insideDelivery}
                    onChange={(e) =>
                      setQuote((q) => ({
                        ...q,
                        insideDelivery: e.target.checked,
                      }))
                    }
                  />
                  <Checkbox
                    label="White Glove / Room of Choice"
                    checked={quote.whiteGlove}
                    onChange={(e) =>
                      setQuote((q) => ({
                        ...q,
                        whiteGlove: e.target.checked,
                      }))
                    }
                  />
                  <Checkbox
                    label="After-Hours / Weekend"
                    checked={quote.weekend}
                    onChange={(e) =>
                      setQuote((q) => ({ ...q, weekend: e.target.checked }))
                    }
                  />
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-1 block text-xs font-medium text-neutral-700">
                  Notes for Dispatch
                </label>
                <textarea
                  rows={3}
                  value={quote.notes}
                  onChange={(e) =>
                    setQuote((q) => ({ ...q, notes: e.target.value }))
                  }
                  className="w-full resize-none rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                  placeholder="Dock hours, reference numbers, special handling, etc."
                />
              </div>
            </div>

            {/* RIGHT: PRICING + MAP */}
            <div className="space-y-4">
              <div className="rounded-3xl bg-white p-6 shadow-md shadow-sky-100">
                <h3 className="text-sm font-semibold text-neutral-800">
                  Pricing Snapshot
                </h3>
                <div className="mt-3 space-y-1 text-sm text-neutral-700">
                  <p>
                    <span className="font-medium">Base:</span> ${estimate.base}
                  </p>
                  <p>
                    <span className="font-medium">Distance:</span>{" "}
                    {estimate.distanceMi} mi × ${estimate.perMile}/mi
                  </p>
                  <p>
                    <span className="font-medium">Fuel Surcharge:</span>{" "}
                    {Math.round(estimate.fuelSurcharge * 100)}%
                  </p>
                  {estimate.heavySurcharge > 0 && (
                    <p>
                      <span className="font-medium">Heavy Surcharge:</span> $
                      {estimate.heavySurcharge}
                    </p>
                  )}
                  {estimate.stopFee > 0 && (
                    <p>
                      <span className="font-medium">Multi-Stop Fee:</span> $
                      {estimate.stopFee}
                    </p>
                  )}
                  {estimate.accessorials > 0 && (
                    <p>
                      <span className="font-medium">Accessorials:</span> $
                      {estimate.accessorials}
                    </p>
                  )}
                  <hr className="my-2 border-dashed border-neutral-200" />
                  <p className="text-xs text-neutral-500">
                    This is a non-binding estimate. Rates can change based on
                    live capacity and exact requirements.
                  </p>
                  <p className="mt-3 text-lg font-semibold">
                    Estimated Total: ${estimate.total.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl bg-white shadow-md shadow-sky-100">
                <div className="border-b border-neutral-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Lane Map
                </div>
                <div className="h-64">
                  <MapContainer
                    center={routeCenter}
                    zoom={5}
                    scrollWheelZoom={false}
                    className="h-full w-full"
                    attributionControl={false}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution="&copy; OpenStreetMap contributors"
                    />
                    {routeCoords.length > 0 && (
                      <Polyline positions={routeCoords} weight={5} />
                    )}
                  </MapContainer>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* COVERAGE */}
        <Section
          id="coverage"
          eyebrow="Network"
          title="Southeast hub, nationwide reach"
          subtitle="Headquartered in Miami with dense coverage across the Southeast, plus partner capacity across 48 states."
        >
          <div className="rounded-3xl bg-white p-6 text-sm text-neutral-700 shadow-sm shadow-sky-100">
            Reliable cargo-van capacity across FL, GA, AL, SC, NC, TN, TX and a
            vetted nationwide partner network for coast-to-coast moves.
          </div>
        </Section>

        {/* CONTACT */}
        <Section id="contact" eyebrow="Let’s move freight" title="Contact dispatch">
          <div className="rounded-3xl bg-white p-6 shadow-sm shadow-sky-100">
            <p className="text-neutral-700">
              Email us at{" "}
              <a
                href={`mailto:${BRAND.email}`}
                className="font-medium text-sky-700 underline"
              >
                {BRAND.email}
              </a>{" "}
              or call{" "}
              <span className="font-medium">{BRAND.phone}</span>. Share your
              lane, weight, and timing and we’ll confirm a live rate.
            </p>
          </div>
        </Section>

        <footer className="border-t border-sky-100 py-8 text-center text-xs text-neutral-500">
          © {new Date().getFullYear()} Toussaint &amp; Santana Logistics. All
          rights reserved.
        </footer>
      </main>
    </div>
  );
}
