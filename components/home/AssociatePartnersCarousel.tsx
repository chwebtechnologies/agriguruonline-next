'use client';

import { useState, useEffect, useRef } from 'react';
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton';
import type { AssociatePartner } from '@/types/associatePartners';
import { getAssetsUrl } from '@/lib/api-utils';

export default function AssociatePartnersCarousel({
  partners,
}: {
  partners: AssociatePartner[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  
  // We duplicate the list to create a seamless infinite scrolling effect.
  const duplicatedPartners = [...partners, ...partners];

  return (
    <div className="w-full overflow-hidden py-6 group relative" dir="ltr">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}} />
      {/* Left & Right Smooth Edge Fade Masks */}
      <div className="absolute top-0 left-0 w-8 sm:w-16 h-full z-10 pointer-events-none bg-gradient-to-r from-background to-transparent" />
      <div className="absolute top-0 right-0 w-8 sm:w-16 h-full z-10 pointer-events-none bg-gradient-to-l from-background to-transparent" />

      {/* We need width max-content and double the elements to scroll 50% seamlessly */}
      <div 
        ref={trackRef}
        className="flex w-[max-content] animate-marquee"
      >
        {duplicatedPartners.map((partner, index) => {
          const getImageUrl = (imagePath: string) => {
            if (!imagePath) return '/logo.webp';
            if (imagePath.startsWith('http')) return imagePath;
            const assetsUrl = getAssetsUrl();
            const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`;
            return `${imageBaseUrl}${imagePath}`;
          };
          const imageUrl = getImageUrl(partner.image);

          return (
            <div key={`${partner.id}-${index}`} className="px-3 sm:px-4">
              <a
                href={partner.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center justify-center bg-white border border-border/50 rounded-2xl w-[120px] h-[120px] sm:w-[150px] sm:h-[150px] p-4 shadow-sm hover:shadow-md hover:border-primary/50 hover:-translate-y-1 transition-all duration-300"
              >
                {partner.image ? (
                  <div className="relative w-full h-full grayscale hover:grayscale-0 transition-all duration-300">
                    <ImageWithSkeleton
                      src={imageUrl}
                      alt={partner.title || 'Associate Partner'}
                      fill
                      className="object-contain"
                      sizes="(max-width: 640px) 120px, 150px"
                      priority={index < 6}
                    />
                  </div>
                ) : (
                  <span className="text-center text-xs text-muted-foreground font-medium">{partner.title}</span>
                )}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
