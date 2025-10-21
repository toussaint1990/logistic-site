import React, { useMemo, useState } from "react";

const BRAND = {
  name: "Toussaint & Santana Logistics",
  tagline: "On-time. Every time.",
  phone: "+1 (305) 555-0137",
  email: "hello@ts-logistics.com",
  ctaPrimary: "Get a Quote",
  ctaSecondary: "Track Shipment",
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

function useQuoteEstimate({ origin, destination, weightLbs, distanceMi }) {
  return useMemo(() => {
    if (!origin || !destination) return null;
    const base = 49, perMile = 1.25, fuelSurcharge = 0.12;
    const heavySurcharge = weightLbs > 150 ? 35 : 0;
    const dist = Number(distanceMi || 0);
    const subtotal = base + dist * perMile + heavySurcharge;
    const total = Math.round(subtotal * (1 + fuelSurcharge) * 100) / 100;
    return { base, perMile, fuelSurcharge, heavySurcharge, dist, subtotal, total };
  }, [origin, destination, weightLbs, distanceMi]);
}

export default function App() {
  const [quote, setQuote] = useState({
    origin: "Miami, FL",
    destination: "Atlanta, GA",
    distance: 663,
    weight: 120,
  });

  const estimate = useQuoteEstimate({
    origin: quote.origin,
    destination: quote.destination,
    weightLbs: Number(quote.weight),
    distanceMi: Number(quote.distance),
  });

  

  const [menuOpen, setMenuOpen] = useState(false);


  return (
    <>
      {/* SEO JSON-LD (optional & harmless if left) */}
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

     <header className="sticky top-0 z-50 border-b bg-white/70 backdrop-blur">
  <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
    {/* Left: Logo + brand */}
    <div className="flex items-center gap-2">
      <img
        src={process.env.PUBLIC_URL + '/logo.png'}
        alt="Toussaint & Santana Logistics"
        className="h-12 w-auto md:h-14 rounded-lg"
      />
      <div className="leading-tight">
        <p className="text-sm font-semibold">Toussaint &amp; Santana Logistics</p>
        <p className="text-[11px] text-neutral-500">On-time. Every time.</p>
      </div>
    </div>

    {/* Desktop actions */}
    <div className="hidden items-center gap-3 md:flex">
      <a href="#quote" className="rounded-xl border px-4 py-2 text-sm hover:bg-neutral-50">
        Get a Quote
      </a>
      <a href="#contact" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-black">
        Contact
      </a>
    </div>

    {/* Mobile burger */}
    <button
      type="button"
      aria-label="Toggle menu"
      aria-expanded={menuOpen}
      aria-controls="mobile-nav"
      onClick={() => setMenuOpen((v) => !v)}
      className="md:hidden inline-flex items-center justify-center rounded-xl border px-3 py-2"
    >
      {/* Simple burger icon */}
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeWidth="2" strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    </button>
  </div>

  {/* Mobile dropdown (animated) */}
  <div
    id="mobile-nav"
    className={[
      "md:hidden overflow-hidden border-t",
      "transition-all duration-700 ease-out",
      menuOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
    ].join(" ")}
  >
    <nav className="flex flex-col gap-3 p-4">
  <a
    href="#home"
    className={[
      "py-2 text-sm font-medium",
      "transition-all duration-500",
      menuOpen ? "opacity-100 translate-y-0 delay-100" : "opacity-0 -translate-y-2 delay-0"
    ].join(" ")}
    onClick={() => setMenuOpen(false)}
  >
    Home
  </a>

  <a
    href="#services"
    className={[
      "py-2 text-sm font-medium",
      "transition-all duration-500",
      menuOpen ? "opacity-100 translate-y-0 delay-200" : "opacity-0 -translate-y-2 delay-0"
    ].join(" ")}
    onClick={() => setMenuOpen(false)}
  >
    Services
  </a>

  <a
    href="#quote"
    className={[
      "py-2 text-sm font-medium",
      "transition-all duration-800 ease-in-out",

      menuOpen ? "opacity-100 translate-y-0 delay-300" : "opacity-0 -translate-y-2 delay-0"
    ].join(" ")}
    onClick={() => setMenuOpen(false)}
  >
    Get a Quote
  </a>

  <a
    href="#contact"
    className={[
      "py-2 text-sm font-medium",
      "transition-all duration-500",
      menuOpen ? "opacity-100 translate-y-0 delay-400" : "opacity-0 -translate-y-2 delay-0"
    ].join(" ")}
    onClick={() => setMenuOpen(false)}
  >
    Contact
  </a>
</nav>



      <main>
        {/* HERO */}
        <section
          id="home"
          className="border-b py-16 md:py-24"
          style={{
            backgroundImage: `url(${process.env.PUBLIC_URL + "/hero-bg.jpg"})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 md:grid-cols-2">
            <div className="backdrop-blur-sm bg-white/70 rounded-2xl p-6">
              <h1 className="text-4xl font-semibold md:text-5xl">
                Coast-to-coast coverage for cargo vans & final-mile
              </h1>
              <p className="mt-4 text-neutral-700">
                We move freight fast and safely. Dedicated routes, on-demand
                expedited, and white-glove options across the Southeast and beyond.
              </p>
              <div className="mt-6 flex gap-3">
                <a
                  href="#quote"
                  className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
                >
                  {BRAND.ctaPrimary}
                </a>
                <a
                  href="#contact"
                  className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                >
                  Talk to Dispatch
                </a>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl border p-5">
                <p className="text-3xl font-semibold">300+</p>
                <p className="text-sm opacity-90">Partner Drivers</p>
              </div>
              <div className="rounded-2xl border p-5">
                <p className="text-3xl font-semibold">48</p>
                <p className="text-sm opacity-90">States Covered</p>
              </div>
              <div className="rounded-2xl border p-5">
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
          subtitle="Expedited, dedicated routes, scheduled runs, and white-glove delivery."
        >
          <div className="grid gap-5 md:grid-cols-3">
            {[
              { title: "Expedited", text: "Hot-shot and on-demand cargo van moves." },
              { title: "Dedicated", text: "Recurring lanes & scheduled coverage." },
              { title: "White-Glove", text: "Inside delivery, POD, and specialized care." },
            ].map((s) => (
              <div key={s.title} className="rounded-2xl border p-6">
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
          subtitle="Headquartered in Miami—serving the Southeast and beyond."
        >
          <div className="rounded-2xl border p-6 text-neutral-700">
            Reliable capacity across FL, GA, AL, SC, NC, TN, and nationwide partner network.
          </div>
        </Section>

        {/* INSTANT QUOTE */}
        <Section
          id="quote"
          title="Instant Estimate"
          subtitle="Quick ballpark pricing—final rates confirmed by dispatch."
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Origin (City, ST)"
                  value={quote.origin}
                  onChange={(e) => setQuote({ ...quote, origin: e.target.value })}
                  aria-label="Origin"
                />
                <Input
                  placeholder="Destination (City, ST)"
                  value={quote.destination}
                  onChange={(e) => setQuote({ ...quote, destination: e.target.value })}
                  aria-label="Destination"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  type="number"
                  placeholder="Distance (mi)"
                  value={quote.distance}
                  onChange={(e) => setQuote({ ...quote, distance: e.target.value })}
                  aria-label="Distance (miles)"
                />
                <Input
                  type="number"
                  placeholder="Weight (lbs)"
                  value={quote.weight}
                  onChange={(e) => setQuote({ ...quote, weight: e.target.value })}
                  aria-label="Weight (lbs)"
                />
              </div>
            </div>

            <div className="rounded-2xl border p-6">
              {estimate ? (
                <div className="space-y-2 text-sm">
                  <div>Base: ${estimate.base}</div>
                  <div>
                    Distance: {estimate.dist} mi × ${estimate.perMile}/mi
                  </div>
                  {estimate.heavySurcharge > 0 && (
                    <div>Heavy Surcharge: ${estimate.heavySurcharge}</div>
                  )}
                  <div>Fuel Surcharge: {Math.round(estimate.fuelSurcharge * 100)}%</div>
                  <hr />
                  <div className="font-semibold">
                    Total Estimate: ${estimate.total.toFixed(2)}
                  </div>
                </div>
              ) : (
                <p className="text-neutral-600">Enter details to get an estimate.</p>
              )}
            </div>
          </div>
        </Section>

        {/* CONTACT */}
        <Section id="contact" title="Contact Us">
          <p className="text-neutral-700">
            Email us at{" "}
            <a href={`mailto:${BRAND.email}`} className="text-neutral-900 underline">
              {BRAND.email}
            </a>{" "}
            or call {BRAND.phone}.
          </p>
        </Section>

        {/* FOOTER */}
        <footer className="border-t py-8 text-center text-sm text-neutral-600">
          © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
        </footer>
      </main>
    </>
  );
}
