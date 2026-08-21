"use client";

import { useState } from "react";
import Image from "next/image";
import ProfilePictureUpload from "./ProfilePictureUpload";

type PlanTier = "SILVER" | "GOLD" | "PLATINUM";
type PlanDuration = "MONTHLY" | "YEARLY";

interface MembershipPlan {
  tier: PlanTier;
  duration: PlanDuration;
  gradientClass: string;
  icon: string;
  iconColor: string;
}

const PLANS: MembershipPlan[] = [
  {
    tier: "SILVER",
    duration: "MONTHLY",
    gradientClass: "bg-plan-silver",
    icon: "fa-star",
    iconColor: "text-gray-300",
  },
  {
    tier: "GOLD",
    duration: "YEARLY",
    gradientClass: "bg-plan-gold",
    icon: "fa-crown",
    iconColor: "text-yellow-400",
  },
  {
    tier: "PLATINUM",
    duration: "YEARLY",
    gradientClass: "bg-plan-platinum",
    icon: "fa-gem",
    iconColor: "text-sky-300",
  }
];

export default function MembershipCard() {
  const [currentPlanIndex, setCurrentPlanIndex] = useState(1); // Default to Gold

  const plan = PLANS[currentPlanIndex];

  const cyclePlan = () => {
    setCurrentPlanIndex((prev) => (prev + 1) % PLANS.length);
  };

  return (
    <div 
      onClick={cyclePlan}
      className={`relative w-full rounded-2xl ${plan.gradientClass} p-4 sm:p-5 text-white shadow-2xl overflow-hidden group cursor-pointer transition-all duration-500 hover:shadow-3xl hover:-translate-y-1 flex flex-col`}
      title="Click to cycle plan styles (Demo)"
    >
      {/* Dynamic Background Texture */}
      <div className="absolute inset-0 opacity-[0.08] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay pointer-events-none z-0"></div>

      {/* Prominent Logo Watermark at Center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 opacity-15 pointer-events-none z-0 flex items-center justify-center">
         <img src="/logo.svg" alt="Logo Watermark" className="w-full h-full object-contain grayscale drop-shadow-lg" />
      </div>

      <div className="relative z-10 flex flex-col">
        {/* Header Section */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <h3 className="text-2xl sm:text-3xl font-black drop-shadow-lg flex items-center gap-2 tracking-wide text-white">
              {plan.tier} <i className={`fa-solid ${plan.icon} text-xl sm:text-2xl ${plan.iconColor} drop-shadow-md`}></i>
            </h3>
            <p className="text-white text-xs uppercase tracking-[0.2em] font-extrabold drop-shadow-md flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"></span> {plan.duration} MEMBERSHIP
            </p>
          </div>
          
          <div className="relative z-20" onClick={(e) => e.stopPropagation()}>
            <ProfilePictureUpload />
          </div>
        </div>

        {/* Account ID */}
        <div className="mt-3 sm:mt-4 mb-3 sm:mb-4">
          <p className="text-white/80 text-[10px] uppercase tracking-widest font-bold mb-1 drop-shadow-sm">Account ID</p>
          <p className="font-mono text-xl sm:text-2xl tracking-[0.2em] drop-shadow-lg font-bold text-white">AG2606110092</p>
        </div>
      </div>

      {/* Footer Section */}
      <div className="flex justify-between items-end pt-3 border-t border-white/20 relative z-10">
        <div>
          <p className="text-white/80 text-[10px] uppercase tracking-[0.15em] font-bold mb-0.5 drop-shadow-sm">Member Name</p>
          <p className="font-bold tracking-widest drop-shadow-lg text-sm sm:text-base text-white uppercase">JOHN DOE</p>
        </div>
        <div className="text-right">
          <p className="text-white/80 text-[10px] uppercase tracking-[0.15em] font-bold mb-0.5 drop-shadow-sm">Valid Thru</p>
          <p className="font-bold tracking-wider drop-shadow-lg text-sm sm:text-base text-white">24 OCT 2027</p>
        </div>
      </div>
      
      {/* Tooltip hint */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300 backdrop-blur-sm z-20">
         <span className="text-white font-bold tracking-widest text-sm border border-white/40 px-5 py-2.5 rounded-full bg-black/40 shadow-xl">Click to preview tiers</span>
      </div>
    </div>
  );
}
