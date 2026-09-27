'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CarouselSlide {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  tag: string;
  link: string;
  linkText: string;
  gradientLight: string;
  gradientDark: string;
}

const getSlides = (lang: string): CarouselSlide[] => [
  {
    id: 'marketing-1',
    title: 'World’s 1st Smart AI Powered B2B Trade Platform',
    subtitle: 'Live 24/7 Commodity Prices | OCEAN FREIGHTS | AI Predict',
    description: 'Discover global agri-commodity trade intelligence with FOB, CNF and CIF prices, freight rates, historical price charts, AI-powered price predictions, market reports, price alerts, trade opportunities, smart export documentation and many more powerful features in one platform.',
    tag: 'Platform Feature',
    link: `/${lang}/about`,
    linkText: 'Explore Features',
    gradientLight: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
    gradientDark: 'linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%)',
  },
  {
    id: 'features-1',
    title: 'The Ultimate Trading Toolkit',
    subtitle: '3 Core Solutions + Powerful Add-ons',
    description: 'Solve your biggest bottlenecks with Live Product Pricing (FOB, CNF, CIF), instant Ocean Freight Rates, and automated Smart Export Docs. Plus, stay ahead with AI predictions, price alerts, global news, and quick inquiry negotiations.',
    tag: 'Platform Features',
    link: `/${lang}/about`,
    linkText: 'See All Features',
    gradientLight: 'linear-gradient(135deg, #14b8a6 0%, #0369a1 100%)',
    gradientDark: 'linear-gradient(135deg, #0f766e 0%, #075985 100%)',
  },
  {
    id: 'membership-1',
    title: 'Try It Risk-Free for 90 Days',
    subtitle: 'Silver Plan Trial - Completely Free',
    description: 'The Silver Plan trial costs nothing. No credit card, no banking details, no catch. Just sign up and explore all premium features for yourself for a full 90 days.',
    tag: 'Membership Plan',
    link: `/${lang}/register`,
    linkText: 'Start Free Trial Now',
    gradientLight: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
    gradientDark: 'linear-gradient(135deg, #9333ea 0%, #6b21a8 100%)',
  },
  {
    id: 'app-1',
    title: 'Download AgriGuru Online App',
    subtitle: 'Global market access right in your pocket',
    description: 'Get live market prices, instant freight rates, custom alerts, and AI insights on the go. Available for both iOS and Android. Scan the QR code or download directly from the App Store or Google Play.',
    tag: 'Mobile App',
    link: `/${lang}/download-application`,
    linkText: 'Download Now',
    gradientLight: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
    gradientDark: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
  }
];

