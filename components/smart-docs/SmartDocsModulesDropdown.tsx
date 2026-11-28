'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface SmartDocsModulesDropdownProps {
  lang: string;
  dict?: any;
  className?: string;
}

export function SmartDocsModulesDropdown({
  lang = 'en',
  dict,
  className = '',
}: SmartDocsModulesDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const pathname = usePathname();

  // 4 Smart Docs Modules in required exact sequence
  const modules = [
    {
      id: 'sellers',
      label:
        dict?.smart_docs?.seller_exporter_module ||
        dict?.smart_docs?.seller_module ||
        'Seller (Exporter) Module',
      href: `/${lang}/smart-docs/sellers`,
      icon: 'fa-solid fa-user-tie',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/40',
    },
    {
      id: 'buyers',
      label:
        dict?.smart_docs?.buyer_importer_module ||
        dict?.smart_docs?.buyer_module ||
        'Buyer (Importer) Module',
      href: `/${lang}/smart-docs/buyers`,
      icon: 'fa-solid fa-cart-shopping',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      id: 'products',
      label:
        dict?.smart_docs?.product_module ||
        dict?.smart_docs?.products_module ||
        'Product Module',
      href: `/${lang}/smart-docs/products`,
      icon: 'fa-solid fa-boxes-stacked',
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-50 dark:bg-amber-950/40',
    },
    {
      id: 'payment-terms',
      label:
        dict?.smart_docs?.payment_term_module ||
        dict?.smart_docs?.payment_terms_module ||
        'Payment Term Module',
      href: `/${lang}/smart-docs/payment-terms`,
      icon: 'fa-solid fa-file-invoice-dollar',
      iconColor: 'text-teal-600 dark:text-teal-400',
      iconBg: 'bg-teal-50 dark:bg-teal-950/40',
    },
  ];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative group shrink-0 ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Modules Trigger Button (styled to match table toolbar controls) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={menuId}
        className={`h-8 sm:h-8.5 px-3 sm:px-3.5 rounded-md border text-xs font-semibold inline-flex items-center gap-1.5 transition-all select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-blue shadow-2xs active:scale-95 ${
          isOpen
            ? 'bg-muted border-brand-blue/50 text-foreground ring-1 ring-brand-blue/30'
            : 'bg-background hover:bg-muted border-border text-foreground'
        }`}
      >
        <i className="fa-solid fa-cubes text-brand-blue text-xs shrink-0" />
        <span>{dict?.smart_docs?.modules || 'Modules'}</span>
        <i
          className={`fa-solid fa-chevron-down text-[10px] text-muted-foreground transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-foreground' : 'group-hover:rotate-180'
          }`}
        />
      </button>

      {/* Floating Modules Dropdown Menu (revealed on hover or click, similar to Header Insights) */}
      <div
        id={menuId}
        role="menu"
        aria-label={dict?.smart_docs?.modules || 'Modules'}
        className={`absolute right-0 rtl:right-auto rtl:left-0 top-full mt-1.5 w-60 sm:w-64 rounded-lg bg-card border border-border p-1.5 shadow-xl transition-all duration-150 z-50 before:absolute before:-top-2 before:left-0 before:right-0 before:h-2 before:content-[''] ${
          isOpen
            ? 'opacity-100 visible scale-100 pointer-events-auto'
            : 'opacity-0 invisible scale-95 pointer-events-none'
        }`}
      >
        {/* Dropdown Header */}
        <div className="px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 mb-1 flex items-center justify-between select-none">
          <span>{dict?.smart_docs?.modules || 'Modules'}</span>
          <i className="fa-solid fa-layer-group text-[10px] text-muted-foreground/60" />
        </div>

        {/* 4 Redirection Links */}
        <div className="flex flex-col gap-0.5">
          {modules.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== `/${lang}/smart-docs` &&
                pathname?.startsWith(item.href));

            return (
              <Link
                key={item.id}
                href={item.href}
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-md transition-all text-foreground hover:bg-muted group/item ${
                  isActive ? 'bg-brand-blue/10 text-brand-blue font-bold' : ''
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-md ${item.iconBg} ${item.iconColor} flex items-center justify-center text-xs shrink-0 transition-transform group-hover/item:scale-110 shadow-2xs`}
                >
                  <i className={item.icon} />
                </div>
                <span className="truncate flex-1 text-left rtl:text-right">
                  {item.label}
                </span>
                <i className="fa-solid fa-chevron-right text-[10px] text-muted-foreground/40 group-hover/item:text-foreground group-hover/item:translate-x-0.5 rtl:rotate-180 rtl:group-hover/item:-translate-x-0.5 transition-all shrink-0 ml-1 rtl:ml-0 rtl:mr-1" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default SmartDocsModulesDropdown;
