import React from 'react';
import Image from 'next/image';

interface FlagIconProps {
  src?: string | null;
  alt?: string;
  title?: string;
  className?: string;
  width?: number;
  height?: number;
}

export function FlagIcon({ 
  src, 
  alt = "", 
  title, 
  className = "w-5 h-3.5 rounded-[2px]", 
  width = 24, 
  height = 16 
}: FlagIconProps) {
  if (!src) return null;
  
  return (
    <Image
      src={src}
      alt={alt}
      title={title || alt}
      width={width}
      height={height}
      className={`object-cover shrink-0 ${className}`}
      unoptimized={src.startsWith('data:') || src.startsWith('blob:')}
    />
  );
}