export default function HeroCarousel({ lang }: { lang: string }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const slides = getSlides(lang);

  useEffect(() => {
    if (isPaused) return;
    
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 10000);
    
    return () => clearInterval(timer);
  }, [slides.length, isPaused]);

  return (
    <div 
      className="w-full relative h-[250px] sm:h-[280px] md:h-[320px] lg:h-[360px] rounded-2xl overflow-hidden shadow-xs border border-border mb-8 group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {slides.map((slide, index) => {
        const isActive = index === currentSlide;
        
        return (
          <div
            key={slide.id}
            className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
            aria-hidden={!isActive}
          >
            <div className="w-full h-full flex items-center justify-center relative">
              {/* Background Gradient */}
              <div 
                className="absolute inset-0 w-full h-full opacity-100 dark:opacity-80 transition-opacity duration-300"
                style={{ background: slide.gradientLight }}
              />
              <div 
                className="absolute inset-0 w-full h-full opacity-0 dark:opacity-100 transition-opacity duration-300"
                style={{ background: slide.gradientDark }}
              />
              
              {/* Decorative Pattern / Texture */}
              <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent pointer-events-none"></div>

              {/* Content */}
              <div className="relative z-10 w-full px-6 sm:px-12 lg:px-16 flex items-center justify-between h-full text-white">
                
                {/* Left Side: Text Content */}
                <div className="flex flex-col items-start justify-center flex-1 max-w-2xl lg:max-w-4xl pr-4 lg:pr-8">
                  <span className="inline-block px-2.5 py-1 mb-2 sm:mb-2 text-[10px] sm:text-xs font-bold tracking-wider uppercase rounded-full bg-white/20 backdrop-blur-md border border-white/30 shadow-sm text-white">
                    {slide.tag}
                  </span>
                  <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-[36px] font-black mb-1 sm:mb-1.5 drop-shadow-lg tracking-tight leading-tight">
                    {slide.title}
                  </h2>
                  {slide.subtitle && (
                    <h3 className="text-xs sm:text-sm md:text-sm lg:text-base font-bold mb-1.5 sm:mb-2 text-cyan-100 drop-shadow-md tracking-wide">
                      {slide.subtitle}
                    </h3>
                  )}
                  <p className="text-[10px] sm:text-xs md:text-xs lg:text-sm mb-3 sm:mb-4 max-w-2xl text-white/95 drop-shadow-md font-medium leading-relaxed">
                    {slide.description}
                  </p>
                  <Link 
                    href={slide.link}
                    className="group/btn inline-flex items-center justify-center px-4 py-2 sm:px-6 sm:py-2.5 text-[10px] sm:text-xs font-bold rounded-xl bg-white text-gray-900 hover:bg-gray-50 transition-all duration-300 shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] hover:-translate-y-0.5"
                    tabIndex={isActive ? 0 : -1}
                  >
                    {slide.linkText}
                    <i className="fa-solid fa-arrow-right ml-2 text-[8px] sm:text-[10px] transition-transform group-hover/btn:translate-x-1" />
                  </Link>
                </div>

                {/* Right Side: Abstract App Mockup / Illustrations */}
                {slide.id === 'marketing-1' && (
                  <div className="hidden md:flex justify-end pl-4 lg:pl-8 relative h-full items-center">
                    {/* Glassmorphic App Mockup */}
                    <div className="relative w-48 lg:w-60 h-[240px] lg:h-[290px] bg-white/10 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl p-3 lg:p-4 flex flex-col gap-2.5 lg:gap-3 transform -rotate-3 hover:rotate-0 transition-transform duration-700 ease-out mt-2 lg:mt-4">
                      {/* App Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 shadow-inner"></div>
                          <div className="w-14 lg:w-16 h-2 lg:h-3 rounded-full bg-white/30"></div>
                        </div>
                        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                          <i className="fa-solid fa-bell text-[8px] text-white"></i>
                        </div>
                      </div>
                      
                      {/* Price Chart Area */}
                      <div className="w-full h-20 lg:h-24 rounded-xl bg-gradient-to-br from-white/20 to-white/5 border border-white/10 p-2 lg:p-3 flex flex-col justify-between relative overflow-hidden">
                        <div className="w-12 lg:w-14 h-2 lg:h-2.5 rounded-full bg-white/40 mb-1"></div>
                        <div className="text-base lg:text-lg font-bold text-white">$3XX.00</div>
                        <div className="text-[8px] lg:text-[9px] text-emerald-300 flex items-center gap-1"><i className="fa-solid fa-arrow-trend-up"></i> + $2.X today</div>
                        {/* Fake chart line */}
                        <svg className="absolute bottom-0 left-0 w-full h-8 lg:h-10 opacity-50" viewBox="0 0 100 30" preserveAspectRatio="none">
                          <path d="M0,30 L10,20 L30,25 L50,10 L70,15 L90,5 L100,0 L100,30 Z" fill="rgba(255,255,255,0.2)" />
                          <path d="M0,30 L10,20 L30,25 L50,10 L70,15 L90,5 L100,0" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" />
                        </svg>
                      </div>

                      {/* Info Cards */}
                      <div className="flex gap-2">
                        <div className="flex-1 h-14 lg:h-16 rounded-xl bg-white/10 border border-white/10 p-2 flex flex-col justify-center items-center">
                           <i className="fa-solid fa-ship text-cyan-200 mb-1 text-xs lg:text-sm"></i>
                           <div className="w-6 lg:w-8 h-1 lg:h-1.5 rounded-full bg-white/40 mt-1"></div>
                        </div>
                        <div className="flex-1 h-14 lg:h-16 rounded-xl bg-white/10 border border-white/10 p-2 flex flex-col justify-center items-center">
                           <i className="fa-solid fa-file-invoice text-blue-200 mb-1 text-xs lg:text-sm"></i>
                           <div className="w-6 lg:w-8 h-1 lg:h-1.5 rounded-full bg-white/40 mt-1"></div>
                        </div>
                      </div>

                      {/* Floating Badges */}
                      <div className="absolute -right-4 lg:-right-6 top-8 bg-emerald-500/90 backdrop-blur-md text-white text-[8px] lg:text-[9px] font-bold px-2 py-1.5 lg:px-3 lg:py-2 rounded-lg shadow-xl border border-white/20 flex items-center gap-1.5 animate-bounce-slow">
                        <i className="fa-solid fa-tags text-yellow-300"></i> Product Price
                      </div>
                      <div className="absolute -left-6 lg:-left-8 top-10 bg-purple-600/90 backdrop-blur-md text-white text-[8px] lg:text-[9px] font-bold px-2 py-1.5 lg:px-3 lg:py-2 rounded-lg shadow-xl border border-white/20 flex items-center gap-1.5">
                        <i className="fa-solid fa-file-contract text-pink-300"></i> Smart Docs
                      </div>
                      <div className="absolute -right-2 lg:-right-4 bottom-20 lg:bottom-24 bg-blue-500/90 backdrop-blur-md text-white text-[8px] lg:text-[9px] font-bold px-2 py-1.5 lg:px-3 lg:py-2 rounded-lg shadow-xl border border-white/20 flex items-center gap-1.5 animate-bounce-slow" style={{ animationDelay: '1s' }}>
                        <i className="fa-solid fa-ship text-cyan-200"></i> Live Freight
                      </div>
                      <div className="absolute -left-4 lg:-left-6 bottom-6 lg:bottom-8 bg-indigo-600/90 backdrop-blur-md text-white text-[8px] lg:text-[9px] font-bold px-2 py-1.5 lg:px-3 lg:py-2 rounded-lg shadow-xl border border-white/20 flex items-center gap-1.5">
                        <i className="fa-solid fa-earth-americas text-cyan-200"></i> Global Agri Trade
                      </div>
                    </div>
                  </div>
                )}

                {slide.id === 'features-1' && (
                  <div className="hidden md:flex justify-end pl-4 lg:pl-8 relative h-full items-center">
                    {/* Glassmorphic Solutions Mockup */}
                    <div className="relative w-48 lg:w-60 h-[240px] lg:h-[290px] bg-white/10 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl p-3 lg:p-4 flex flex-col justify-between transform rotate-2 hover:rotate-0 transition-transform duration-700 ease-out mt-2 lg:mt-4">
                      {/* Card Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full bg-gradient-to-tr from-teal-400 to-cyan-500 shadow-inner flex items-center justify-center">
                            <i className="fa-solid fa-layer-group text-[8px] lg:text-[10px] text-white"></i>
                          </div>
                          <span className="text-[8px] lg:text-[10px] font-bold text-white tracking-wider">CORE SOLUTIONS</span>
                        </div>
                        <div className="w-4 h-4 lg:w-5 lg:h-5 rounded-full bg-white/20 flex items-center justify-center">
                          <i className="fa-solid fa-check-double text-[8px] text-white"></i>
                        </div>
                      </div>
                      
                      {/* 3 Main Solutions List */}
                      <div className="flex flex-col gap-2 lg:gap-2.5 my-auto">
                        <div className="w-full bg-white/10 border border-white/10 rounded-xl p-1.5 lg:p-2 flex items-center gap-2">
                          <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                            <i className="fa-solid fa-tags text-cyan-200 text-[8px] lg:text-[10px]"></i>
                          </div>
                          <div className="overflow-hidden">
                            <div className="text-[9px] lg:text-[10px] font-bold text-white truncate">Live Product Prices</div>
                            <div className="text-[8px] lg:text-[9px] text-white/70 truncate">FOB, CNF/CFR & CIF</div>
                          </div>
                        </div>

                        <div className="w-full bg-white/10 border border-white/10 rounded-xl p-1.5 lg:p-2 flex items-center gap-2">
                          <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                            <i className="fa-solid fa-ship text-blue-200 text-[8px] lg:text-[10px]"></i>
                          </div>
                          <div className="overflow-hidden">
                            <div className="text-[9px] lg:text-[10px] font-bold text-white truncate">Ocean Freight Rates</div>
                            <div className="text-[8px] lg:text-[9px] text-white/70 truncate">Instant Port-to-Port</div>
                          </div>
                        </div>

                        <div className="w-full bg-white/10 border border-white/10 rounded-xl p-1.5 lg:p-2 flex items-center gap-2">
                          <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                            <i className="fa-solid fa-file-signature text-purple-200 text-[8px] lg:text-[10px]"></i>
                          </div>
                          <div className="overflow-hidden">
                            <div className="text-[9px] lg:text-[10px] font-bold text-white truncate">Smart Documentation</div>
                            <div className="text-[8px] lg:text-[9px] text-white/70 truncate">Agri Export Automation</div>
                          </div>
                        </div>
                      </div>

                      {/* Floating Badges matching Card 1 style */}
                      <div className="absolute -right-4 lg:-right-6 top-6 bg-teal-500/90 backdrop-blur-md text-white text-[8px] lg:text-[9px] font-bold px-2 py-1.5 lg:px-3 lg:py-2 rounded-lg shadow-xl border border-white/20 flex items-center gap-1.5 animate-bounce-slow">
                        <i className="fa-solid fa-robot text-yellow-300"></i> AI Predict
                      </div>
                      <div className="absolute -left-6 lg:-left-8 top-10 bg-blue-600/90 backdrop-blur-md text-white text-[8px] lg:text-[9px] font-bold px-2 py-1.5 lg:px-3 lg:py-2 rounded-lg shadow-xl border border-white/20 flex items-center gap-1.5">
                        <i className="fa-solid fa-chart-pie text-cyan-200"></i> Market Reports
                      </div>
                      <div className="absolute -right-2 lg:-right-4 bottom-12 lg:bottom-16 bg-purple-600/90 backdrop-blur-md text-white text-[8px] lg:text-[9px] font-bold px-2 py-1.5 lg:px-3 lg:py-2 rounded-lg shadow-xl border border-white/20 flex items-center gap-1.5 animate-bounce-slow" style={{ animationDelay: '1s' }}>
                        <i className="fa-solid fa-handshake text-emerald-300"></i> Negotiation
                      </div>
                      <div className="absolute -left-4 lg:-left-6 bottom-4 bg-indigo-600/90 backdrop-blur-md text-white text-[8px] lg:text-[9px] font-bold px-2 py-1.5 lg:px-3 lg:py-2 rounded-lg shadow-xl border border-white/20 flex items-center gap-1.5">
                        <i className="fa-solid fa-bolt text-yellow-300"></i> Daily Updates
                      </div>
                    </div>
                  </div>
                )}

                {slide.id === 'membership-1' && (
                  <div className="hidden md:flex justify-end pl-4 lg:pl-8 relative h-full items-center">
                    <div className="relative w-44 lg:w-56 h-60 lg:h-72 bg-white/10 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl flex flex-col items-center justify-start pt-5 lg:pt-6 transform -rotate-3 hover:rotate-0 transition-transform duration-700 mt-2 lg:mt-4">
                      <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-tr from-slate-200 to-slate-400 shadow-[0_0_30px_rgba(203,213,225,0.4)] flex items-center justify-center border-4 border-white/20 mb-3 lg:mb-4">
                        <i className="fa-solid fa-medal text-xl lg:text-2xl text-slate-700"></i>
                      </div>
                      <h4 className="text-xl lg:text-2xl font-black text-white tracking-widest mb-1">SILVER</h4>
                      <div className="text-[10px] lg:text-xs text-slate-300 font-medium mb-3 lg:mb-4 uppercase tracking-widest">Membership</div>
                      
                      <div className="w-3/4 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent mb-3 lg:mb-4"></div>
                      
                      <div className="flex items-center gap-1.5 text-white/90 text-xs font-bold bg-white/10 px-3 py-1.5 lg:px-4 lg:py-2 rounded-full border border-white/10">
                        <i className="fa-solid fa-gift text-emerald-400"></i> 90 Days Free
                      </div>
                      
                      <div className="absolute -right-2 -bottom-3 lg:-right-4 lg:-bottom-4 bg-emerald-500 text-white text-[8px] lg:text-[10px] font-bold px-2 py-1.5 lg:px-3 lg:py-2 rounded-lg shadow-xl border border-white/20 flex items-center gap-1.5">
                        <i className="fa-solid fa-check"></i> No Credit Card
                      </div>
                    </div>
                  </div>

                )}

                {slide.id === 'app-1' && (
                  <div className="hidden md:flex justify-end pl-4 lg:pl-8 relative h-full items-center">
                    <div className="relative w-48 lg:w-60 h-[240px] lg:h-[280px] bg-white/10 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl p-3 flex flex-col gap-3 transform rotate-2 hover:rotate-0 transition-transform duration-700 ease-out mt-2 lg:mt-4">
                       <div className="w-full flex-1 bg-gradient-to-b from-white/20 to-transparent rounded-2xl flex flex-col items-center justify-center gap-3 lg:gap-4 border border-white/10 p-3 lg:p-4">
                         {/* QR Code abstraction */}
                         <div className="w-20 h-20 lg:w-24 lg:h-24 bg-white p-1.5 rounded-xl shadow-inner flex items-center justify-center">
                            <img src="/apple-qr.svg" alt="App QR Code" className="w-full h-full object-contain" />
                         </div>
                         <div className="text-center flex flex-col items-center">
                           <span className="text-[9px] lg:text-[10px] font-bold text-white/90 mb-1.5 leading-tight">Available on App Store <br/> & Google Play</span>
                           <div className="flex gap-3 text-white">
                             <i className="fa-brands fa-apple text-xl lg:text-2xl opacity-90"></i>
                             <i className="fa-brands fa-google-play text-xl lg:text-2xl opacity-90"></i>
                           </div>
                         </div>
                       </div>
                       
                       <div className="absolute -left-4 lg:-left-6 top-6 lg:top-8 bg-blue-500/90 backdrop-blur-md text-white text-[8px] lg:text-[10px] font-bold px-2 py-1.5 lg:px-3 lg:py-2 rounded-lg shadow-xl border border-white/20 flex items-center gap-1.5">
                        <i className="fa-solid fa-mobile-screen"></i> iOS & Android
                      </div>
                    </div>
                  </div>

                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Navigation Dots */}
      <div className="absolute bottom-4 sm:bottom-6 left-0 right-0 z-20 flex justify-center space-x-2 sm:space-x-3">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`h-1.5 sm:h-2 rounded-full transition-all duration-500 ease-out ${
              index === currentSlide 
                ? 'bg-white w-6 sm:w-8 shadow-[0_0_10px_rgba(255,255,255,0.8)]' 
                : 'bg-white/40 hover:bg-white/60 w-1.5 sm:w-2 hover:scale-110'
            }`}
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === currentSlide}
          />
        ))}
      </div>
    </div>
  );
}
