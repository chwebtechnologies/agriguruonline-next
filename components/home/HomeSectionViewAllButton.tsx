'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setLastHomeSection } from '@/lib/watchlist-utils';

interface HomeSectionViewAllButtonProps {
  href: string;
  sectionId: string;
  label: string;
  className?: string;
  iconClassName?: string;
}

export function HomeSectionViewAllButton({
  href,
  sectionId,
  label,
  className,
  iconClassName = "fa-solid fa-arrow-right ml-2 text-[10px] sm:text-xs"
}: HomeSectionViewAllButtonProps) {
  const router = useRouter();

  return (
    <Link
      href={href}
      prefetch={true}
      onPointerEnter={() => {
        try {
          router.prefetch(href);
        } catch {}
      }}
      onTouchStart={() => {
        try {
          router.prefetch(href);
        } catch {}
      }}
      onClick={() => {
        setLastHomeSection(sectionId);
      }}
      className={
        className ||
        "inline-flex items-center justify-center px-4 py-2 sm:px-5 sm:py-2.5 md:px-6 md:py-3 text-sm md:text-base rounded-xl bg-primary text-white font-bold hover:bg-primary-hover transition-colors shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer active:scale-95"
      }
    >
      {label} <i className={iconClassName}></i>
    </Link>
  );
}
