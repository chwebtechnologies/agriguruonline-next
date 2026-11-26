'use client'

import React, { useState } from 'react'
import Image from 'next/image'

interface LocationItem {
  id: string
  name: string
  fullName: string
  flag: string
  role: string
  x: number // percentage from left
  y: number // percentage from top
  isHq?: boolean
  tooltipAlign?: 'center' | 'left' | 'right'
  tooltipPosition?: 'top' | 'bottom'
}

const LOCATIONS: LocationItem[] = [
  {
    id: 'in',
    name: 'India (Headquarters)',
    fullName: 'Ahmedabad, Gujarat, India',
    flag: '🇮🇳',
    role: 'Global Headquarters & Operations Hub',
    x: 69.1,
    y: 47.8,
    isHq: true,
    tooltipAlign: 'center',
    tooltipPosition: 'top'
  },
  {
    id: 'ae',
    name: 'United Arab Emirates',
    fullName: 'Dubai, UAE',
    flag: '🇦🇪',
    role: 'Middle East Commercial Trade Hub',
    x: 63.4,
    y: 43.8,
    tooltipAlign: 'right',
    tooltipPosition: 'top'
  },
  {
    id: 'cn',
    name: 'China',
    fullName: 'Shanghai Office Network, China',
    flag: '🇨🇳',
    role: 'Asia-Pacific Sourcing & Trade Network',
    x: 82.5,
    y: 42.5,
    tooltipAlign: 'right',
    tooltipPosition: 'bottom'
  },
  {
    id: 'fr',
    name: 'France',
    fullName: 'Paris Office Network, France',
    flag: '🇫🇷',
    role: 'European Trade & Distribution Hub',
    x: 48.4,
    y: 30.5,
    tooltipAlign: 'center',
    tooltipPosition: 'bottom'
  },
  {
    id: 'ke',
    name: 'Kenya (Nairobi)',
    fullName: 'Nairobi Regional Office, Kenya',
    flag: '🇰🇪',
    role: 'East Africa Regional Operations',
    x: 58.2,
    y: 57.0,
    tooltipAlign: 'right',
    tooltipPosition: 'top'
  },
  {
    id: 'ke-msa',
    name: 'Kenya (Mombasa)',
    fullName: 'Mombasa Port Hub, Kenya',
    flag: '🇰🇪',
    role: 'Key Agri Shipping & Port Logistics Hub',
    x: 60.2,
    y: 61.2,
    tooltipAlign: 'left',
    tooltipPosition: 'bottom'
  },
  {
    id: 'br',
    name: 'Brazil',
    fullName: 'Brasília / São Paulo, Brazil',
    flag: '🇧🇷',
    role: 'South America Agri Sourcing & Trade Hub',
    x: 32.8,
    y: 68.5,
    tooltipAlign: 'center',
    tooltipPosition: 'top'
  }
]

interface WorldwideMapProps {
  title?: string
}

export function WorldwideMap({ title }: WorldwideMapProps) {
  const [activeLoc, setActiveLoc] = useState<LocationItem | null>(null)

  return (
    <div className="relative w-full aspect-[1424/749] rounded-xl overflow-visible select-none">
      {/* Background World Map Image Container - Clean flush fit with zero empty padding */}
      <div className="absolute inset-0 rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-border/70 shadow-xs">
        <Image
          src="/images/map-image.svg"
          alt={title || 'Worldwide Network Map'}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority
          className="object-cover w-full h-full pointer-events-none filter contrast-[1.04] saturate-[1.08]"
        />
      </div>

      {/* Floating Interactive Markers Layer */}
      {LOCATIONS.map((loc) => {
        const isActive = activeLoc?.id === loc.id

        return (
          <div
            key={loc.id}
            style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
            className="absolute z-20 cursor-pointer"
            onClick={() => setActiveLoc(isActive ? null : loc)}
            onMouseEnter={() => setActiveLoc(loc)}
            onMouseLeave={() => setActiveLoc(null)}
            role="button"
            tabIndex={0}
            aria-label={`${loc.name} - ${loc.role}`}
          >
            {/* Pin container anchored at pin bottom tip */}
            <div className="relative -translate-x-1/2 -translate-y-full flex flex-col items-center">
              {/* Pin Base Shadow on the map ground */}
              <span
                className={`absolute top-full -mt-0.5 left-1/2 -translate-x-1/2 rounded-full transition-all duration-300 ${
                  loc.isHq
                    ? 'w-3.5 h-1 bg-emerald-700/40 blur-[1.5px]'
                    : 'w-2.5 h-1 bg-red-700/40 blur-[1.2px]'
                }`}
              />

              {/* SVG Location Pin Marker */}
              <div
                className={`relative flex items-center justify-center transition-all duration-300 group ${
                  loc.isHq
                    ? 'w-7 h-7 sm:w-8 sm:h-8 text-emerald-600 dark:text-emerald-500'
                    : 'w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-500'
                } ${
                  isActive
                    ? 'scale-125 -translate-y-1'
                    : 'hover:scale-115 hover:-translate-y-0.5'
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-full h-full filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
                >
                  <path
                    d="M12 0C7.58 0 4 3.58 4 8c0 5.25 7 13 7.4 13.44.33.37.87.37 1.2 0C13 21 20 13.25 20 8c0-4.42-3.58-8-8-8z"
                  />
                </svg>

                {/* Inner Icon: Star for HQ, White dot for branches */}
                <div className="absolute top-[22%] sm:top-[23%] flex items-center justify-center pointer-events-none">
                  {loc.isHq ? (
                    <i className="fa-solid fa-star text-[7px] sm:text-[8px] text-white" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                  )}
                </div>
              </div>

              {/* Interactive Tooltip Card */}
              {isActive && (
                <div
                  className={`absolute ${
                    loc.tooltipPosition === 'bottom'
                      ? 'top-full mt-2'
                      : 'bottom-full mb-1.5'
                  } ${
                    loc.tooltipAlign === 'right'
                      ? 'right-0 translate-x-2'
                      : loc.tooltipAlign === 'left'
                      ? 'left-0 -translate-x-2'
                      : 'left-1/2 -translate-x-1/2'
                  } w-44 sm:w-52 p-2 rounded-xl bg-card/95 text-foreground border border-border shadow-xl backdrop-blur-md z-50 text-left pointer-events-auto animate-in fade-in zoom-in-95 duration-150`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm">{loc.flag}</span>
                    <span
                      className={`text-xs font-bold leading-tight ${
                        loc.isHq ? 'text-emerald-600 dark:text-emerald-400' : 'text-brand-blue'
                      }`}
                    >
                      {loc.name}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-foreground/90 leading-tight mb-0.5">
                    {loc.fullName}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug mb-1">
                    {loc.role}
                  </p>
                  <div className="flex items-center gap-1 text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>AgriGuru Trade Network</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
