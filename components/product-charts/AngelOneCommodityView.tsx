'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export interface CommodityItemData {
  id: number | string;
  category?: string;
  country?: string;
  countryFlag?: string;
  product: string;
  shipBy?: string;
  term?: string;
  pol?: string;
  polFlag?: string;
  pod?: string;
  podFlag?: string;
  price: string | number;
  change: string | number;
  chartStatus?: boolean;
}

// Generate realistic intraday / historical dummy chart data
const generateChartData = (range: string) => {
  let basePrice = 850;
  const count = range === '1D' ? 40 : range === '1W' ? 60 : range === '1M' ? 80 : 100;
  const data = [];
  
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.49) * 4.5;
    basePrice += change;
    data.push({
      time: `T${i}`,
      price: Number(basePrice.toFixed(2)),
    });
  }
  return data;
};

export default function AngelOneCommodityView({
  item,
  isFullScreen = false,
  onClose,
  userType,
  dragProgress = 1,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  item: CommodityItemData;
  isFullScreen?: boolean;
  onClose?: () => void;
  userType?: string | null;
  dragProgress?: number;
  onDragStart?: (clientY: number) => void;
  onDragMove?: (clientY: number) => void;
  onDragEnd?: () => void;
}) {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState('1D');
  const [activeTab, setActiveTab] = useState('Overview');
  const [chartData, setChartData] = useState(() => generateChartData('1D'));

  useEffect(() => {
    setChartData(generateChartData(timeRange));
  }, [timeRange]);

  const numPrice = Number(item.price) || 850;
  const numChange = Number(item.change) || 2.5;
  const isPositive = numChange >= 0;
  const percentChange = ((Math.abs(numChange) / (numPrice || 1)) * 100).toFixed(2);

  const getFlagUrl = (flagPath?: string) => {
    if (!flagPath) return null;
    const baseUrl = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://assets.agriguruonline.com';
    return flagPath.startsWith('http') ? flagPath : `${baseUrl}/${flagPath.replace(/^\//, '')}`;
  };

  const tabs = ['Overview', 'Technical', 'Specifications', 'Historical'];
  const ranges = ['1D', '1W', '1M', '1Y', 'ALL'];

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#121214] text-zinc-900 dark:text-zinc-100 select-none min-h-0">
      {/* 1. Header (Sticky Top / Shrink-0) - Fully Draggable */}
      <div 
        className="shrink-0 px-4 pt-2.5 pb-2 flex items-start justify-between border-b border-zinc-100 dark:border-zinc-800/80 bg-white dark:bg-[#121214] z-20 cursor-grab active:cursor-grabbing touch-none select-none"
        onTouchStart={(e) => {
          if (!isFullScreen && onDragStart) onDragStart(e.touches[0].clientY);
        }}
        onTouchMove={(e) => {
          if (!isFullScreen && onDragMove) onDragMove(e.touches[0].clientY);
        }}
        onTouchEnd={() => {
          if (!isFullScreen && onDragEnd) onDragEnd();
        }}
        onTouchCancel={() => {
          if (!isFullScreen && onDragEnd) onDragEnd();
        }}
        onMouseDown={(e) => {
          if (!isFullScreen && onDragStart) onDragStart(e.clientY);
        }}
      >
        <div className="flex items-start gap-2.5">
          {(isFullScreen || onClose) && (
            <button
              onClick={() => (onClose ? onClose() : router.back())}
              className="group flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm text-foreground hover:text-[#1D92EB] dark:hover:text-[#1D92EB] hover:border-[#1D92EB] transition-all active:scale-95 shrink-0"
              aria-label="Back"
            >
              <i className="fa-solid fa-arrow-left text-[13px] text-zinc-700 dark:text-zinc-300 group-hover:text-[#1D92EB] group-hover:-translate-x-0.5 transition-transform"></i>
            </button>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              {item.countryFlag && (
                <img
                  src={getFlagUrl(item.countryFlag)!}
                  alt="flag"
                  className="w-4 h-3 object-cover rounded-[2px] border border-zinc-200 dark:border-zinc-700 shrink-0"
                />
              )}
              <h1 className="font-extrabold text-[16px] sm:text-[17px] tracking-tight leading-tight text-zinc-900 dark:text-white uppercase">
                {item.product}
              </h1>
            </div>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
              {item.country || 'Global'} • {item.term || 'FOB'} • {item.pol || 'Port'}
            </p>
          </div>
        </div>

        {/* Price & Change on Right */}
        <div className="text-right shrink-0">
          <div className="flex items-center justify-end gap-1 font-bold text-[17px] sm:text-[18px] text-emerald-600 dark:text-emerald-500 tracking-tight">
            <span>${numPrice.toLocaleString()}</span>
            <span className="text-[12px]">{isPositive ? '▲' : '▼'}</span>
          </div>
          <div className="text-[11px] sm:text-[12px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
            <span className={isPositive ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-500'}>
              {isPositive ? `+$${Math.abs(numChange)}` : `-$${Math.abs(numChange)}`} ({isPositive ? '+' : '-'}{percentChange}%)
            </span>
          </div>
        </div>
      </div>

      {/* Top Tabs (Visible in Full Screen mode) */}
      {isFullScreen && (
        <div className="shrink-0 flex items-center px-4 border-b border-zinc-100 dark:border-zinc-800 overflow-x-auto scrollbar-hide bg-white dark:bg-[#121214]">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 px-3.5 text-[14px] font-semibold whitespace-nowrap transition-all border-b-2 ${
                activeTab === tab
                  ? 'border-[#1E60D5] text-[#1E60D5]'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* 2. Scrollable Body Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 pt-3 pb-4 space-y-3.5 scrollbar-hide">
        {/* Chart Card */}
        <div className="w-full bg-[#f8fafc] dark:bg-[#18181b] rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-3.5 shadow-sm">
          {/* Over timeframe header - Also Draggable */}
          <div 
            className="flex flex-col items-center justify-center text-center pb-2 cursor-grab active:cursor-grabbing touch-none select-none"
            onTouchStart={(e) => {
              if (!isFullScreen && onDragStart) onDragStart(e.touches[0].clientY);
            }}
            onTouchMove={(e) => {
              if (!isFullScreen && onDragMove) onDragMove(e.touches[0].clientY);
            }}
            onTouchEnd={() => {
              if (!isFullScreen && onDragEnd) onDragEnd();
            }}
          >
            <span className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">
              Over {timeRange === '1D' ? '1 day' : timeRange === '1W' ? '1 week' : timeRange === '1M' ? '1 month' : timeRange === '1Y' ? '1 year' : 'all time'}
            </span>
            <span className={`text-[13px] font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-500'}`}>
              {isPositive ? `+$${Math.abs(numChange)}` : `-$${Math.abs(numChange)}`} ({isPositive ? '+' : '-'}{percentChange}%)
            </span>
          </div>

          {/* Area / Line Chart */}
          <div className="w-full h-[180px] sm:h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isPositive ? '#00A86B' : '#EF4444'} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={isPositive ? '#00A86B' : '#EF4444'} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-zinc-900 text-white text-[11px] font-bold px-2 py-1 rounded shadow-md">
                          ${payload[0].value}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={isPositive ? '#00A86B' : '#EF4444'}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPrice)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Timeline Selector */}
          <div className="flex items-center justify-around border-t border-zinc-200/60 dark:border-zinc-700/60 pt-2.5 mt-1">
            {ranges.map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`text-[12px] font-bold px-2.5 py-0.5 transition-all ${
                  timeRange === range
                    ? 'text-[#1E60D5] border-b-2 border-[#1E60D5]'
                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 border-b-2 border-transparent'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Statistics & Range Sliders (Hidden initially, smoothly revealed when swiping up / fullscreen) */}
        <div 
          className="px-1 space-y-4 overflow-hidden transition-all duration-200"
          style={{
            opacity: isFullScreen ? 1 : Math.max(dragProgress, 0),
            maxHeight: isFullScreen ? '1200px' : `${dragProgress * 600}px`,
            display: !isFullScreen && dragProgress === 0 ? 'none' : 'block'
          }}
        >
          {/* Two-Column Market Stats */}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Avg. Traded Price
              </div>
              <div className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                ${(numPrice - 1.25).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Volume / Supply
              </div>
              <div className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                25,000 MT
              </div>
            </div>
          </div>

          {/* Range Sliders */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Daily Low / High
              </div>
              <div className="flex items-center justify-between text-[12px] font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">
                <span>${(numPrice * 0.98).toFixed(0)}</span>
                <span>${(numPrice * 1.02).toFixed(0)}</span>
              </div>
              <div className="relative w-full h-1.5 rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-emerald-500 mt-1">
                <div className="absolute top-1/2 left-[60%] -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-zinc-900 dark:bg-white rounded-full shadow border border-white dark:border-zinc-900"></div>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                52 Week High / Low
              </div>
              <div className="flex items-center justify-between text-[12px] font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">
                <span>${(numPrice * 0.82).toFixed(0)}</span>
                <span>${(numPrice * 1.18).toFixed(0)}</span>
              </div>
              <div className="relative w-full h-1.5 rounded-full bg-gradient-to-r from-red-400 via-purple-400 to-emerald-500 mt-1">
                <div className="absolute top-1/2 left-[75%] -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-zinc-900 dark:bg-white rounded-full shadow border border-white dark:border-zinc-900"></div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-0.5">
            <button className="text-[12px] font-bold text-[#1E60D5] hover:underline flex items-center gap-1">
              <span>COMMODITY INFO</span>
              <i className="fa-solid fa-chevron-right text-[10px]"></i>
            </button>
          </div>

          {/* Know Your Commodity Card */}
          <div className="bg-[#f8fafc] dark:bg-[#18181b] rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-3.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[14px] text-zinc-900 dark:text-white">Know Your Commodity</h3>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded-md">
                  Export Grade
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-md">
                  {item.shipBy || '20 FT'}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
              Understand global demand performance and AI forecast.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-800 border-l-4 border-l-emerald-500">
                <div className="text-[10px] font-bold text-zinc-400 uppercase">AI PREDICTION</div>
                <div className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Bullish (+3.8%)
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-800 border-l-4 border-l-amber-500">
                <div className="text-[10px] font-bold text-zinc-400 uppercase">GLOBAL DEMAND</div>
                <div className="text-[13px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                  High Demand
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Pills Row */}
          <div className="pt-2 pb-1 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <button className="h-9 px-3.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full text-[12px] font-bold flex items-center gap-1.5 shrink-0 hover:bg-zinc-200 transition-colors">
              <i className="fa-solid fa-chart-simple text-emerald-500 text-[11px]"></i>
              <span>Full Chart</span>
            </button>

            <button className="h-9 px-3.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full text-[12px] font-bold flex items-center gap-1.5 shrink-0 hover:bg-zinc-200 transition-colors">
              <i className="fa-solid fa-circle-info text-blue-500 text-[11px]"></i>
              <span>Specifications</span>
            </button>

            <button className="h-9 px-3.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full text-[12px] font-bold flex items-center gap-1.5 shrink-0 hover:bg-zinc-200 transition-colors">
              <i className="fa-solid fa-ship text-purple-500 text-[11px]"></i>
              <span>{item.pol || 'Port Info'}</span>
            </button>

            <button className="h-9 px-3.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full text-[12px] font-bold flex items-center gap-1.5 shrink-0 hover:bg-zinc-200 transition-colors">
              <i className="fa-solid fa-box text-amber-500 text-[11px]"></i>
              <span>{item.shipBy || 'Container'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Sticky Bottom Action Bar (Shrink-0 / Non-cutting) */}
      <div className="shrink-0 bg-white/95 dark:bg-[#121214]/95 backdrop-blur-md border-t border-zinc-200/80 dark:border-zinc-800/80 px-3.5 pt-2.5 pb-4 sm:pb-3 pb-safe z-30 flex items-center gap-2">
        <button 
          className="px-3.5 sm:px-4 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 text-zinc-800 dark:text-zinc-200 font-bold text-[13px] sm:text-[14px] rounded-xl flex items-center justify-center gap-1.5 transition-all shrink-0 shadow-sm"
        >
          <i className="fa-solid fa-robot text-blue-500 text-[14px]"></i>
          <span>AI Predict</span>
        </button>

        <button 
          className="px-3.5 sm:px-4 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 text-zinc-800 dark:text-zinc-200 font-bold text-[13px] sm:text-[14px] rounded-xl flex items-center justify-center gap-1.5 transition-all shrink-0 shadow-sm"
        >
          <i className="fa-solid fa-bell text-purple-500 text-[14px]"></i>
          <span>Create Alert</span>
        </button>

        <button 
          className={`flex-1 py-3 font-extrabold text-[14px] sm:text-[15px] tracking-wide rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${
            userType === 'seller' 
              ? 'bg-[#E24A4A] hover:bg-[#D9383A] text-white' 
              : 'bg-[#009E74] hover:bg-[#008A62] text-white'
          }`}
        >
          <span>{userType === 'seller' ? 'SELL OFFER' : userType === 'buyer' ? 'BUY INQUIRY' : 'BUY / INQUIRY'}</span>
        </button>
      </div>
    </div>
  );
}
