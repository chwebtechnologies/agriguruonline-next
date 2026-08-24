'use client';

import React, { useState } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts';

const dummyData = Array.from({ length: 365 }, (_, i) => {
  const date = new Date('2025-08-25');
  date.setDate(date.getDate() + i);
  return {
    date: date.toISOString().split('T')[0],
    price: 0.83 + Math.random() * 0.05 + Math.sin(i / 20) * 0.02,
  };
});

export default function DedicatedChartClient({ productId, lang }: { productId: string, lang: string }) {
  const [timeRange, setTimeRange] = useState('1Y');
  const ranges = ['12H', '1D', '1W', '1M', '1Y', '2Y', '5Y', '10Y'];

  return (
    <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 fade-in animate-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Price Chart Analysis</h2>
        <div className="flex items-center gap-2">
          <button className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            <i className="fa-solid fa-download"></i>
          </button>
          <button className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            <i className="fa-solid fa-share-nodes"></i>
          </button>
        </div>
      </div>

      {/* Timeline Selector */}
      <div className="flex justify-center items-center gap-2 sm:gap-4 mb-8 overflow-x-auto px-4 w-full scrollbar-hide text-[#71717a]" style={{ scrollbarWidth: 'none' }}>
        {ranges.map(range => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-1.5 text-[14px] font-bold rounded-full whitespace-nowrap transition-all duration-200 ${
              timeRange === range
                ? 'bg-[#1877F2] text-white'
                : 'bg-transparent hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            {range}
          </button>
        ))}
      </div>
      
      {/* Chart Area */}
      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dummyData} margin={{ top: 10, right: 0, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f0f0f0" strokeOpacity={1} />
            <XAxis 
              dataKey="date" 
              axisLine={{ stroke: '#52525b', strokeWidth: 1 }}
              tickLine={{ stroke: '#52525b', strokeWidth: 1 }} 
              tick={{ fontSize: 12, fill: '#71717a' }} 
              dy={10}
              minTickGap={30}
            />
            <YAxis 
              orientation="right" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: '#52525b' }}
              domain={['dataMin', 'dataMax']}
              dx={0}
              tickFormatter={(val) => val.toFixed(5)}
              width={65}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              labelStyle={{ color: '#71717a', fontSize: '12px', marginBottom: '4px' }}
              itemStyle={{ color: '#1877F2', fontWeight: 'bold', fontSize: '15px' }}
            />
            <Line 
              type="linear" 
              dataKey="price" 
              stroke="#1877F2" 
              strokeWidth={2} 
              dot={false} 
              activeDot={{ r: 4, fill: '#1877F2', stroke: '#fff', strokeWidth: 2 }}
            />
            <Brush 
              dataKey="date" 
              height={40} 
              stroke="#1877F2" 
              fill="#E8F4FF"
              travellerWidth={8} 
              tickFormatter={() => ''}
            >
              <AreaChart data={dummyData}>
                <Area type="linear" dataKey="price" stroke="none" fill="#1877F2" fillOpacity={0.5} />
              </AreaChart>
            </Brush>
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col items-center justify-center text-[13px] text-[#71717a] mt-6 mb-2">
        <p>Aug 25, 2025, 00:00 UTC - Aug 24, 2026, 12:15 UTC</p>
        <p className="mt-1">
          USD/EUR <span className="text-zinc-800 dark:text-zinc-200 font-semibold">close:</span> 0.857209{' '}
          <span className="text-zinc-800 dark:text-zinc-200 font-semibold">low:</span> 0.83196{' '}
          <span className="text-zinc-800 dark:text-zinc-200 font-semibold">high:</span> 0.880736
        </p>
      </div>
    </div>
  );
}
