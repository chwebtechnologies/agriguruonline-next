"use client";

import React, { useState, useId } from "react";
import flags from "react-phone-number-input/flags";

export interface WorldwideLocation {
  id: string;
  name: string;
  fullName?: string;
  city: string;
  country: string;
  countryCode: "IN" | "AE" | "CN" | "FR" | "KE" | "BR";
  role: string;
  badge: string;
  icon: string;
  isHq?: boolean;
  isPort?: boolean;
  x: number; // 0 - 1000 coordinate
  y: number; // 0 - 500 coordinate
  lat: number;
  lng: number;
}

export const WORLDWIDE_LOCATIONS: WorldwideLocation[] = [
  {
    id: "india-hq",
    name: "India (HQ)",
    city: "Ahmedabad, Gujarat",
    country: "India",
    countryCode: "IN",
    role: "Global Corporate Headquarters & Multi-Commodity Trade Hub",
    badge: "Global HQ",
    icon: "fa-solid fa-star",
    isHq: true,
    x: 702,
    y: 193,
    lat: 23.0225,
    lng: 72.5714,
  },
  {
    id: "uae",
    name: "UAE",
    city: "Dubai",
    country: "United Arab Emirates",
    countryCode: "AE",
    role: "Middle East Commercial Hub & Cross-Trade Operations",
    badge: "Middle East Hub",
    icon: "fa-solid fa-building",
    x: 654,
    y: 184,
    lat: 25.2048,
    lng: 55.2708,
  },
  {
    id: "china",
    name: "China",
    city: "China Trade Network",
    country: "China",
    countryCode: "CN",
    role: "Asia-Pacific Trade Network & Direct Sourcing Center",
    badge: "Asia Network",
    icon: "fa-solid fa-network-wired",
    x: 812,
    y: 162,
    lat: 31.2304,
    lng: 121.4737,
  },
  {
    id: "france",
    name: "France",
    city: "Paris",
    country: "France",
    countryCode: "FR",
    role: "European Trade & Institutional Representation Network",
    badge: "Europe Network",
    icon: "fa-solid fa-landmark",
    x: 507,
    y: 97,
    lat: 48.8566,
    lng: 2.3522,
  },
  {
    id: "kenya",
    name: "Kenya",
    city: "Nairobi",
    country: "Kenya",
    countryCode: "KE",
    role: "East Africa Commercial & Regional Operations Hub",
    badge: "East Africa Hub",
    icon: "fa-solid fa-earth-africa",
    x: 602,
    y: 283,
    lat: -1.2921,
    lng: 36.8219,
  },
  {
    id: "mombasa",
    name: "Mombasa",
    city: "Mombasa Port",
    country: "Kenya",
    countryCode: "KE",
    role: "Major Agri Ocean Shipping & Deep-Water Port Logistics Hub",
    badge: "Port Logistics Hub",
    icon: "fa-solid fa-anchor",
    isPort: true,
    x: 610,
    y: 293,
    lat: -4.0435,
    lng: 39.6682,
  },
  {
    id: "brazil",
    name: "Brazil",
    city: "Brazil Office Network",
    country: "Brazil",
    countryCode: "BR",
    role: "South America Grain & Agri Commodity Sourcing Center",
    badge: "South America Hub",
    icon: "fa-solid fa-seedling",
    x: 367,
    y: 336,
    lat: -15.7801,
    lng: -47.9292,
  },
];

interface WorldwideLocationsMapProps {
  title?: string;
}

