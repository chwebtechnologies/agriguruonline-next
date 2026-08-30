import React from 'react';
import Image from 'next/image';

interface IPhoneFrameProps {
  children?: React.ReactNode;
  className?: string;
  imageSrc?: string;
  priority?: boolean;
}

export function IPhoneFrame({ children, className = '', imageSrc = '/top-middle.webp', priority = false }: IPhoneFrameProps) {
  return (
    <div className={`relative mx-auto bg-[#1a1a1c] border-[5px] sm:border-[8px] md:border-[10px] border-[#1a1a1c] rounded-[1.8rem] sm:rounded-[2.4rem] md:rounded-[2.8rem] shadow-2xl ring-1 ring-white/10 shrink-0 select-none overflow-hidden ${className}`}>
      
      {/* Dynamic Island / Notch */}
      <div className="absolute top-1 sm:top-2 left-1/2 -translate-x-1/2 w-12 sm:w-20 h-2.5 sm:h-4 bg-[#1a1a1c] rounded-full z-20 flex justify-end items-center pr-1 sm:pr-2 pointer-events-none">
        <div className="w-1 sm:w-2 h-1 sm:h-2 rounded-full bg-black border border-white/10"></div>
      </div>

      {/* Screen Area */}
      <div className="relative w-full h-full rounded-[1.4rem] sm:rounded-[2rem] md:rounded-[2.2rem] overflow-hidden bg-black">
        {children ? (
          children
        ) : (
          <Image
            src={imageSrc}
            alt="AgriGuru Mobile App"
            fill
            className="object-cover object-top"
            priority={priority}
            sizes="(max-width: 640px) 200px, 320px"
            quality={85}
          />
        )}
      </div>
    </div>
  );
}
