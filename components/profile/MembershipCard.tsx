"use client";

import React, { useState } from 'react';
import Image from 'next/image';
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

interface MembershipCardProps {
  profileData?: any;
  dict?: any;
}

export default function MembershipCard({ profileData = null, dict = {} }: MembershipCardProps) {
  // Determine tier from profileData using specific API keys
  let currentTier = "SILVER";
  const planName = String(profileData?.membership?.plan_name || profileData?.plan_name || "SILVER").toUpperCase();
  
  if (planName.includes('GOLD')) currentTier = 'GOLD';
  else if (planName.includes('PLATINUM')) currentTier = 'PLATINUM';
  else if (planName.includes('SILVER')) currentTier = 'SILVER';

  // Find the base plan settings
  const basePlan = PLANS.find(p => p.tier === currentTier) || PLANS[0];
  
  // Override duration based on API (e.g. YEARLY / MONTHLY)
  const planType = String(profileData?.membership?.plan_type || profileData?.plan_type || basePlan.duration).toUpperCase();
  const displayDuration = planType.includes('YEAR') ? 'YEARLY' : (planType.includes('MONTH') ? 'MONTHLY' : basePlan.duration);

  // Combine to create the final plan object
  const plan = {
    ...basePlan,
    duration: displayDuration as "MONTHLY" | "YEARLY"
  };

  const memberName = profileData?.first_name 
    ? `${profileData.first_name} ${profileData.last_name || ''}`.trim()
    : profileData?.name || "N/A";
    
  // Account ID key in api is customer_id
  const accountId = profileData?.customer_id || dict?.common?.not_available || "N/A";
  
  // Expiry date key in api is membership_expiry_date (either inside membership object or root)
  let validThru = dict?.common?.not_available || "N/A";
  const expiry = profileData?.membership?.membership_expiry_date || profileData?.membership_expiry_date;
  
  if (expiry) {
    try {
      const date = new Date(expiry);
      validThru = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    } catch(e) {
      validThru = expiry;
    }
  } else if (profileData?.created_at) {
    try {
      const date = new Date(profileData.created_at);
      date.setFullYear(date.getFullYear() + 1);
      validThru = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    } catch(e) {}
  }

  return (
    <div 
      className={`relative w-full rounded-2xl ${plan.gradientClass} p-4 sm:p-5 text-white shadow-2xl overflow-hidden flex flex-col`}
    >
      {/* Dynamic Background Texture */}
      <div className="absolute inset-0 opacity-[0.08] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay pointer-events-none z-0"></div>

      {/* Prominent Logo Watermark at Center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 opacity-15 pointer-events-none z-0 flex items-center justify-center">
         <Image src="/logo.webp" alt="AgriGuru Online Logo Watermark" title="AgriGuru Online Logo Watermark" fill sizes="(max-width: 640px) 192px, 256px" className="object-contain grayscale drop-shadow-lg" />
      </div>

      <div className="relative z-10 flex flex-col">
        {/* Header Section */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <h3 className="text-2xl sm:text-3xl font-black drop-shadow-lg flex items-center gap-2 tracking-wide text-white">
              {plan.tier} <i className={`fa-solid ${plan.icon} text-xl sm:text-2xl ${plan.iconColor} drop-shadow-md`}></i>
            </h3>
            <p className="text-white text-xs uppercase tracking-[0.2em] font-extrabold drop-shadow-md flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"></span> {dict?.profile?.[plan.duration.toLowerCase()] || plan.duration} {dict?.profile?.membership || "MEMBERSHIP"}
            </p>
          </div>
          
          <div className="relative z-20" onClick={(e) => e.stopPropagation()}>
            <ProfilePictureUpload currentImage={profileData?.profile_image} />
          </div>
        </div>

        {/* Account ID */}
        <div className="mt-3 sm:mt-4 mb-3 sm:mb-4">
          <p className="text-white/80 text-[10px] uppercase tracking-widest font-bold mb-1 drop-shadow-sm">{dict?.profile?.account_id || "Account ID"}</p>
          <p className="font-mono text-xl sm:text-2xl tracking-[0.2em] drop-shadow-lg font-bold text-white">{accountId}</p>
        </div>
      </div>

      <div className="flex justify-between items-end pt-3 border-t border-white/20 relative z-10">
        <div>
          <p className="text-white/80 text-[10px] uppercase tracking-[0.15em] font-bold mb-0.5 drop-shadow-sm">{dict?.profile?.member_name || "Member Name"}</p>
          <p className="font-bold tracking-widest drop-shadow-lg text-sm sm:text-base text-white uppercase truncate max-w-[150px] sm:max-w-[180px]">{memberName}</p>
        </div>
        <div className="text-right">
          <p className="text-white/80 text-[10px] uppercase tracking-[0.15em] font-bold mb-0.5 drop-shadow-sm">{dict?.profile?.valid_thru || "Valid Thru"}</p>
          <p className="font-bold tracking-wider drop-shadow-lg text-sm sm:text-base text-white">{validThru}</p>
        </div>
      </div>
      
    </div>
  );
}