export default function WorldwideLocationsMap({
  title = "We Operate in 7 Locations Worldwide Network.",
}: WorldwideLocationsMapProps) {
  const [selectedId, setSelectedId] = useState<string>("india-hq");
  const [viewMode, setViewMode] = useState<"network" | "live">("network");
  const [liveMapLoaded, setLiveMapLoaded] = useState(false);
  const filterId = useId();

  const selectedLoc =
    WORLDWIDE_LOCATIONS.find((loc) => loc.id === selectedId) ||
    WORLDWIDE_LOCATIONS[0];
  const hqLoc = WORLDWIDE_LOCATIONS[0];

  // Helper to generate a curved quadratic bezier curve between two points
  const getCurvePath = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Control point arched upwards
    const cx = mx - dy * 0.12;
    const cy = my - Math.abs(dx) * 0.16 - dist * 0.08;
    return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex-1 flex flex-col transition-all">
      {/* Header Section with Title & View Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5 pb-3 border-b border-border/70">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue shrink-0 shadow-xs">
            <i className="fa-solid fa-earth-americas text-lg"></i>
          </div>
          <div>
            <h2 className="text-[15px] sm:text-[17px] font-bold text-foreground leading-tight">
              {title}
            </h2>
            <p className="text-[12px] sm:text-[13px] text-muted-foreground mt-0.5">
              Connected across 7 global strategic trade hubs & ports
            </p>
          </div>
        </div>

        {/* View Mode Switcher Pill */}
        <div className="flex items-center self-start sm:self-auto bg-muted/80 p-1 rounded-xl border border-border/80 text-[12px] font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("network")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              viewMode === "network"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <i className="fa-solid fa-network-wired text-[11px] text-brand-blue"></i>
            <span>Network View</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode("live");
              setLiveMapLoaded(true);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              viewMode === "live"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <i className="fa-solid fa-map-location-dot text-[11px] text-emerald-500"></i>
            <span>Live Map</span>
          </button>
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div className="relative w-full h-[220px] sm:h-[260px] md:h-[290px] rounded-xl overflow-hidden border border-border bg-slate-50/70 dark:bg-slate-950/60 shadow-inner">
        {viewMode === "network" ? (
          /* Native Interactive SVG World Map */
          <div className="relative w-full h-full flex items-center justify-center select-none overflow-hidden">
            <svg
              viewBox="0 0 1000 500"
              className="w-full h-full object-contain pointer-events-auto"
              preserveAspectRatio="xMidYMid meet"
              aria-label="World Map showing 7 AgriGuru Network Locations"
            >
              <defs>
                <linearGradient id={`${filterId}-bg`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.03" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.08" />
                </linearGradient>

                <linearGradient id={`${filterId}-arc`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.85" />
                </linearGradient>

                <filter id={`${filterId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Latitude / Longitude Subtle Grid Lines */}
              <g className="stroke-border/25 dark:stroke-border/35" strokeWidth="0.75" strokeDasharray="3 4">
                <line x1="0" y1="125" x2="1000" y2="125" />
                <line x1="0" y1="250" x2="1000" y2="250" />
                <line x1="0" y1="375" x2="1000" y2="375" />
                <line x1="200" y1="0" x2="200" y2="500" />
                <line x1="400" y1="0" x2="400" y2="500" />
                <line x1="600" y1="0" x2="600" y2="500" />
                <line x1="800" y1="0" x2="800" y2="500" />
              </g>

              {/* Continents Silhouettes - Stylized Vector Geometry */}
              <g className="fill-slate-200/80 dark:fill-slate-800/80 stroke-slate-300/60 dark:stroke-slate-700/60" strokeWidth="0.8">
                {/* North America */}
                <path d="M 120 70 L 155 58 L 205 60 L 255 75 L 305 85 L 290 120 L 260 145 L 240 180 L 205 210 L 210 240 L 235 255 L 250 245 L 275 255 L 270 270 L 230 280 L 200 245 L 180 200 L 150 170 L 130 130 L 105 105 Z" />
                {/* Greenland */}
                <path d="M 335 40 L 375 35 L 400 55 L 385 85 L 345 80 Z" />
                {/* South America */}
                <path d="M 270 280 L 315 285 L 370 310 L 410 335 L 420 375 L 390 435 L 360 470 L 340 460 L 330 405 L 305 345 L 275 305 Z" />
                {/* Europe */}
                <path d="M 470 95 L 515 85 L 550 80 L 575 110 L 555 140 L 530 155 L 485 160 L 465 145 L 480 120 Z" />
                {/* Scandinavia */}
                <path d="M 520 65 L 545 45 L 565 55 L 555 85 L 530 85 Z" />
                {/* Africa */}
                <path d="M 475 170 L 545 170 L 590 200 L 635 235 L 630 300 L 610 365 L 575 420 L 545 425 L 515 370 L 480 300 L 450 250 L 455 200 Z" />
                {/* Madagascar */}
                <path d="M 645 345 L 660 350 L 650 395 L 638 385 Z" />
                {/* Asia / Eurasia */}
                <path d="M 570 85 L 640 75 L 720 70 L 810 80 L 880 95 L 905 130 L 865 160 L 880 190 L 840 215 L 795 240 L 755 210 L 710 185 L 670 170 L 620 145 L 580 120 Z" />
                {/* Indian Subcontinent */}
                <path d="M 670 170 L 715 185 L 740 220 L 730 265 L 705 285 L 685 240 L 665 205 Z" />
                {/* South East Asia */}
                <path d="M 790 240 L 830 260 L 820 295 L 795 280 Z" />
                {/* Japan */}
                <path d="M 885 155 L 905 175 L 895 210 L 880 195 Z" />
                {/* Australia */}
                <path d="M 790 355 L 855 345 L 900 375 L 890 425 L 840 440 L 795 410 L 780 375 Z" />
                {/* New Zealand */}
                <path d="M 925 430 L 940 435 L 930 465 Z" />
              </g>

              {/* Trade Route Flowing Curves from India (HQ) */}
              <g className="pointer-events-none">
                {WORLDWIDE_LOCATIONS.filter((l) => !l.isHq).map((loc) => {
                  const isHighlighted =
                    selectedId === loc.id || selectedId === "india-hq";
                  return (
                    <g key={`arc-${loc.id}`}>
                      {/* Outer Glow Path */}
                      <path
                        d={getCurvePath(hqLoc.x, hqLoc.y, loc.x, loc.y)}
                        fill="none"
                        className={
                          isHighlighted
                            ? "stroke-brand-blue/50 dark:stroke-cyan-400/50"
                            : "stroke-slate-300/40 dark:stroke-slate-700/40"
                        }
                        strokeWidth={isHighlighted ? 2.5 : 1.2}
                        strokeDasharray={isHighlighted ? "none" : "3 3"}
                        strokeLinecap="round"
                      />

                      {/* Animated dashed active flow */}
                      {isHighlighted && (
                        <path
                          d={getCurvePath(hqLoc.x, hqLoc.y, loc.x, loc.y)}
                          fill="none"
                          stroke="url(#filter-arc)"
                          strokeWidth="2"
                          strokeDasharray="6 6"
                          strokeLinecap="round"
                          className="opacity-90 animate-pulse"
                        />
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Location Pins & Radar Hotspots */}
              {WORLDWIDE_LOCATIONS.map((loc) => {
                const isSelected = selectedId === loc.id;
                const isHq = loc.isHq;

                return (
                  <g
                    key={`pin-${loc.id}`}
                    transform={`translate(${loc.x}, ${loc.y})`}
                    onClick={() => setSelectedId(loc.id)}
                    className="cursor-pointer group"
                  >
                    {/* Concentric Pulsing Radar Rings */}
                    <circle
                      r={isHq ? 20 : 14}
                      className={
                        isHq
                          ? "fill-emerald-500/20 dark:fill-emerald-400/25 animate-ping"
                          : isSelected
                          ? "fill-sky-500/30 dark:fill-cyan-400/35 animate-ping"
                          : "fill-sky-500/10 group-hover:fill-sky-500/25 transition-all"
                      }
                    />
                    <circle
                      r={isHq ? 12 : 8}
                      className={
                        isHq
                          ? "fill-emerald-500/30 dark:fill-emerald-400/40"
                          : isSelected
                          ? "fill-sky-500/40 dark:fill-cyan-400/50"
                          : "fill-sky-500/20 group-hover:fill-sky-500/30"
                      }
                    />

                    {/* Center Core Dot */}
                    <circle
                      r={isHq ? 6.5 : 4.5}
                      className={
                        isHq
                          ? "fill-emerald-500 stroke-white dark:stroke-slate-900"
                          : isSelected
                          ? "fill-sky-500 stroke-white dark:stroke-slate-900 shadow-sm"
                          : "fill-sky-600 dark:fill-cyan-400 stroke-white dark:stroke-slate-900"
                      }
                      strokeWidth={isHq ? 2 : 1.5}
                    />

                    {/* Pin Label Card Pill */}
                    <g
                      transform={`translate(0, ${loc.y > 320 ? 16 : -16})`}
                      className="pointer-events-none transition-transform group-hover:scale-105"
                    >
                      <rect
                        x={isHq ? -44 : -34}
                        y="-11"
                        width={isHq ? 88 : 68}
                        height="20"
                        rx="10"
                        className={
                          isHq
                            ? "fill-emerald-600 stroke-white dark:stroke-slate-900"
                            : isSelected
                            ? "fill-sky-600 stroke-white dark:stroke-slate-900"
                            : "fill-slate-900/90 dark:fill-slate-800/95 stroke-slate-700/80"
                        }
                        strokeWidth="1.5"
                        filter={`url(#${filterId}-glow)`}
                      />
                      <text
                        x="0"
                        y="3"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="9.5"
                        fontWeight={isHq || isSelected ? "700" : "600"}
                        letterSpacing="0.2"
                      >
                        {isHq ? `★ ${loc.name}` : loc.name}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>

            {/* Quick Spotlight Overlay Card over the Map */}
            <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:right-auto sm:max-w-xs bg-background/95 dark:bg-card/95 backdrop-blur-md border border-border rounded-xl p-2.5 shadow-md flex items-center justify-between gap-3 transition-all animate-fadeIn">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* SVG Flag */}
                <div className="w-5 h-3.5 rounded-[2px] overflow-hidden border border-border/80 shrink-0 shadow-2xs flex items-center justify-center">
                  {(() => {
                    const FlagComponent = flags[selectedLoc.countryCode];
                    return FlagComponent ? (
                      <FlagComponent title={selectedLoc.country} />
                    ) : (
                      <i className="fa-solid fa-flag text-xs text-muted-foreground"></i>
                    );
                  })()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-bold text-foreground truncate">
                      {selectedLoc.fullName || selectedLoc.name}
                    </span>
                    {selectedLoc.isHq && (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        HQ
                      </span>
                    )}
                    {selectedLoc.isPort && (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        Port
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {selectedLoc.role}
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Active
              </span>
            </div>
          </div>
        ) : (
          /* Live Leaflet Interactive Map View (using fixed /contact-map.html) */
          <div className="w-full h-full relative bg-muted">
            <iframe
              src="/contact-map.html"
              className="w-full h-full border-0 block"
              title={title}
              loading="eager"
            />
          </div>
        )}
      </div>

      {/* "Vo Cheese" - 7 Locations Detail Selector Strip */}
      <div className="mt-3.5 pt-3 border-t border-border/70 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] sm:text-[12px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <i className="fa-solid fa-location-dot text-brand-blue text-[11px]"></i>
            7 Worldwide Operating Locations
          </span>
          <span className="text-[11px] text-muted-foreground">
            Tap to view location
          </span>
        </div>

        {/* Horizontal Scrollable Chips / Pills on mobile, Wrap on desktop */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-wrap">
          {WORLDWIDE_LOCATIONS.map((loc) => {
            const isSelected = selectedId === loc.id;
            const FlagComp = flags[loc.countryCode];

            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => setSelectedId(loc.id)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[12px] font-semibold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? "bg-brand-blue/10 border-brand-blue text-brand-blue shadow-2xs ring-1 ring-brand-blue/30"
                    : "bg-background/80 hover:bg-muted/70 border-border text-foreground/80 hover:text-foreground"
                }`}
              >
                {/* SVG Flag */}
                <div className="w-4.5 h-3 rounded-[2px] overflow-hidden border border-border/70 shrink-0 shadow-3xs flex items-center justify-center">
                  {FlagComp ? (
                    <FlagComp title={loc.country} />
                  ) : (
                    <span>{loc.countryCode}</span>
                  )}
                </div>

                {/* Name */}
                <span className="whitespace-nowrap">
                  {loc.name}
                </span>

                {/* Badge Tag */}
                {loc.isHq ? (
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    HQ
                  </span>
                ) : loc.isPort ? (
                  <i className="fa-solid fa-anchor text-[9px] opacity-70"></i>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Active Location Detail Highlight Box */}
        <div className="mt-1 p-2.5 sm:p-3 rounded-xl bg-muted/40 border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 text-foreground/80 shadow-3xs">
              <i className={`${selectedLoc.icon} text-sm text-brand-blue`}></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-foreground">
                  {selectedLoc.city} ({selectedLoc.country})
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-brand-blue/10 text-brand-blue border border-brand-blue/20">
                  {selectedLoc.badge}
                </span>
              </div>
              <p className="text-[11px] sm:text-[12px] text-muted-foreground mt-0.5 leading-snug">
                {selectedLoc.role}
              </p>
            </div>
          </div>

          <a
            href={`https://www.google.com/maps/search/?api=1&query=${selectedLoc.lat},${selectedLoc.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="self-end sm:self-auto flex items-center gap-1.5 text-[11px] font-semibold text-brand-blue hover:underline shrink-0"
          >
            <span>Open in Maps</span>
            <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
          </a>
        </div>
      </div>
    </div>
  );
}
