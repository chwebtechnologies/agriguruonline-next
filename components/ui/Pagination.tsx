'use client'

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
}

export function Pagination({ currentPage, totalPages, baseUrl }: PaginationProps) {
  const router = useRouter();

  if (totalPages <= 1) return null;

  // Calculate page range to show (max 5 pages)
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);

  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  const warmPage = (pageNumber: number) => {
    try {
      router.prefetch(`${baseUrl}?page=${pageNumber}`);
    } catch {}
  };

  const handlePageClick = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  return (
    <div className="flex justify-center items-center space-x-1 sm:space-x-2 mt-8">
      {/* Previous Button */}
      {currentPage > 1 ? (
        <Link
          href={`${baseUrl}?page=${currentPage - 1}`}
          prefetch={true}
          scroll={true}
          onClick={handlePageClick}
          onPointerEnter={() => warmPage(currentPage - 1)}
          onTouchStart={() => warmPage(currentPage - 1)}
          className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl border border-border bg-card text-foreground hover:bg-brand-blue hover:text-white hover:border-brand-blue transition-colors duration-200 shadow-2xs cursor-pointer"
          aria-label="Previous page"
        >
          <i className="fa-solid fa-chevron-left text-xs sm:text-sm"></i>
        </Link>
      ) : (
        <span className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl border border-border bg-card/50 text-foreground/30 cursor-not-allowed">
          <i className="fa-solid fa-chevron-left text-xs sm:text-sm"></i>
        </span>
      )}

      {/* Page Numbers */}
      {startPage > 1 && (
        <>
          <Link
            href={`${baseUrl}?page=1`}
            prefetch={true}
            scroll={true}
            onClick={handlePageClick}
            onPointerEnter={() => warmPage(1)}
            onTouchStart={() => warmPage(1)}
            className="hidden sm:flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-card text-foreground hover:bg-brand-blue hover:text-white hover:border-brand-blue transition-colors duration-200 font-bold shadow-2xs cursor-pointer"
          >
            1
          </Link>
          {startPage > 2 && <span className="hidden sm:flex items-center justify-center w-10 h-10 text-foreground/50 font-bold">...</span>}
        </>
      )}

      {pages.map((page) => (
        <Link
          key={page}
          href={`${baseUrl}?page=${page}`}
          prefetch={true}
          scroll={true}
          onClick={handlePageClick}
          onPointerEnter={() => warmPage(page)}
          onTouchStart={() => warmPage(page)}
          className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl border transition-colors duration-200 font-bold text-sm shadow-2xs cursor-pointer ${
            currentPage === page
              ? 'bg-brand-blue text-white border-brand-blue shadow-sm'
              : 'border-border bg-card text-foreground hover:bg-brand-blue/10 hover:border-brand-blue/50'
          }`}
          aria-current={currentPage === page ? 'page' : undefined}
        >
          {page}
        </Link>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="hidden sm:flex items-center justify-center w-10 h-10 text-foreground/50 font-bold">...</span>}
          <Link
            href={`${baseUrl}?page=${totalPages}`}
            prefetch={true}
            scroll={true}
            onClick={handlePageClick}
            onPointerEnter={() => warmPage(totalPages)}
            onTouchStart={() => warmPage(totalPages)}
            className="hidden sm:flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-card text-foreground hover:bg-brand-blue hover:text-white hover:border-brand-blue transition-colors duration-200 font-bold shadow-2xs cursor-pointer"
          >
            {totalPages}
          </Link>
        </>
      )}

      {/* Next Button */}
      {currentPage < totalPages ? (
        <Link
          href={`${baseUrl}?page=${currentPage + 1}`}
          prefetch={true}
          scroll={true}
          onClick={handlePageClick}
          onPointerEnter={() => warmPage(currentPage + 1)}
          onTouchStart={() => warmPage(currentPage + 1)}
          className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl border border-border bg-card text-foreground hover:bg-brand-blue hover:text-white hover:border-brand-blue transition-colors duration-200 shadow-2xs cursor-pointer"
          aria-label="Next page"
        >
          <i className="fa-solid fa-chevron-right text-xs sm:text-sm"></i>
        </Link>
      ) : (
        <span className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl border border-border bg-card/50 text-foreground/30 cursor-not-allowed">
          <i className="fa-solid fa-chevron-right text-xs sm:text-sm"></i>
        </span>
      )}
    </div>
  );
}
