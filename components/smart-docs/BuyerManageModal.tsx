'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import flags from 'react-phone-number-input/flags';
import { getCountries, getCountryCallingCode, parsePhoneNumber, type Country } from 'react-phone-number-input';
import en from 'react-phone-number-input/locale/en.json';
import DocSignatureBox from '@/components/smart-docs/draft/form/DocSignatureBox';
import {
  generateSmartDocsCuid,
  isValidCuidOrId,
  formatAssetUrl,
} from '@/lib/api/smart-docs.service';
import {
  deleteBuyerConsigneeAction,
  deleteBuyerNotifyPartyAction,
} from '@/app/actions/smart-docs';
import { toast } from 'sonner';

const countryNames = en as Record<string, string>;

export interface ConsigneeOrNotifyItem {
  id: string;
  is_new?: boolean;
  is_active?: boolean;
  status?: boolean | string | number;
  company_name: string;
  certificate_name_number: string;
  address: string;
  city: string;
  state: string;
  country: string;
  country_code?: string;
  country_id?: string;
  zip_code: string;
  email: string;
  contact_number: string;
  phone_country_code?: string;
}

const POPULAR_COUNTRY_CODES: Country[] = [
  'IN', 'AE', 'VN', 'BR', 'CN', 'US', 'TH', 'ID', 'SG', 'MY',
  'TR', 'EG', 'BD', 'PK', 'ZA', 'RU', 'UA', 'CA', 'AU', 'AR',
];

const POPULAR_PHONE_COUNTRY_CODES: Country[] = [
  'IN', 'AE', 'US', 'GB', 'VN', 'TH', 'CN', 'SG', 'MY', 'CA',
  'AU', 'TR', 'EG', 'BD', 'PK', 'BR', 'ZA',
];

export const renderFlag = (code?: Country | null, countryNameStr?: string) => {
  if (!code) {
    return <i className="fa-solid fa-globe text-muted-foreground text-xs shrink-0" />;
  }
  const FlagComp = flags[code];
  if (FlagComp) {
    return (
      <span className="w-4.5 h-3.5 inline-flex items-center justify-center shrink-0 overflow-hidden rounded-[2px] shadow-2xs">
        <FlagComp title={countryNameStr || code} />
      </span>
    );
  }
  return <i className="fa-solid fa-globe text-muted-foreground text-xs shrink-0" />;
};

export interface CountrySelectFieldProps {
  label?: string;
  required?: boolean;
  selectedCountryName: string;
  selectedCountryCode?: Country | null;
  selectedCountryId?: string;
  countries: any[];
  allCountries: { code: Country; name: string }[];
  onSelect: (country: { name: string; code: Country | null; id: string }) => void;
  error?: string;
  placeholder?: string;
}

export function CountrySelectField({
  label = 'Country',
  required = false,
  selectedCountryName,
  selectedCountryCode,
  selectedCountryId,
  countries,
  allCountries,
  onSelect,
  error,
  placeholder = 'Select Country',
}: CountrySelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const cleanCountryName = useMemo(() => {
    if (!selectedCountryName) return '';
    if (typeof selectedCountryName === 'object') {
      const obj = selectedCountryName as any;
      const n = obj?.name || obj?.country_name || obj?.title || obj?.label;
      if (typeof n === 'string' && n.trim() && n !== '[object Object]') return n.trim();
      return '';
    }
    const str = String(selectedCountryName).trim();
    if (str === '[object Object]' || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'null') {
      return '';
    }
    return str;
  }, [selectedCountryName]);

  const currentCode = useMemo<Country | null>(() => {
    if (selectedCountryCode && typeof selectedCountryCode === 'string') {
      const clean = selectedCountryCode.trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(clean)) return clean as Country;
    }
    if (selectedCountryId && countries?.length) {
      const match = countries.find((c: any) => String(c.id) === String(selectedCountryId));
      if (match?.iso2) return match.iso2.toUpperCase() as Country;
    }
    if (!cleanCountryName) return null;
    const match = allCountries.find(
      (c) => c.name.toLowerCase() === cleanCountryName.toLowerCase()
    );
    if (match) return match.code;
    const matchMaster = countries?.find(
      (c: any) =>
        c.name?.toLowerCase() === cleanCountryName.toLowerCase() ||
        c.iso2?.toLowerCase() === cleanCountryName.toLowerCase()
    );
    if (matchMaster?.iso2) return matchMaster.iso2.toUpperCase() as Country;
    return null;
  }, [selectedCountryCode, selectedCountryId, cleanCountryName, allCountries, countries]);

  const displayCountryText = useMemo(() => {
    if (cleanCountryName) return cleanCountryName;
    if (currentCode) {
      const match = allCountries.find((c) => c.code === currentCode);
      if (match?.name) return match.name;
    }
    if (selectedCountryId && countries?.length) {
      const match = countries.find((c: any) => String(c.id) === String(selectedCountryId));
      if (match?.name) return match.name;
    }
    return '';
  }, [cleanCountryName, currentCode, selectedCountryId, allCountries, countries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allCountries;
    return allCountries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [allCountries, search]);

  const handleChoose = (item: { code: Country; name: string }) => {
    let rawCountryId = '';
    const match = countries?.find(
      (c: any) =>
        (item.code && c.iso2?.toUpperCase() === item.code.toUpperCase()) ||
        (item.name && c.name?.toLowerCase() === item.name.toLowerCase())
    );
    if (match?.id) rawCountryId = match.id;

    onSelect({
      name: item.name,
      code: item.code,
      id: rawCountryId,
    });
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="flex flex-col gap-1.5 relative" ref={dropdownRef}>
      <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <span>{label}</span>
        {required && <span className="text-destructive">*</span>}
      </label>

      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setTimeout(() => searchInputRef.current?.focus(), 50);
        }}
        className={`w-full h-10 px-3 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none flex items-center justify-between text-left transition-colors cursor-pointer ${
          error
            ? 'border-destructive focus:ring-1 focus:ring-destructive'
            : isOpen
            ? 'border-primary ring-1 ring-primary'
            : 'border-border hover:border-muted-foreground/50'
        }`}
      >
        <span className="flex items-center gap-2 truncate">
          {renderFlag(currentCode, displayCountryText)}
          <span
            className={`truncate ${
              displayCountryText ? 'text-foreground font-medium' : 'text-muted-foreground'
            }`}
          >
            {displayCountryText || placeholder}
          </span>
        </span>
        <i
          className={`fa-solid fa-chevron-down text-[10px] text-muted-foreground transition-transform shrink-0 ${
            isOpen ? 'rotate-180 text-brand-blue' : ''
          }`}
        />
      </button>

      {error && (
        <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
          <i className="fa-solid fa-circle-exclamation text-[10px]" />
          <span>{error}</span>
        </span>
      )}

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col max-h-60 animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="p-2 border-b border-border bg-muted/30 sticky top-0 z-10">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country..."
                className="w-full h-8 pl-8 pr-7 text-xs bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground outline-none focus:border-brand-blue transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto custom-scrollbar flex-1 p-1">
            {!search.trim() && (
              <div className="mb-1 pb-1 border-b border-border/50">
                <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Popular Countries
                </div>
                {POPULAR_COUNTRY_CODES.map((code) => {
                  const cname = countryNames[code] || code;
                  const isSelected = selectedCountryName?.toLowerCase() === cname.toLowerCase();
                  return (
                    <button
                      key={`pop-country-${code}`}
                      type="button"
                      onClick={() => handleChoose({ code, name: cname })}
                      className={`w-full px-2.5 py-1.5 rounded-md flex items-center justify-between text-left text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        {renderFlag(code, cname)}
                        <span className="truncate">{cname}</span>
                      </span>
                      {isSelected && (
                        <i className="fa-solid fa-check text-[11px] text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {filtered.map((c) => {
              const isSelected = selectedCountryName?.toLowerCase() === c.name.toLowerCase();
              return (
                <button
                  key={`all-country-${c.code}`}
                  type="button"
                  onClick={() => handleChoose(c)}
                  className={`w-full px-2.5 py-1.5 rounded-md flex items-center justify-between text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {renderFlag(c.code, c.name)}
                    <span className="truncate">{c.name}</span>
                  </span>
                  {isSelected && (
                    <i className="fa-solid fa-check text-[11px] text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export interface PhoneInputFieldProps {
  label?: string;
  required?: boolean;
  phoneCountryCode: string;
  contactNumber: string;
  allPhoneCountries: { code: Country; name: string; callingCode: string }[];
  onChange: (data: { phoneCountryCode: string; contactNumber: string }) => void;
  error?: string;
  placeholder?: string;
}

export function PhoneInputField({
  label = 'Contact Number',
  required = false,
  phoneCountryCode,
  contactNumber,
  allPhoneCountries,
  onChange,
  error,
  placeholder = 'Phone / Mobile number',
}: PhoneInputFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const phoneCountry = useMemo<Country | null>(() => {
    if (!phoneCountryCode) return null;
    const trimmed = String(phoneCountryCode).trim();
    if (!trimmed || trimmed === '[object Object]' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') return null;

    // 1. If it's a 2-letter ISO code e.g. 'IN', 'US'
    if (/^[A-Za-z]{2}$/.test(trimmed)) {
      const match = allPhoneCountries.find((c) => c.code.toLowerCase() === trimmed.toLowerCase());
      if (match) return match.code;
    }

    // 2. If it's a calling code e.g. '+91' or '91'
    const cleanCode = trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
    const matched = allPhoneCountries.find((c) => c.callingCode === cleanCode);
    return matched?.code || null;
  }, [phoneCountryCode, allPhoneCountries]);

  const displayCallingCode = useMemo(() => {
    if (!phoneCountryCode) return '';
    const trimmed = String(phoneCountryCode).trim();
    if (!trimmed || trimmed === '[object Object]' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') return '';
    if (trimmed.startsWith('+')) return trimmed;
    if (/^\d+$/.test(trimmed)) return `+${trimmed}`;
    if (phoneCountry) {
      try {
        const calling = getCountryCallingCode(phoneCountry);
        if (calling) return `+${calling}`;
      } catch {}
    }
    return '';
  }, [phoneCountryCode, phoneCountry]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allPhoneCountries;
    const qClean = q.replace(/^\+/, '');
    return allPhoneCountries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.callingCode.replace(/^\+/, '').includes(qClean)
    );
  }, [allPhoneCountries, search]);

  const handleSelectCode = (c: { code: Country; name: string; callingCode: string } | null) => {
    onChange({
      phoneCountryCode: c?.callingCode || '',
      contactNumber,
    });
    setIsOpen(false);
    setSearch('');
  };

  const handleNumberChange = (raw: string) => {
    onChange({
      phoneCountryCode: displayCallingCode || phoneCountryCode,
      contactNumber: raw.replace(/[^\d\s-]/g, ''),
    });
  };

  return (
    <div className="flex flex-col gap-1.5 relative">
      <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <span>{label}</span>
        {required && <span className="text-destructive">*</span>}
      </label>

      <div
        className={`w-full h-10 bg-background border rounded-lg flex items-center transition-colors ${
          error
            ? 'border-destructive ring-1 ring-destructive'
            : isOpen
            ? 'border-primary ring-1 ring-primary'
            : 'border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary'
        }`}
      >
        {/* Dial Code Button with Popover */}
        <div className="relative h-full shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => {
              setIsOpen((prev) => !prev);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            className="h-full px-2.5 flex items-center gap-1.5 hover:bg-muted/60 text-foreground transition-colors border-r border-border rounded-l-lg outline-none select-none cursor-pointer shrink-0 whitespace-nowrap"
            title="Select Country Calling Code"
          >
            {phoneCountry ? (
              renderFlag(phoneCountry, countryNames[phoneCountry])
            ) : (
              <i className="fa-solid fa-globe text-muted-foreground text-xs shrink-0" />
            )}
            <span className="text-xs font-semibold text-foreground tracking-tight shrink-0 whitespace-nowrap">
              {displayCallingCode || '+ --'}
            </span>
            <i
              className={`fa-solid fa-chevron-down text-[9px] text-muted-foreground transition-transform shrink-0 ${
                isOpen ? 'rotate-180 text-brand-blue' : ''
              }`}
            />
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col max-h-64 animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="p-2 border-b border-border bg-muted/30 sticky top-0 z-10">
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search country or code..."
                    className="w-full h-8 pl-8 pr-7 text-xs bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground outline-none focus:border-brand-blue transition-colors"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-y-auto custom-scrollbar flex-1 p-1">
                {!search.trim() && (
                  <button
                    type="button"
                    onClick={() => handleSelectCode(null)}
                    className={`w-full px-2.5 py-1.5 rounded-md flex items-center justify-between text-left text-xs transition-colors cursor-pointer mb-1 border-b border-border/40 ${
                      !phoneCountryCode
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <i className="fa-solid fa-ban text-xs" />
                      <span>No Country Code (None)</span>
                    </span>
                    {!phoneCountryCode && (
                      <i className="fa-solid fa-check text-[11px] text-primary" />
                    )}
                  </button>
                )}

                {!search.trim() && (
                  <div className="mb-1 pb-1 border-border/50 border-b">
                    <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Popular Calling Codes
                    </div>
                    {POPULAR_PHONE_COUNTRY_CODES.map((code) => {
                      const cname = countryNames[code] || code;
                      let callingCode = '';
                      try {
                        callingCode = `+${getCountryCallingCode(code)}`;
                      } catch {}
                      const isSelected = phoneCountryCode === callingCode;
                      return (
                        <button
                          key={`pop-phone-${code}`}
                          type="button"
                          onClick={() =>
                            handleSelectCode({ code, name: cname, callingCode })
                          }
                          className={`w-full px-2.5 py-1.5 rounded-md flex items-center justify-between text-left text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'hover:bg-muted text-foreground'
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            {renderFlag(code, cname)}
                            <span className="truncate">{cname}</span>
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {callingCode}
                            </span>
                            {isSelected && (
                              <i className="fa-solid fa-check text-[11px] text-primary" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {filtered.map((c) => {
                  const isSelected = phoneCountryCode === c.callingCode;
                  return (
                    <button
                      key={`all-phone-${c.code}`}
                      type="button"
                      onClick={() => handleSelectCode(c)}
                      className={`w-full px-2.5 py-1.5 rounded-md flex items-center justify-between text-left text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        {renderFlag(c.code, c.name)}
                        <span className="truncate">{c.name}</span>
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {c.callingCode}
                        </span>
                        {isSelected && (
                          <i className="fa-solid fa-check text-[11px] text-primary" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <input
          type="tel"
          value={contactNumber}
          onChange={(e) => handleNumberChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 h-full px-3 text-xs sm:text-sm bg-transparent text-foreground outline-none border-none placeholder:text-muted-foreground"
        />
      </div>

      {error && (
        <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
          <i className="fa-solid fa-circle-exclamation text-[10px]" />
          <span>{error}</span>
        </span>
      )}
    </div>
  );
}

export interface BuyerFormData {
  id?: string;
  type: 'B';
  company_name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  country_code?: string;
  country_id?: string;
  zip_code: string;
  zipcode?: string;
  email: string;
  contact_number: string;
  certificate_name_number: string;
  certificate_name_and_number?: string;
  authority_name: string;
  authorised_signature?: string;
  authority_signature?: string;
  company_logo: string;
}

export interface BuyerManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  buyer?: any | null;
  countries?: any[];
  onSaveBusiness: (
    businessData: Partial<BuyerFormData> | FormData | any
  ) => Promise<{ success: boolean; data?: any; message?: string; error_fields?: any[]; errors?: any }>;
  onSaveConsignees?: (
    consignees: ConsigneeOrNotifyItem[],
    buyerId: string
  ) => Promise<{ success: boolean; data?: any; message?: string; error_fields?: any[]; errors?: any }>;
  onSaveNotifyParties?: (
    notifyParties: ConsigneeOrNotifyItem[],
    buyerId: string
  ) => Promise<{ success: boolean; data?: any; message?: string; error_fields?: any[]; errors?: any }>;
  onFetchConsignees?: (buyerId: string) => Promise<{ success: boolean; data?: any }>;
  onFetchNotifyParties?: (buyerId: string) => Promise<{ success: boolean; data?: any }>;
  onDeleteConsignee?: (consigneeId: string) => Promise<{ success: boolean; message: string; data?: any }>;
  onDeleteNotifyParty?: (notifyPartyId: string) => Promise<{ success: boolean; message: string; data?: any }>;
  dict?: any;
  isLoading?: boolean;
}

export default function BuyerManageModal({
  isOpen,
  onClose,
  mode,
  buyer,
  countries = [],
  onSaveBusiness,
  onSaveConsignees,
  onSaveNotifyParties,
  onFetchConsignees,
  onFetchNotifyParties,
  onDeleteConsignee,
  onDeleteNotifyParty,
  dict,
  isLoading = false,
}: BuyerManageModalProps) {
  const [mounted, setMounted] = useState(false);

  // Tab State: 'business' | 'consignee' | 'notify_party'
  const [activeTab, setActiveTab] = useState<'business' | 'consignee' | 'notify_party'>('business');

  // Tracking the active buyer id
  const [savedBuyerId, setSavedBuyerId] = useState<string>('');
  const [isBusinessSaved, setIsBusinessSaved] = useState<boolean>(mode === 'edit');

  // Track existing backend records for deletion
  const [existingBackendConsigneeIds, setExistingBackendConsigneeIds] = useState<Set<string>>(new Set());
  const [existingBackendNotifyIds, setExistingBackendNotifyIds] = useState<Set<string>>(new Set());
  const [deletingConsigneeId, setDeletingConsigneeId] = useState<string | null>(null);
  const [deletingNotifyPartyId, setDeletingNotifyPartyId] = useState<string | null>(null);

  // Business Details Form State
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [selectedCountryName, setSelectedCountryName] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState<Country | null>(null);
  const [selectedCountryId, setSelectedCountryId] = useState('');

  // Contact Number & Calling Code
  const [contactNumber, setContactNumber] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<Country | null>(null);
  const [isPhoneDropdownOpen, setIsPhoneDropdownOpen] = useState(false);
  const [phoneSearch, setPhoneSearch] = useState('');
  const phoneDropdownRef = useRef<HTMLDivElement>(null);
  const phoneSearchInputRef = useRef<HTMLInputElement>(null);
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const consigneesEndRef = useRef<HTMLDivElement>(null);
  const notifyEndRef = useRef<HTMLDivElement>(null);

  const [zipcode, setZipcode] = useState('');
  const [email, setEmail] = useState('');
  const [certificateNameNumber, setCertificateNameNumber] = useState('');
  const [authorityName, setAuthorityName] = useState('');
  const [authorisedSignature, setAuthorisedSignature] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');

  // Multiple Consignee Items State
  const [consigneeItems, setConsigneeItems] = useState<ConsigneeOrNotifyItem[]>([
    {
      id: generateSmartDocsCuid(),
      company_name: '',
      certificate_name_number: '',
      address: '',
      city: '',
      state: '',
      country: '',
      country_code: '',
      country_id: '',
      zip_code: '',
      email: '',
      contact_number: '',
      phone_country_code: '',
    },
  ]);

  // Multiple Notify Party Items State
  const [notifyPartyItems, setNotifyPartyItems] = useState<ConsigneeOrNotifyItem[]>([
    {
      id: generateSmartDocsCuid(),
      company_name: '',
      certificate_name_number: '',
      address: '',
      city: '',
      state: '',
      country: '',
      country_code: '',
      country_id: '',
      zip_code: '',
      email: '',
      contact_number: '',
      phone_country_code: '',
    },
  ]);

  // Submitting States & Errors
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);
  const [isSavingConsignees, setIsSavingConsignees] = useState(false);
  const [isSavingNotifyParties, setIsSavingNotifyParties] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Country Dropdown State
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const countrySearchInputRef = useRef<HTMLInputElement>(null);

  const backdropMouseDownRef = useRef(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const companyNameInputRef = useRef<HTMLInputElement>(null);

  // Lifecyle & Lazy Load Tracking Refs
  const isFirstOpenRef = useRef(false);
  const prevOpenedIdRef = useRef<string | null>(null);
  const [fetchedConsigneesBuyerId, setFetchedConsigneesBuyerId] = useState<string | null>(null);
  const [fetchedNotifyPartiesBuyerId, setFetchedNotifyPartiesBuyerId] = useState<string | null>(null);
  const isFetchingConsigneesRef = useRef(false);
  const isFetchingNotifyPartiesRef = useRef(false);
  const [isLoadingConsignees, setIsLoadingConsignees] = useState(false);
  const [isLoadingNotifyParties, setIsLoadingNotifyParties] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const clearFieldError = useCallback((...fieldKeys: string[]) => {
    setErrors((prev) => {
      let changed = false;
      const next = { ...prev };
      fieldKeys.forEach((key) => {
        if (next[key]) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  // Full sorted country list
  const allCountries = useMemo(() => {
    return getCountries()
      .map((code) => ({
        code,
        name: countryNames[code] || code,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  // Filtered countries based on search
  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return allCountries;
    return allCountries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [allCountries, countrySearch]);

  // Full sorted country list with calling codes for phone selector
  const allPhoneCountries = useMemo(() => {
    return getCountries()
      .map((code) => {
        let callingCode = '';
        try {
          callingCode = getCountryCallingCode(code);
        } catch {
          callingCode = '';
        }
        return {
          code,
          name: countryNames[code] || code,
          callingCode: callingCode ? `+${callingCode}` : '',
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  // Filtered phone countries based on search
  const filteredPhoneCountries = useMemo(() => {
    const q = phoneSearch.trim().toLowerCase();
    if (!q) return allPhoneCountries;
    const qClean = q.replace(/^\+/, '');
    return allPhoneCountries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.callingCode.replace(/^\+/, '').includes(qClean)
    );
  }, [allPhoneCountries, phoneSearch]);

  const resolveCountry = useCallback(
    (input: any): { code: Country | null; name: string } => {
      if (!input) return { code: null, name: '' };
      const raw =
        typeof input === 'object'
          ? input.name || input.country_name || input.country || ''
          : String(input);
      const trimmed = raw.trim();
      if (!trimmed) return { code: null, name: '' };

      const byName = allCountries.find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (byName) return { code: byName.code, name: byName.name };

      const byCode = allCountries.find(
        (c) => c.code.toLowerCase() === trimmed.toLowerCase()
      );
      if (byCode) return { code: byCode.code, name: byCode.name };

      return { code: null, name: trimmed };
    },
    [allCountries]
  );

  // Helper to create a single clean default item with fresh ID
  const createDefaultItem = useCallback((): ConsigneeOrNotifyItem => ({
    id: generateSmartDocsCuid(),
    company_name: '',
    certificate_name_number: '',
    address: '',
    city: '',
    state: '',
    country: '',
    country_code: '',
    country_id: '',
    zip_code: '',
    email: '',
    contact_number: '',
    phone_country_code: '',
    is_active: true,
  }), []);

  // Helper to reset form to initial default state
  const resetFormToDefault = useCallback(() => {
    setCompanyName('');
    setAddress('');
    setCity('');
    setStateName('');
    setSelectedCountryName('');
    setSelectedCountryCode(null);
    setSelectedCountryId('');
    setContactNumber('');
    setPhoneCountryCode('');
    setPhoneCountry(null);
    setIsPhoneDropdownOpen(false);
    setPhoneSearch('');
    setZipcode('');
    setEmail('');
    setCertificateNameNumber('');
    setAuthorityName('');
    setAuthorisedSignature('');
    setCompanyLogo('');
    setExistingBackendConsigneeIds(new Set());
    setExistingBackendNotifyIds(new Set());
    setDeletingConsigneeId(null);
    setDeletingNotifyPartyId(null);
    setConsigneeItems([createDefaultItem()]);
    setNotifyPartyItems([createDefaultItem()]);
  }, [createDefaultItem]);

  // Helper to parse item data for Consignee and Notify Party
  const parseItemData = useCallback(
    (it: any): ConsigneeOrNotifyItem => {
      const rawId = String(it.id || it._id || '').trim();
      const cleanId = isValidCuidOrId(rawId) ? rawId : generateSmartDocsCuid();

      // 1. Country Name Extraction
      let countryName = '';
      if (it.country && typeof it.country === 'object') {
        const objName =
          it.country.name ||
          it.country.country_name ||
          it.country.title ||
          it.country.label;
        if (typeof objName === 'string' && objName.trim() && objName !== '[object Object]') {
          countryName = objName.trim();
        }
      } else if (typeof it.country === 'string') {
        const trimmed = it.country.trim();
        if (trimmed && trimmed !== '[object Object]' && trimmed.toLowerCase() !== 'undefined' && trimmed.toLowerCase() !== 'null') {
          countryName = trimmed;
        }
      }
      if (!countryName) {
        const alt = it.country_name || it.countryName;
        if (typeof alt === 'string' && alt.trim() && alt !== '[object Object]') {
          countryName = alt.trim();
        }
      }

      // 2. Country ID Extraction
      let countryId = '';
      if (it.country && typeof it.country === 'object' && it.country.id) {
        countryId = String(it.country.id).trim();
      } else if (typeof it.country_id === 'string' && it.country_id.trim()) {
        countryId = it.country_id.trim();
      }

      // 3. Country Code (ISO2) Extraction
      let countryCode = '';
      if (it.country && typeof it.country === 'object') {
        const iso = it.country.iso2 || it.country.code;
        if (typeof iso === 'string' && iso.trim()) countryCode = iso.trim().toUpperCase();
      }
      if (!countryCode && typeof it.country_code === 'string') {
        const codeTrim = it.country_code.trim();
        if (/^[A-Za-z]{2}$/.test(codeTrim)) {
          countryCode = codeTrim.toUpperCase();
        }
      }

      // 4. Resolve missing Country Code or ID from countryName
      if (countryName && (!countryCode || !countryId)) {
        const resolved = resolveCountry(countryName);
        if (!countryCode && resolved.code) countryCode = resolved.code;
        const match = countries?.find(
          (c: any) =>
            (resolved.code && c.iso2?.toUpperCase() === resolved.code.toUpperCase()) ||
            (countryName && c.name?.toLowerCase() === countryName.toLowerCase())
        );
        if (match?.id && !countryId) countryId = match.id;
        if (!countryCode && match?.iso2) countryCode = match.iso2.toUpperCase();
      }

      // 5. Phone & Dial Code Extraction
      let phoneDialCode = String(
        it.phone_country_code ||
        it.phoneCountryCode ||
        it.calling_code ||
        it.phone_code ||
        ''
      ).trim();
      let phoneNum = String(it.contact_number || it.phone || it.mobile || '').trim();
      const rawContactCode = String(it.country_code || it.countryCode || '').trim();

      // If phone starts with '+', parse with parsePhoneNumber
      if (phoneNum.startsWith('+')) {
        try {
          const parsed = parsePhoneNumber(phoneNum);
          if (parsed) {
            phoneDialCode = `+${parsed.countryCallingCode}`;
            phoneNum = parsed.nationalNumber || '';
          }
        } catch {}
      }

      // Backend returns calling code under country_code e.g. "country_code": "+91"
      if (!phoneDialCode && rawContactCode) {
        if (rawContactCode.startsWith('+')) {
          phoneDialCode = rawContactCode;
        } else if (/^\d+$/.test(rawContactCode)) {
          phoneDialCode = `+${rawContactCode}`;
        }
      }

      if (phoneDialCode && !phoneDialCode.startsWith('+') && /^\d+$/.test(phoneDialCode)) {
        phoneDialCode = `+${phoneDialCode}`;
      }

      let isActive = true;
      if (it.is_active !== undefined && it.is_active !== null) {
        isActive = Boolean(it.is_active === true || it.is_active === 1 || it.is_active === '1' || it.is_active === 'true');
      } else if (it.status !== undefined && it.status !== null) {
        isActive = Boolean(it.status === true || it.status === 1 || it.status === '1' || it.status === 'true' || it.status === 'active' || it.status === 'ACTIVE');
      }

      return {
        id: cleanId,
        company_name: String(it.company_name || it.name || '').trim(),
        certificate_name_number: String(
          it.certificate_name_number || it.certificate_name_and_number || it.certificateNo || ''
        ).trim(),
        address: String(it.address || '').trim(),
        city: String(it.city || '').trim(),
        state: String(it.state || '').trim(),
        country: countryName,
        country_code: countryCode,
        country_id: countryId,
        zip_code: String(it.zip_code || it.zipcode || '').trim(),
        email: String(it.email || '').trim(),
        contact_number: phoneNum,
        phone_country_code: phoneDialCode,
        is_active: isActive,
      };
    },
    [countries, resolveCountry]
  );

  // Helper to populate buyer data into state without resetting scroll or active tab
  const populateBuyerData = useCallback(
    (b: any) => {
      if (!b) return;

      if (b.company_name || b.companyName || b.company || b.business_name || b.name) {
        setCompanyName(
          b.company_name || b.companyName || b.company || b.business_name || b.name || ''
        );
      }
      if (b.address || b.address_details || b.details) {
        setAddress(b.address || b.address_details || b.details || '');
      }
      if (b.city || b.city_name) {
        setCity(b.city || b.city_name || '');
      }
      if (b.state || b.state_name || b.province) {
        setStateName(b.state || b.state_name || b.province || '');
      }

      let countryRaw = '';
      if (b.country && typeof b.country === 'object') {
        const objName =
          b.country.name ||
          b.country.country_name ||
          b.country.title ||
          b.country.label;
        if (typeof objName === 'string' && objName.trim() && objName !== '[object Object]') {
          countryRaw = objName.trim();
        }
      } else if (typeof b.country === 'string') {
        const trimmed = b.country.trim();
        if (trimmed && trimmed !== '[object Object]' && trimmed.toLowerCase() !== 'undefined' && trimmed.toLowerCase() !== 'null') {
          countryRaw = trimmed;
        }
      }
      if (!countryRaw) {
        const alt = b.country_name || b.countryName;
        if (typeof alt === 'string' && alt.trim() && alt !== '[object Object]') {
          countryRaw = alt.trim();
        }
      }

      let resolvedBuyerCountryCode: Country | null = null;
      if (countryRaw) {
        const resolved = resolveCountry(countryRaw);
        resolvedBuyerCountryCode = resolved.code;
        setSelectedCountryName(resolved.name || countryRaw);
        setSelectedCountryCode(resolved.code);

        let rawCountryId = String(
          b.country?.id ||
          b.country_id ||
          b.countryId ||
          b.raw?.country_id ||
          b.raw?.country?.id ||
          ''
        );
        if (!rawCountryId && (resolved.code || resolved.name)) {
          const match = countries?.find((c: any) =>
            (resolved.code && c.iso2?.toUpperCase() === resolved.code.toUpperCase()) ||
            (resolved.name && c.name?.toLowerCase() === resolved.name.toLowerCase())
          );
          if (match?.id) rawCountryId = match.id;
        }
        setSelectedCountryId(rawCountryId);
      }

      const rawPhone = String(
        b.contact_number || b.contactNumber || b.phone || b.mobile || ''
      ).trim();
      const rawPCode = String(
        b.country_code || b.countryCode || b.phone_country_code || b.phoneCountryCode || ''
      ).trim();

      let resolvedPhoneCode = '';
      let resolvedPhoneNum = rawPhone;

      if (rawPhone.startsWith('+')) {
        try {
          const parsed = parsePhoneNumber(rawPhone);
          if (parsed) {
            resolvedPhoneCode = `+${parsed.countryCallingCode}`;
            resolvedPhoneNum = parsed.nationalNumber || '';
          }
        } catch {}
      }

      if (!resolvedPhoneCode && rawPCode) {
        if (rawPCode.startsWith('+')) {
          resolvedPhoneCode = rawPCode;
        } else if (/^\d+$/.test(rawPCode)) {
          resolvedPhoneCode = `+${rawPCode}`;
        } else if (/^[A-Za-z]{2}$/.test(rawPCode)) {
          try {
            const dial = getCountryCallingCode(rawPCode as Country);
            if (dial) resolvedPhoneCode = `+${dial}`;
          } catch {}
        }
      }

      if (resolvedPhoneCode && !resolvedPhoneCode.startsWith('+') && /^\d+$/.test(resolvedPhoneCode)) {
        resolvedPhoneCode = `+${resolvedPhoneCode}`;
      }

      setPhoneCountryCode(resolvedPhoneCode);
      setContactNumber(resolvedPhoneNum);
      if (resolvedPhoneCode) {
        const matched = allPhoneCountries.find((c) => c.callingCode === resolvedPhoneCode);
        setPhoneCountry(matched?.code || null);
      } else {
        setPhoneCountry(null);
      }

      if (b.zip_code || b.zipcode || b.postal_code) {
        setZipcode(String(b.zip_code || b.zipcode || b.postal_code || ''));
      }
      if (b.email || b.email_address) {
        setEmail(b.email || b.email_address || '');
      }
      if (b.certificate_name_number || b.certificate_name_and_number || b.certificate_no) {
        setCertificateNameNumber(
          b.certificate_name_number ||
          b.certificate_name_and_number ||
          b.certificate_no ||
          ''
        );
      }
      if (b.authority_name || b.authority) {
        setAuthorityName(b.authority_name || b.authority || '');
      }

      const sig =
        b.authorised_signature ||
        b.authority_signature ||
        b.signature ||
        b.buyer_signature ||
        '';
      if (sig) {
        setAuthorisedSignature(formatAssetUrl(sig));
      }

      const logo = b.company_logo || b.logo || '';
      if (logo) {
        setCompanyLogo(formatAssetUrl(logo));
      }

      const consigneeList =
        (Array.isArray(b.consignees) && b.consignees) ||
        (Array.isArray(b.consignee_details) && b.consignee_details) ||
        (Array.isArray(b.consignee) && b.consignee) ||
        (Array.isArray(b.consignees_details) && b.consignees_details) ||
        (Array.isArray(b.raw?.consignees) && b.raw.consignees) ||
        (Array.isArray(b.raw?.consignee_details) && b.raw.consignee_details) ||
        [];

      if (consigneeList.length > 0) {
        const backendIds = new Set<string>();
        const parsed: ConsigneeOrNotifyItem[] = consigneeList.map((it: any) => {
          const item = parseItemData(it);
          if (it.id || it._id) backendIds.add(item.id);
          return item;
        });
        setConsigneeItems(parsed);
        setExistingBackendConsigneeIds(backendIds);
      }

      const notifyList =
        (Array.isArray(b.notify_parties) && b.notify_parties) ||
        (Array.isArray(b.notify_party) && b.notify_party) ||
        (Array.isArray(b.notify_party_details) && b.notify_party_details) ||
        (Array.isArray(b.notifyParty) && b.notifyParty) ||
        (Array.isArray(b.notifies) && b.notifies) ||
        (Array.isArray(b.notify_parties_details) && b.notify_parties_details) ||
        (Array.isArray(b.notify) && b.notify) ||
        (Array.isArray(b.raw?.notify_parties) && b.raw.notify_parties) ||
        (Array.isArray(b.raw?.notify_party) && b.raw.notify_party) ||
        (Array.isArray(b.raw?.notify_party_details) && b.raw.notify_party_details) ||
        (Array.isArray(b.raw?.notifies) && b.raw.notifies) ||
        [];

      if (notifyList.length > 0) {
        const backendIds = new Set<string>();
        const parsed: ConsigneeOrNotifyItem[] = notifyList.map((it: any) => {
          const item = parseItemData(it);
          if (it.id || it._id) backendIds.add(item.id);
          return item;
        });
        setNotifyPartyItems(parsed);
        setExistingBackendNotifyIds(backendIds);
      }
    },
    [allPhoneCountries, countries, parseItemData, resolveCountry]
  );

  // Sync state when modal transitions from closed to open
  useEffect(() => {
    if (!isOpen) {
      isFirstOpenRef.current = false;
      prevOpenedIdRef.current = null;
      setFetchedConsigneesBuyerId(null);
      setFetchedNotifyPartiesBuyerId(null);
      isFetchingConsigneesRef.current = false;
      isFetchingNotifyPartiesRef.current = false;
      resetFormToDefault();
      setSavedBuyerId('');
      setIsBusinessSaved(false);
      return;
    }

    const currentBuyerId =
      mode === 'edit' && buyer
        ? String(buyer.id || buyer._id || buyer.instruction_id || '')
        : '';

    // If modal just opened OR switched to another buyer:
    if (!isFirstOpenRef.current || (mode === 'edit' && currentBuyerId && currentBuyerId !== prevOpenedIdRef.current)) {
      isFirstOpenRef.current = true;
      prevOpenedIdRef.current = currentBuyerId;
      setActiveTab('business');
      setErrors({});
      resetFormToDefault();
      setFetchedConsigneesBuyerId(null);
      setFetchedNotifyPartiesBuyerId(null);
      isFetchingConsigneesRef.current = false;
      isFetchingNotifyPartiesRef.current = false;

      if (mode === 'edit' && buyer) {
        setSavedBuyerId(currentBuyerId);
        setIsBusinessSaved(true);
        populateBuyerData(buyer);
      } else {
        setSavedBuyerId('');
        setIsBusinessSaved(false);
        setFetchedConsigneesBuyerId('__NEW__');
        setFetchedNotifyPartiesBuyerId('__NEW__');
      }

      if (modalBodyRef.current) {
        modalBodyRef.current.scrollTop = 0;
      }
      setTimeout(() => {
        companyNameInputRef.current?.focus();
      }, 100);
      return;
    }

    // Modal was already open, same record (asynchronous detailed fetch returned):
    if (mode === 'edit' && currentBuyerId && currentBuyerId === prevOpenedIdRef.current && buyer) {
      populateBuyerData(buyer);
    }
  }, [isOpen, mode, buyer, populateBuyerData, resetFormToDefault]);

  // Scroll to top ONLY when user explicitly switches activeTab
  useEffect(() => {
    if (modalBodyRef.current) {
      modalBodyRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // Lazy fetch Consignees when switching to consignee tab (ONLY in edit mode for existing buyers)
  useEffect(() => {
    if (
      isOpen &&
      mode === 'edit' &&
      activeTab === 'consignee' &&
      savedBuyerId &&
      fetchedConsigneesBuyerId !== savedBuyerId &&
      !isFetchingConsigneesRef.current &&
      onFetchConsignees
    ) {
      isFetchingConsigneesRef.current = true;
      setIsLoadingConsignees(true);
      onFetchConsignees(savedBuyerId)
        .then((res: any) => {
          if (res && (res.success || Array.isArray(res.data) || Array.isArray(res))) {
            const raw = Array.isArray(res?.data)
              ? res.data
              : Array.isArray(res?.items)
              ? res.items
              : Array.isArray(res?.data?.items)
              ? res.data.items
              : Array.isArray(res?.data?.consignees)
              ? res.data.consignees
              : Array.isArray(res?.data?.consignee)
              ? res.data.consignee
              : Array.isArray(res?.data?.consignee_details)
              ? res.data.consignee_details
              : Array.isArray(res?.consignees)
              ? res.consignees
              : Array.isArray(res?.consignee)
              ? res.consignee
              : Array.isArray(res?.consignee_details)
              ? res.consignee_details
              : Array.isArray(res)
              ? res
              : [];
            if (raw.length > 0) {
              const backendIds = new Set<string>();
              const parsed: ConsigneeOrNotifyItem[] = raw.map((it: any) => {
                const item = parseItemData(it);
                if (it.id || it._id) backendIds.add(item.id);
                return item;
              });
              setConsigneeItems(parsed);
              setExistingBackendConsigneeIds(backendIds);
            }
          }
          setFetchedConsigneesBuyerId(savedBuyerId);
        })
        .catch(() => {})
        .finally(() => {
          isFetchingConsigneesRef.current = false;
          setIsLoadingConsignees(false);
        });
    }
  }, [isOpen, mode, activeTab, savedBuyerId, fetchedConsigneesBuyerId, onFetchConsignees, parseItemData]);

  // Lazy fetch Notify Parties when switching to notify_party tab (ONLY in edit mode for existing buyers)
  useEffect(() => {
    if (
      isOpen &&
      mode === 'edit' &&
      activeTab === 'notify_party' &&
      savedBuyerId &&
      fetchedNotifyPartiesBuyerId !== savedBuyerId &&
      !isFetchingNotifyPartiesRef.current &&
      onFetchNotifyParties
    ) {
      isFetchingNotifyPartiesRef.current = true;
      setIsLoadingNotifyParties(true);
      onFetchNotifyParties(savedBuyerId)
        .then((res: any) => {
          if (res && (res.success || Array.isArray(res.data) || Array.isArray(res))) {
            const raw = Array.isArray(res?.data)
              ? res.data
              : Array.isArray(res?.items)
              ? res.items
              : Array.isArray(res?.data?.items)
              ? res.data.items
              : Array.isArray(res?.data?.notify_parties)
              ? res.data.notify_parties
              : Array.isArray(res?.data?.notify_party)
              ? res.data.notify_party
              : Array.isArray(res?.data?.notifies)
              ? res.data.notifies
              : Array.isArray(res?.data?.notifyParty)
              ? res.data.notifyParty
              : Array.isArray(res?.notify_parties)
              ? res.notify_parties
              : Array.isArray(res?.notify_party)
              ? res.notify_party
              : Array.isArray(res?.notifies)
              ? res.notifies
              : Array.isArray(res)
              ? res
              : [];
            if (raw.length > 0) {
              const backendIds = new Set<string>();
              const parsed: ConsigneeOrNotifyItem[] = raw.map((it: any) => {
                const item = parseItemData(it);
                if (it.id || it._id) backendIds.add(item.id);
                return item;
              });
              setNotifyPartyItems(parsed);
              setExistingBackendNotifyIds(backendIds);
            }
          }
          setFetchedNotifyPartiesBuyerId(savedBuyerId);
        })
        .catch(() => {})
        .finally(() => {
          isFetchingNotifyPartiesRef.current = false;
          setIsLoadingNotifyParties(false);
        });
    }
  }, [isOpen, mode, activeTab, savedBuyerId, fetchedNotifyPartiesBuyerId, onFetchNotifyParties, parseItemData]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
      };
    }
  }, [isOpen]);

  // Click outside country dropdown
  useEffect(() => {
    if (!isCountryDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCountryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCountryDropdownOpen]);

  // Click outside phone dial code dropdown
  useEffect(() => {
    if (!isPhoneDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        phoneDropdownRef.current &&
        !phoneDropdownRef.current.contains(e.target as Node)
      ) {
        setIsPhoneDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPhoneDropdownOpen]);

  // Backdrop Click Handlers
  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      backdropMouseDownRef.current = true;
    } else {
      backdropMouseDownRef.current = false;
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (
      backdropMouseDownRef.current &&
      e.target === e.currentTarget &&
      !isSavingBusiness &&
      !isSavingConsignees &&
      !isSavingNotifyParties &&
      !isLoading
    ) {
      onClose();
    }
    backdropMouseDownRef.current = false;
  };

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPhoneDropdownOpen) {
          setIsPhoneDropdownOpen(false);
          return;
        }
        if (isCountryDropdownOpen) {
          setIsCountryDropdownOpen(false);
          return;
        }
        if (!isSavingBusiness && !isSavingConsignees && !isSavingNotifyParties && !isLoading) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPhoneDropdownOpen, isCountryDropdownOpen, isSavingBusiness, isSavingConsignees, isSavingNotifyParties, isLoading, onClose]);

  // Upload Company Logo
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, SVG, WEBP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCompanyLogo(result);
      clearFieldError('company_logo', 'logo');
      toast.success('Company logo uploaded successfully');
    };
    reader.onerror = () => {
      toast.error('Failed to read logo file');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSelectCountry = (c: { code: Country; name: string }) => {
    setSelectedCountryName(c.name);
    setSelectedCountryCode(c.code);

    let matchedId = '';
    if (countries && countries.length > 0) {
      const match = countries.find(
        (item: any) =>
          item.iso2?.toUpperCase() === c.code.toUpperCase() ||
          item.name?.toLowerCase() === c.name.toLowerCase()
      );
      if (match?.id) matchedId = match.id;
    }

    if (!matchedId) {
      if (c.code === 'IN' || c.name.toLowerCase() === 'india') {
        matchedId = 'cm710m0og002smzt00fy4a8cg';
      } else if (c.code === 'AE' || c.name.toLowerCase().includes('emirates')) {
        matchedId = 'cm710prgz006emzt0kchb1zw9';
      }
    }
    setSelectedCountryId(matchedId);

    setIsCountryDropdownOpen(false);
    setCountrySearch('');
    clearFieldError('country', 'country_id');
  };

  const handleSelectDialCode = (c: { code: Country | null; callingCode: string; name: string } | null) => {
    if (!c || !c.callingCode) {
      setPhoneCountryCode('');
      setPhoneCountry(null);
    } else {
      setPhoneCountryCode(c.callingCode);
      setPhoneCountry(c.code);
    }
    setIsPhoneDropdownOpen(false);
    setPhoneSearch('');
    clearFieldError('country_code', 'contact_number', 'contactNumber');
  };

  const handleContactNumberChange = (rawVal: string) => {
    const trimmed = rawVal.trim();
    if (trimmed.startsWith('+')) {
      try {
        const parsed = parsePhoneNumber(trimmed);
        if (parsed) {
          setPhoneCountryCode(`+${parsed.countryCallingCode}`);
          setPhoneCountry((parsed.country as Country) || null);
          setContactNumber(parsed.nationalNumber || '');
          clearFieldError('contact_number', 'contactNumber', 'country_code');
          return;
        }
      } catch {}
    }
    setContactNumber(rawVal.replace(/[^\d\s-]/g, ''));
    clearFieldError('contact_number', 'contactNumber', 'country_code');
  };

  // Render flag helper matching SellerManageModal
  const renderFlag = (code?: Country | null, countryNameStr?: string) => {
    if (!code) {
      return <i className="fa-solid fa-globe text-muted-foreground text-xs shrink-0" />;
    }
    const FlagComp = flags[code];
    if (FlagComp) {
      return (
        <span className="w-5 h-3.5 flex items-center justify-center shrink-0 overflow-hidden rounded-xs border border-foreground/10 shadow-2xs">
          <FlagComp title={countryNameStr || countryNames[code] || code} />
        </span>
      );
    }
    return <i className="fa-solid fa-globe text-muted-foreground text-xs shrink-0" />;
  };

  // Validate Business Details Form
  const validateBusinessDetails = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!companyName.trim()) {
      newErrors.company_name = 'Company name is required';
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);

    if (newErrors.company_name) {
      companyNameInputRef.current?.focus();
      return false;
    }

    return Object.keys(newErrors).length === 0;
  };

  const dataUrlToFile = (dataUrl: string, filename: string): File | null => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
    try {
      const parts = dataUrl.split(',');
      if (parts.length < 2) return null;
      const match = parts[0].match(/:(.*?);/);
      const mime = match ? match[1] : 'image/png';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    } catch {
      return null;
    }
  };

  // Handle Save Business Details
  const handleSaveBusinessSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateBusinessDetails()) return;

    setIsSavingBusiness(true);

    const formData = new FormData();
    formData.append('type', 'B');
    if (savedBuyerId) formData.append('id', savedBuyerId);
    formData.append('company_name', companyName.trim());
    formData.append('address', address.trim());
    formData.append('city', city.trim());
    formData.append('state', stateName.trim());
    if (selectedCountryName) formData.append('country', selectedCountryName.trim());
    if (selectedCountryId) formData.append('country_id', selectedCountryId.trim());

    const cleanPhone = contactNumber.trim().replace(/\s+/g, '');
    const cleanDialCode = phoneCountryCode.trim();
    if (cleanPhone) formData.append('contact_number', cleanPhone);
    if (cleanDialCode) {
      formData.append('country_code', cleanDialCode);
      formData.append('phone_country_code', cleanDialCode);
    }

    formData.append('zip_code', zipcode.trim());
    formData.append('email', email.trim());
    formData.append('certificate_name_number', certificateNameNumber.trim());
    formData.append('authority_name', authorityName.trim());

    if (authorisedSignature) {
      if (authorisedSignature.startsWith('data:')) {
        const sigFile = dataUrlToFile(authorisedSignature, 'authorised_signature.png');
        if (sigFile) formData.append('authorised_signature', sigFile);
      } else {
        const cleanSig = authorisedSignature
          .replace(/^https?:\/\/assets\.agriguruonline\.(com|cloud)\/?/, '')
          .trim();
        formData.append('authorised_signature', cleanSig);
      }
    }

    if (companyLogo) {
      if (companyLogo.startsWith('data:')) {
        const logoFile = dataUrlToFile(companyLogo, 'company_logo.png');
        if (logoFile) formData.append('company_logo', logoFile);
      } else {
        const cleanLogo = companyLogo
          .replace(/^https?:\/\/assets\.agriguruonline\.(com|cloud)\/?/, '')
          .trim();
        formData.append('company_logo', cleanLogo);
      }
    }

    try {
      const res = await onSaveBusiness(formData);

      if (res && res.success) {
        const createdId =
          res.data?.id ||
          res.data?._id ||
          res.data?.instruction_id ||
          res.data?.company_id ||
          savedBuyerId;
        if (createdId) {
          setSavedBuyerId(createdId);
        }
        setIsBusinessSaved(true);
        setErrors({});

        if (mode === 'add') {
          setActiveTab('consignee');
          toast.success(
            res.message || 'Business details saved! Now you can enter consignee details.'
          );
        } else {
          toast.success(res.message || 'Business details updated successfully');
        }
      } else {
        toast.error(res?.message || 'Failed to save business details');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error saving business details');
    } finally {
      setIsSavingBusiness(false);
    }
  };

  // Consignee Handlers
  const validateConsigneeItems = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!consigneeItems || consigneeItems.length === 0) {
      newErrors.consignee_items = 'At least one consignee is required';
    } else {
      const seenNames = new Map<string, number>();

      consigneeItems.forEach((c, idx) => {
        const trimmedName = (c.company_name || '').trim();
        if (!trimmedName) {
          newErrors[`consignee_company_name_${c.id}`] =
            consigneeItems.length > 1
              ? `Company name is required for Option #${idx + 1}`
              : 'Company name is required';
        } else {
          const lower = trimmedName.toLowerCase();
          if (seenNames.has(lower)) {
            const firstIdx = seenNames.get(lower)!;
            newErrors[`consignee_company_name_${c.id}`] = `Duplicate company name "${trimmedName}" (matches Option #${firstIdx + 1}).`;
          } else {
            seenNames.set(lower, idx);
          }
        }
      });
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));

    if (Object.keys(newErrors).length > 0) {
      const firstInvalidItem = consigneeItems.find(
        (c) => newErrors[`consignee_company_name_${c.id}`]
      );
      if (firstInvalidItem) {
        const el = document.getElementById(`consignee_company_name_${firstInvalidItem.id}`);
        if (el) el.focus();
      }
      return false;
    }

    return true;
  };

  const handleAddConsignee = () => {
    const newId = generateSmartDocsCuid();
    setConsigneeItems((prev) => [
      ...prev,
      {
        id: newId,
        company_name: '',
        certificate_name_number: '',
        address: '',
        city: '',
        state: '',
        country: '',
        country_code: '',
        country_id: '',
        zip_code: '',
        email: '',
        contact_number: '',
        phone_country_code: '',
        is_active: true,
      },
    ]);

    setTimeout(() => {
      if (modalBodyRef.current) {
        modalBodyRef.current.scrollTo({
          top: modalBodyRef.current.scrollHeight + 1000,
          behavior: 'smooth',
        });
      }
      const el = document.getElementById(`consignee_company_name_${newId}`);
      if (el) el.focus();
    }, 80);
  };

  const handleRemoveConsignee = async (item: ConsigneeOrNotifyItem) => {
    const id = item.id;
    if (deletingConsigneeId) return;

    const clearErrorsForId = (targetId: string) => {
      setErrors((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (k.includes(targetId)) delete next[k];
        });
        return next;
      });
    };

    if (existingBackendConsigneeIds.has(id)) {
      setDeletingConsigneeId(id);
      try {
        const res = onDeleteConsignee
          ? await onDeleteConsignee(id)
          : await deleteBuyerConsigneeAction(id, { lang: 'en', source: 'web' });

        if (res && res.success) {
          toast.success(res.message || 'Consignee deleted successfully');
          setExistingBackendConsigneeIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          setConsigneeItems((prev) => {
            const filtered = prev.filter((b) => b.id !== id);
            return filtered.length > 0
              ? filtered
              : [
                  {
                    id: generateSmartDocsCuid(),
                    company_name: '',
                    certificate_name_number: '',
                    address: '',
                    city: '',
                    state: '',
                    country: '',
                    country_code: '',
                    country_id: '',
                    zip_code: '',
                    email: '',
                    contact_number: '',
                    phone_country_code: '',
                  },
                ];
          });
          clearErrorsForId(id);
        } else {
          toast.error(res?.message || 'Failed to delete consignee');
        }
      } catch (err: any) {
        toast.error(err?.message || 'Error deleting consignee');
      } finally {
        setDeletingConsigneeId(null);
      }
    } else {
      // Unsaved local row
      setConsigneeItems((prev) => {
        const filtered = prev.filter((b) => b.id !== id);
        return filtered.length > 0
          ? filtered
          : [
              {
                id: generateSmartDocsCuid(),
                company_name: '',
                certificate_name_number: '',
                address: '',
                city: '',
                state: '',
                country: '',
                country_code: '',
                country_id: '',
                zip_code: '',
                email: '',
                contact_number: '',
                phone_country_code: '',
                is_active: true,
              },
            ];
      });
      clearErrorsForId(id);
    }
  };

  const handleConsigneeChange = (
    id: string,
    field: keyof ConsigneeOrNotifyItem,
    value: string
  ) => {
    setConsigneeItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'country' && countries.length > 0) {
          const match = countries.find(
            (c: any) =>
              c.name?.toLowerCase() === value.trim().toLowerCase() ||
              c.code?.toLowerCase() === value.trim().toLowerCase()
          );
          if (match) {
            updated.country_id = match.id || '';
            if (match.code) updated.country_code = match.code;
          }
        }
        return updated;
      })
    );
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`consignee_${field}_${id}`];
      delete next[`${field}_${id}`];
      delete next.consignee_items;
      return next;
    });
  };

  const handleSaveConsigneesSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!savedBuyerId) {
      toast.error('Please save business details first');
      setActiveTab('business');
      return;
    }

    if (!validateConsigneeItems()) return;

    setIsSavingConsignees(true);

    const cleanConsignees: ConsigneeOrNotifyItem[] = consigneeItems
      .filter((c) => c && c.company_name.trim())
      .map((c) => {
        const isExisting = Boolean(c.id && existingBackendConsigneeIds.has(c.id));
        const phoneCode = (c.phone_country_code || (c.country_code?.startsWith('+') || /^\d+$/.test(c.country_code || '') ? c.country_code : '') || '').trim();
        return {
          id: c.id,
          is_new: !isExisting,
          is_active: c.is_active !== false,
          company_name: c.company_name.trim(),
          certificate_name_number: c.certificate_name_number.trim(),
          address: c.address.trim(),
          city: c.city.trim(),
          state: c.state.trim(),
          country: c.country.trim(),
          country_code: phoneCode || c.country_code?.trim() || '',
          country_id: c.country_id?.trim() || '',
          zip_code: c.zip_code.trim(),
          email: c.email.trim(),
          phone_country_code: phoneCode,
          contact_number: c.contact_number.trim(),
        };
      });

    if (cleanConsignees.length === 0) {
      setIsSavingConsignees(false);
      toast.error('Please enter at least one consignee company name');
      return;
    }

    try {
      if (onSaveConsignees) {
        const res = await onSaveConsignees(cleanConsignees, savedBuyerId);
        if (res && res.success) {
          toast.success(res.message || 'Consignee details saved successfully!');
          setExistingBackendConsigneeIds((prev) => {
            const next = new Set(prev);
            cleanConsignees.forEach((c: any) => {
              if (c.id) next.add(c.id);
            });
            return next;
          });
          setActiveTab('notify_party');
        } else {
          const backendErrors: Record<string, string> = {};
          const parseError = (ef: any) => {
            if (!ef) return;
            const fKey = String(ef.field || ef.property || ef.param || '');
            const msg = String(ef.message || ef.msg || ef.error || 'Invalid value');

            // Find index, e.g. consignees.0.company_name or items[0].email
            const idxMatch = fKey.match(/(?:consignees?|items?)?\.?\[?(\d+)\]?/i);
            const targetIdx = idxMatch ? parseInt(idxMatch[1], 10) : 0;
            const targetItem = consigneeItems[targetIdx] || consigneeItems[0];
            const targetId = targetItem?.id || '';

            if (fKey.includes('company_name') || fKey.includes('name')) {
              if (targetId) backendErrors[`consignee_company_name_${targetId}`] = msg;
            } else if (fKey.includes('email')) {
              if (targetId) backendErrors[`consignee_email_${targetId}`] = msg;
            } else if (fKey.includes('contact_number') || fKey.includes('phone')) {
              if (targetId) backendErrors[`consignee_contact_number_${targetId}`] = msg;
            } else if (fKey.includes('country_id') || fKey.includes('country')) {
              if (targetId) backendErrors[`consignee_country_${targetId}`] = msg;
            } else if (fKey.includes('zip_code') || fKey.includes('zipcode')) {
              if (targetId) backendErrors[`consignee_zip_code_${targetId}`] = msg;
            } else if (fKey.includes('certificate')) {
              if (targetId) backendErrors[`consignee_certificate_${targetId}`] = msg;
            } else if (fKey.includes('address')) {
              if (targetId) backendErrors[`consignee_address_${targetId}`] = msg;
            } else if (fKey.includes('city')) {
              if (targetId) backendErrors[`consignee_city_${targetId}`] = msg;
            } else if (fKey.includes('state')) {
              if (targetId) backendErrors[`consignee_state_${targetId}`] = msg;
            }
          };

          const rawErrors = res?.error_fields || res?.errors || [];
          if (Array.isArray(rawErrors)) {
            rawErrors.forEach(parseError);
          } else if (rawErrors && typeof rawErrors === 'object') {
            Object.entries(rawErrors).forEach(([k, v]) => parseError({ field: k, message: String(v) }));
          }

          if (Object.keys(backendErrors).length > 0) {
            setErrors((prev) => ({ ...prev, ...backendErrors }));
          }
          toast.error(res?.message || 'Failed to update consignee details');
        }
      } else {
        toast.success('Consignee details saved');
        setActiveTab('notify_party');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error saving consignees');
    } finally {
      setIsSavingConsignees(false);
    }
  };

  // Notify Party Handlers
  const validateNotifyPartyItems = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!notifyPartyItems || notifyPartyItems.length === 0) {
      newErrors.notify_party_items = 'At least one notify party is required';
    } else {
      const seenNames = new Map<string, number>();

      notifyPartyItems.forEach((n, idx) => {
        const trimmedName = (n.company_name || '').trim();
        if (!trimmedName) {
          newErrors[`notify_company_name_${n.id}`] =
            notifyPartyItems.length > 1
              ? `Company name is required for Option #${idx + 1}`
              : 'Company name is required';
        } else {
          const lower = trimmedName.toLowerCase();
          if (seenNames.has(lower)) {
            const firstIdx = seenNames.get(lower)!;
            newErrors[`notify_company_name_${n.id}`] = `Duplicate company name "${trimmedName}" (matches Option #${firstIdx + 1}).`;
          } else {
            seenNames.set(lower, idx);
          }
        }
      });
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));

    if (Object.keys(newErrors).length > 0) {
      const firstInvalidItem = notifyPartyItems.find(
        (n) => newErrors[`notify_company_name_${n.id}`]
      );
      if (firstInvalidItem) {
        const el = document.getElementById(`notify_company_name_${firstInvalidItem.id}`);
        if (el) el.focus();
      }
      return false;
    }

    return true;
  };

  const handleAddNotifyParty = () => {
    const newId = generateSmartDocsCuid();
    setNotifyPartyItems((prev) => [
      ...prev,
      {
        id: newId,
        company_name: '',
        certificate_name_number: '',
        address: '',
        city: '',
        state: '',
        country: '',
        country_code: '',
        country_id: '',
        zip_code: '',
        email: '',
        contact_number: '',
        phone_country_code: '',
        is_active: true,
      },
    ]);

    setTimeout(() => {
      if (modalBodyRef.current) {
        modalBodyRef.current.scrollTo({
          top: modalBodyRef.current.scrollHeight + 1000,
          behavior: 'smooth',
        });
      }
      const el = document.getElementById(`notify_company_name_${newId}`);
      if (el) el.focus();
    }, 80);
  };

  const handleRemoveNotifyParty = async (item: ConsigneeOrNotifyItem) => {
    const id = item.id;
    if (deletingNotifyPartyId) return;

    const clearErrorsForId = (targetId: string) => {
      setErrors((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (k.includes(targetId)) delete next[k];
        });
        return next;
      });
    };

    if (existingBackendNotifyIds.has(id)) {
      setDeletingNotifyPartyId(id);
      try {
        const res = onDeleteNotifyParty
          ? await onDeleteNotifyParty(id)
          : await deleteBuyerNotifyPartyAction(id, { lang: 'en', source: 'web' });

        if (res && res.success) {
          toast.success(res.message || 'Notify party deleted successfully');
          setExistingBackendNotifyIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          setNotifyPartyItems((prev) => {
            const filtered = prev.filter((b) => b.id !== id);
            return filtered.length > 0
              ? filtered
              : [
                  {
                    id: generateSmartDocsCuid(),
                    company_name: '',
                    certificate_name_number: '',
                    address: '',
                    city: '',
                    state: '',
                    country: '',
                    country_code: '',
                    country_id: '',
                    zip_code: '',
                    email: '',
                    contact_number: '',
                    phone_country_code: '',
                  },
                ];
          });
          clearErrorsForId(id);
        } else {
          toast.error(res?.message || 'Failed to delete notify party');
        }
      } catch (err: any) {
        toast.error(err?.message || 'Error deleting notify party');
      } finally {
        setDeletingNotifyPartyId(null);
      }
    } else {
      // Unsaved local row
      setNotifyPartyItems((prev) => {
        const filtered = prev.filter((b) => b.id !== id);
        return filtered.length > 0
          ? filtered
          : [
              {
                id: generateSmartDocsCuid(),
                company_name: '',
                certificate_name_number: '',
                address: '',
                city: '',
                state: '',
                country: '',
                country_code: '',
                country_id: '',
                zip_code: '',
                email: '',
                contact_number: '',
                phone_country_code: '',
                is_active: true,
              },
            ];
      });
      clearErrorsForId(id);
    }
  };

  const handleNotifyPartyChange = (
    id: string,
    field: keyof ConsigneeOrNotifyItem,
    value: string
  ) => {
    setNotifyPartyItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'country' && countries.length > 0) {
          const match = countries.find(
            (c: any) =>
              c.name?.toLowerCase() === value.trim().toLowerCase() ||
              c.code?.toLowerCase() === value.trim().toLowerCase()
          );
          if (match) {
            updated.country_id = match.id || '';
            if (match.code) updated.country_code = match.code;
          }
        }
        return updated;
      })
    );
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`notify_${field}_${id}`];
      delete next[`${field}_${id}`];
      delete next.notify_party_items;
      return next;
    });
  };

  const handleSaveNotifyPartiesSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!savedBuyerId) {
      toast.error('Please save business details first');
      setActiveTab('business');
      return;
    }

    if (!validateNotifyPartyItems()) return;

    setIsSavingNotifyParties(true);

    const cleanNotifyParties: ConsigneeOrNotifyItem[] = notifyPartyItems
      .filter((n) => n && n.company_name.trim())
      .map((n) => {
        const isExisting = Boolean(n.id && existingBackendNotifyIds.has(n.id));
        const phoneCode = (n.phone_country_code || (n.country_code?.startsWith('+') || /^\d+$/.test(n.country_code || '') ? n.country_code : '') || '').trim();
        return {
          id: n.id,
          is_new: !isExisting,
          is_active: n.is_active !== false,
          company_name: n.company_name.trim(),
          certificate_name_number: n.certificate_name_number.trim(),
          address: n.address.trim(),
          city: n.city.trim(),
          state: n.state.trim(),
          country: n.country.trim(),
          country_code: phoneCode || n.country_code?.trim() || '',
          country_id: n.country_id?.trim() || '',
          zip_code: n.zip_code.trim(),
          email: n.email.trim(),
          phone_country_code: phoneCode,
          contact_number: n.contact_number.trim(),
        };
      });

    if (cleanNotifyParties.length === 0) {
      setIsSavingNotifyParties(false);
      toast.error('Please enter at least one notify party company name');
      return;
    }

    try {
      if (onSaveNotifyParties) {
        const res = await onSaveNotifyParties(cleanNotifyParties, savedBuyerId);
        if (res && res.success) {
          toast.success(res.message || 'Notify party details saved successfully!');
          setExistingBackendNotifyIds((prev) => {
            const next = new Set(prev);
            cleanNotifyParties.forEach((n: any) => {
              if (n.id) next.add(n.id);
            });
            return next;
          });
          onClose();
        } else {
          const backendErrors: Record<string, string> = {};
          const parseError = (ef: any) => {
            if (!ef) return;
            const fKey = String(ef.field || ef.property || ef.param || '');
            const msg = String(ef.message || ef.msg || ef.error || 'Invalid value');

            // Find index, e.g. notify_parties.0.company_name or items[0].email
            const idxMatch = fKey.match(/(?:notify_parties?|items?)?\.?\[?(\d+)\]?/i);
            const targetIdx = idxMatch ? parseInt(idxMatch[1], 10) : 0;
            const targetItem = notifyPartyItems[targetIdx] || notifyPartyItems[0];
            const targetId = targetItem?.id || '';

            if (fKey.includes('company_name') || fKey.includes('name')) {
              if (targetId) backendErrors[`notify_company_name_${targetId}`] = msg;
            } else if (fKey.includes('email')) {
              if (targetId) backendErrors[`notify_email_${targetId}`] = msg;
            } else if (fKey.includes('contact_number') || fKey.includes('phone')) {
              if (targetId) backendErrors[`notify_contact_number_${targetId}`] = msg;
            } else if (fKey.includes('country_id') || fKey.includes('country')) {
              if (targetId) backendErrors[`notify_country_${targetId}`] = msg;
            } else if (fKey.includes('zip_code') || fKey.includes('zipcode')) {
              if (targetId) backendErrors[`notify_zip_code_${targetId}`] = msg;
            } else if (fKey.includes('certificate')) {
              if (targetId) backendErrors[`notify_certificate_${targetId}`] = msg;
            } else if (fKey.includes('address')) {
              if (targetId) backendErrors[`notify_address_${targetId}`] = msg;
            } else if (fKey.includes('city')) {
              if (targetId) backendErrors[`notify_city_${targetId}`] = msg;
            } else if (fKey.includes('state')) {
              if (targetId) backendErrors[`notify_state_${targetId}`] = msg;
            }
          };

          const rawErrors = res?.error_fields || res?.errors || [];
          if (Array.isArray(rawErrors)) {
            rawErrors.forEach(parseError);
          } else if (rawErrors && typeof rawErrors === 'object') {
            Object.entries(rawErrors).forEach(([k, v]) => parseError({ field: k, message: String(v) }));
          }

          if (Object.keys(backendErrors).length > 0) {
            setErrors((prev) => ({ ...prev, ...backendErrors }));
          }
          toast.error(res?.message || 'Failed to update notify party details');
        }
      } else {
        toast.success('Notify party details saved');
        onClose();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error saving notify parties');
    } finally {
      setIsSavingNotifyParties(false);
    }
  };

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const isOtherTabsEnabled = isBusinessSaved || Boolean(savedBuyerId);

  const modalTitle =
    mode === 'edit'
      ? dict?.smart_docs?.edit_buyer || 'Edit Buyer / Importer'
      : dict?.smart_docs?.add_buyer || 'Add New Buyer / Importer';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="buyer-manage-title"
      className="fixed inset-0 w-screen h-screen z-9999 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/60 dark:bg-black/75 animate-in fade-in duration-200"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
        className="w-full max-w-2xl max-h-[85vh] bg-card border border-border text-foreground rounded-2xl shadow-2xl overflow-hidden flex flex-col transform-gpu animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header (Exact same as Seller) */}
        <div
          style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
          className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card shrink-0 transform-gpu"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-8.5 h-8.5 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm shrink-0">
              <i
                className={`fa-solid ${
                  mode === 'edit' ? 'fa-pen-to-square' : 'fa-cart-shopping'
                }`}
              />
            </span>
            <h3
              id="buyer-manage-title"
              className="text-sm sm:text-base font-bold text-foreground leading-tight"
            >
              {modalTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSavingBusiness || isSavingConsignees || isSavingNotifyParties}
            aria-label="Close"
            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* 3 Tabs Navigation Header */}
        <div
          style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
          className="px-5 pt-2 pb-0 border-b border-border bg-card shrink-0 transform-gpu"
        >
          <div className="flex items-center gap-2 overflow-x-auto">
            {/* Tab 1: Business Details */}
            <button
              type="button"
              onClick={() => setActiveTab('business')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'business'
                  ? 'border-brand-blue text-brand-blue'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <i className="fa-solid fa-building text-xs" />
              <span>{dict?.smart_docs?.business_details || 'Business Details'}</span>
            </button>

            {/* Tab 2: Consignee Details */}
            <button
              type="button"
              onClick={() => {
                if (isOtherTabsEnabled) {
                  setActiveTab('consignee');
                } else {
                  toast.info('Please save Business Details first to enable Consignee Details');
                }
              }}
              disabled={!isOtherTabsEnabled}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'consignee'
                  ? 'border-brand-blue text-brand-blue'
                  : isOtherTabsEnabled
                  ? 'border-transparent text-muted-foreground hover:text-foreground hover:border-border cursor-pointer'
                  : 'border-transparent text-muted-foreground/40 cursor-not-allowed'
              }`}
            >
              <i className="fa-solid fa-dolly text-xs" />
              <span>{dict?.smart_docs?.consignee_details_label || 'Consignee Details'}</span>
              {!isOtherTabsEnabled && (
                <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded ml-0.5">
                  <i className="fa-solid fa-lock text-[9px]" />
                  <span>Locked</span>
                </span>
              )}
            </button>

            {/* Tab 3: Notify Party Details */}
            <button
              type="button"
              onClick={() => {
                if (isOtherTabsEnabled) {
                  setActiveTab('notify_party');
                } else {
                  toast.info('Please save Business Details first to enable Notify Party Details');
                }
              }}
              disabled={!isOtherTabsEnabled}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'notify_party'
                  ? 'border-brand-blue text-brand-blue'
                  : isOtherTabsEnabled
                  ? 'border-transparent text-muted-foreground hover:text-foreground hover:border-border cursor-pointer'
                  : 'border-transparent text-muted-foreground/40 cursor-not-allowed'
              }`}
            >
              <i className="fa-solid fa-bell text-xs" />
              <span>{dict?.smart_docs?.notify_party_details_label || 'Notify Party Details'}</span>
              {!isOtherTabsEnabled && (
                <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded ml-0.5">
                  <i className="fa-solid fa-lock text-[9px]" />
                  <span>Locked</span>
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        {isLoading ? (
          <div
            style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
            className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar p-5 space-y-4 animate-pulse transform-gpu"
          >
            {/* Shimmer Skeletons matching SellerManageModal exactly */}
            <div className="flex flex-col sm:flex-row gap-3.5 items-start">
              <div className="flex flex-col gap-1.5 shrink-0 self-center sm:self-start">
                <div className="h-3.5 w-24 bg-muted/70 rounded" />
                <div className="w-[110px] h-[110px] rounded-lg bg-muted/40 border border-border" />
              </div>
              <div className="flex-1 w-full flex flex-col justify-between gap-2.5">
                <div className="flex flex-col gap-1.5">
                  <div className="h-3.5 w-28 bg-muted/70 rounded" />
                  <div className="w-full h-10 bg-muted/40 rounded-lg border border-border" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="h-3.5 w-40 bg-muted/70 rounded" />
                  <div className="w-full h-10 bg-muted/40 rounded-lg border border-border" />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="h-3.5 w-20 bg-muted/70 rounded" />
              <div className="w-full h-20 bg-muted/40 rounded-lg border border-border" />
            </div>
          </div>
        ) : (
          <div
            ref={modalBodyRef}
            style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden', WebkitOverflowScrolling: 'touch' }}
            className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar p-5 space-y-4 text-xs sm:text-sm transform-gpu"
          >
            {/* ======================================================== */}
            {/* TAB 1: BUSINESS DETAILS (EXACT SAME AS SELLER) */}
            {/* ======================================================== */}
            {activeTab === 'business' ? (
              <form onSubmit={handleSaveBusinessSubmit} className="space-y-4">
                {/* Row 1: Left Square Logo (110x110) & Right 2 Inputs */}
                <div className="flex flex-col sm:flex-row gap-3.5 items-start">
                  {/* Left: Square Company Logo */}
                  <div className="flex flex-col gap-1 shrink-0 self-center sm:self-start">
                    <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1 leading-4">
                      Company Logo
                    </label>

                    <input
                      ref={logoFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileUpload}
                      className="hidden"
                    />

                    {companyLogo ? (
                      <div className="relative w-[110px] h-[110px] aspect-square rounded-lg border border-border bg-background p-1.5 flex items-center justify-center group shadow-2xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={formatAssetUrl(companyLogo)}
                          alt="Company Logo"
                          className="w-full h-full object-contain rounded"
                        />
                        {/* Cross to Clear */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCompanyLogo('');
                            clearFieldError('company_logo', 'logo');
                          }}
                          title="Remove logo"
                          aria-label="Remove logo"
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center shadow-xs text-[10px] hover:bg-destructive/90 transition-colors cursor-pointer z-10"
                        >
                          <i className="fa-solid fa-xmark" />
                        </button>
                        {/* Edit to Change */}
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          title="Change logo"
                          className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-background/90 text-foreground border border-border text-[9px] font-medium shadow-xs hover:bg-muted flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <i className="fa-solid fa-pen text-[8px]" />
                          <span>Edit</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => logoFileInputRef.current?.click()}
                        className="w-[110px] h-[110px] aspect-square rounded-lg border-2 border-dashed border-border hover:border-muted-foreground/60 bg-muted/20 flex flex-col items-center justify-center cursor-pointer transition-colors text-muted-foreground hover:text-foreground shadow-2xs"
                      >
                        <i className="fa-regular fa-image text-2xl mb-1" />
                        <span className="text-[11px] font-semibold">Upload Logo</span>
                      </button>
                    )}
                  </div>

                  {/* Right: 2 Stacked Inputs */}
                  <div className="flex-1 w-full flex flex-col justify-between gap-2.5">
                    {/* Input 1: Company Name */}
                    <div className="flex flex-col gap-1">
                      <label htmlFor="company_name_input" className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1 leading-4">
                        <span>Company Name</span>
                        <span className="text-destructive">*</span>
                      </label>
                      <input
                        id="company_name_input"
                        ref={companyNameInputRef}
                        type="text"
                        value={companyName}
                        onChange={(e) => {
                          setCompanyName(e.target.value);
                          clearFieldError('company_name', 'companyName');
                        }}
                        placeholder="Enter company / business name"
                        className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors ${
                          errors.company_name
                            ? 'border-destructive focus:ring-1 focus:ring-destructive'
                            : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                        }`}
                      />
                      {errors.company_name && (
                        <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                          <i className="fa-solid fa-circle-exclamation text-[10px]" />
                          <span>{errors.company_name}</span>
                        </span>
                      )}
                    </div>

                    {/* Input 2: Certificate Name & Number */}
                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1 leading-4">
                        Certificate Name & Number
                      </label>
                      <input
                        type="text"
                        value={certificateNameNumber}
                        onChange={(e) => {
                          setCertificateNameNumber(e.target.value);
                          clearFieldError('certificate_name_number', 'certificate_name_and_number');
                        }}
                        placeholder="e.g. IEC / GSTIN / ISO 9001"
                        className="w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: Address Text Area */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    Address
                  </label>
                  <textarea
                    rows={3}
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      clearFieldError('address');
                    }}
                    placeholder="Enter full address, street, warehouse / office location..."
                    className="w-full p-3 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors resize-none leading-relaxed"
                  />
                </div>

                {/* Row 3: City & State */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        clearFieldError('city');
                      }}
                      placeholder="Enter city"
                      className="w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      State / Province
                    </label>
                    <input
                      type="text"
                      value={stateName}
                      onChange={(e) => {
                        setStateName(e.target.value);
                        clearFieldError('state', 'stateName');
                      }}
                      placeholder="Enter state / province"
                      className="w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Row 4: Country & Zipcode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                  <CountrySelectField
                    label="Country"
                    selectedCountryName={selectedCountryName}
                    selectedCountryCode={selectedCountryCode}
                    selectedCountryId={selectedCountryId}
                    countries={countries}
                    allCountries={allCountries}
                    onSelect={(sel) => {
                      setSelectedCountryName(sel.name);
                      setSelectedCountryCode(sel.code);
                      setSelectedCountryId(sel.id);
                      clearFieldError('country', 'country_id');
                    }}
                    error={errors.country}
                  />

                  {/* Zipcode */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      Zipcode
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={zipcode}
                      onChange={(e) => {
                        setZipcode(e.target.value.replace(/[^\d-]/g, ''));
                        clearFieldError('zip_code', 'zipcode');
                      }}
                      placeholder="Postal / Zip code"
                      className="w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Row 5: Email & Contact Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearFieldError('email');
                      }}
                      placeholder="e.g. info@company.com"
                      className="w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors"
                    />
                  </div>

                  <PhoneInputField
                    label="Contact Number"
                    phoneCountryCode={phoneCountryCode}
                    contactNumber={contactNumber}
                    allPhoneCountries={allPhoneCountries}
                    onChange={({ phoneCountryCode: newCode, contactNumber: newNum }) => {
                      setPhoneCountryCode(newCode);
                      setContactNumber(newNum);
                      clearFieldError('contact_number', 'contactNumber', 'country_code');
                    }}
                    error={errors.contact_number}
                  />
                </div>

                {/* Row 6: Authority Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    Authority Name
                  </label>
                  <input
                    type="text"
                    value={authorityName}
                    onChange={(e) => {
                      setAuthorityName(e.target.value);
                      clearFieldError('authority_name', 'authorityName');
                    }}
                    placeholder="Authorized signatory name"
                    className="w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors"
                  />
                </div>

                {/* Row 7: Authority Signature */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    Authority Signature
                  </label>
                  <div className="w-full">
                    <DocSignatureBox
                      partyType="importer"
                      signatureUrl={authorisedSignature}
                      onSignatureChange={(val: string) => {
                        setAuthorisedSignature(val);
                        clearFieldError('authorised_signature', 'authority_signature', 'signature');
                      }}
                      hideTitleFields={true}
                      className="!p-0 w-full [&>div:first-of-type]:!my-0 [&>div:first-of-type]:!h-36 sm:[&>div:first-of-type]:!h-40"
                    />
                  </div>
                </div>
              </form>
            ) : activeTab === 'consignee' ? (
              /* ======================================================== */
              /* TAB 2: CONSIGNEE DETAILS (Matching Bank Unified Container) */
              /* ======================================================== */
              <form onSubmit={handleSaveConsigneesSubmit} className="space-y-3">
                <div className="rounded-xl border border-border bg-muted/20 dark:bg-muted/15 p-3.5 sm:p-4 space-y-3">
                  {/* Top Bar inside the container: Title & Linked with Company on Left, Count Badge on Right */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs shrink-0">
                        <i className="fa-solid fa-dolly" />
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                          <span>Consignee Details</span>
                          {isLoadingConsignees && (
                            <i className="fa-solid fa-circle-notch fa-spin text-brand-blue text-xs" />
                          )}
                        </h4>
                        {companyName && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <span>•</span>
                            <span>Linked with:</span>
                            <strong className="text-foreground font-semibold">{companyName}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="self-start sm:self-auto px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
                      {consigneeItems.length} {consigneeItems.length === 1 ? 'Consignee' : 'Consignees'}
                    </span>
                  </div>

                  <hr className="border-t border-border/70" />

                  {/* Consignee Accounts List */}
                  <div className="space-y-3.5">
                    {consigneeItems.map((item, index) => (
                      <div key={item.id} className="space-y-2.5">
                        {/* Item Header */}
                        <div className="flex items-center justify-between pb-1 gap-2 border-b border-border/40">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-bold">
                              {index + 1}
                            </span>
                            <span>Consignee Option #{index + 1}</span>
                          </span>

                          <div className="flex items-center gap-3">
                            {/* Status Switch */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-muted-foreground select-none">
                                {item.is_active !== false ? 'Active' : 'Inactive'}
                              </span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={item.is_active !== false}
                                onClick={() => {
                                  const newStatus = item.is_active === false ? true : false;
                                  setConsigneeItems((prev) =>
                                    prev.map((c) => (c.id === item.id ? { ...c, is_active: newStatus } : c))
                                  );
                                }}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-brand-blue ${
                                  item.is_active !== false ? 'bg-brand-blue' : 'bg-muted-foreground/30'
                                }`}
                                title={item.is_active !== false ? 'Active' : 'Inactive'}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                    item.is_active !== false ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>

                            {(consigneeItems.length > 1 || existingBackendConsigneeIds.has(item.id)) && (
                              <button
                                type="button"
                                onClick={() => handleRemoveConsignee(item)}
                                disabled={deletingConsigneeId === item.id}
                                title={existingBackendConsigneeIds.has(item.id) ? "Delete consignee from server" : "Remove consignee"}
                                className="w-6.5 h-6.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {deletingConsigneeId === item.id ? (
                                  <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                                ) : (
                                  <i className="fa-solid fa-trash-can text-xs" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Fields (Same as Business Details, WITHOUT Logo, Signature, Authority) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {/* Company Name */}
                          <div className="flex flex-col gap-1">
                            <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1 leading-4">
                              <span>Company Name</span>
                              <span className="text-destructive">*</span>
                            </label>
                            <input
                              id={`consignee_company_name_${item.id}`}
                              type="text"
                              value={item.company_name}
                              onChange={(e) => handleConsigneeChange(item.id, 'company_name', e.target.value)}
                              placeholder="Enter consignee company name"
                              className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors ${
                                errors[`consignee_company_name_${item.id}`]
                                  ? 'border-destructive focus:ring-1 focus:ring-destructive'
                                  : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                              }`}
                            />
                            {errors[`consignee_company_name_${item.id}`] && (
                              <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                                <i className="fa-solid fa-circle-exclamation text-[10px]" />
                                <span>{errors[`consignee_company_name_${item.id}`]}</span>
                              </span>
                            )}
                          </div>

                          {/* Certificate Name & Number */}
                          <div className="flex flex-col gap-1">
                            <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1 leading-4">
                              Certificate Name & Number
                            </label>
                            <input
                              type="text"
                              value={item.certificate_name_number}
                              onChange={(e) => handleConsigneeChange(item.id, 'certificate_name_number', e.target.value)}
                              placeholder="e.g. IEC / Tax ID"
                              className="w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors"
                            />
                          </div>
                        </div>

                        {/* Address */}
                        <div className="flex flex-col gap-1.5">
                          <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            Address
                          </label>
                          <textarea
                            rows={3}
                            value={item.address}
                            onChange={(e) => handleConsigneeChange(item.id, 'address', e.target.value)}
                            placeholder="Full delivery / consignee address..."
                            className="w-full p-3 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors resize-none leading-relaxed"
                          />
                        </div>

                        {/* City & State */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                          <div className="flex flex-col gap-1.5">
                            <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              City
                            </label>
                            <input
                              type="text"
                              value={item.city}
                              onChange={(e) => handleConsigneeChange(item.id, 'city', e.target.value)}
                              placeholder="Enter city"
                              className="w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              State / Province
                            </label>
                            <input
                              type="text"
                              value={item.state}
                              onChange={(e) => handleConsigneeChange(item.id, 'state', e.target.value)}
                              placeholder="Enter state / province"
                              className="w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors"
                            />
                          </div>
                        </div>

                        {/* Country & Zipcode */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                          <CountrySelectField
                            label="Country"
                            selectedCountryName={item.country}
                            selectedCountryCode={(item.country_code as Country) || null}
                            selectedCountryId={item.country_id}
                            countries={countries}
                            allCountries={allCountries}
                            onSelect={(sel) => {
                              setConsigneeItems((prev) =>
                                prev.map((c) =>
                                  c.id === item.id
                                    ? {
                                        ...c,
                                        country: sel.name,
                                        country_code: sel.code || '',
                                        country_id: sel.id || '',
                                      }
                                    : c
                                )
                              );
                              setErrors((prev) => {
                                const next = { ...prev };
                                delete next[`consignee_country_${item.id}`];
                                return next;
                              });
                            }}
                            error={errors[`consignee_country_${item.id}`]}
                          />

                          <div className="flex flex-col gap-1.5">
                            <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              Zipcode
                            </label>
                            <input
                              type="text"
                              value={item.zip_code}
                              onChange={(e) => handleConsigneeChange(item.id, 'zip_code', e.target.value.replace(/[^\d-]/g, ''))}
                              placeholder="Postal / Zip code"
                              className="w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors"
                            />
                          </div>
                        </div>

                        {/* Email & Contact Number */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                          <div className="flex flex-col gap-1.5">
                            <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              Email
                            </label>
                            <input
                              type="email"
                              value={item.email}
                              onChange={(e) => handleConsigneeChange(item.id, 'email', e.target.value)}
                              placeholder="consignee@example.com"
                              className="w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors"
                            />
                          </div>

                          <PhoneInputField
                            label="Contact Number"
                            phoneCountryCode={
                              item.phone_country_code ||
                              (item.country_code?.startsWith('+') || /^\d+$/.test(item.country_code || '')
                                ? item.country_code
                                : '') ||
                              ''
                            }
                            contactNumber={item.contact_number}
                            allPhoneCountries={allPhoneCountries}
                            onChange={({ phoneCountryCode: newCode, contactNumber: newNum }) => {
                              setConsigneeItems((prev) =>
                                prev.map((c) =>
                                  c.id === item.id
                                    ? {
                                        ...c,
                                        phone_country_code: newCode,
                                        country_code: newCode || c.country_code,
                                        contact_number: newNum,
                                      }
                                    : c
                                )
                              );
                              setErrors((prev) => {
                                const next = { ...prev };
                                delete next[`consignee_contact_number_${item.id}`];
                                return next;
                              });
                            }}
                            error={errors[`consignee_contact_number_${item.id}`]}
                          />
                        </div>

                        {index < consigneeItems.length - 1 && (
                          <hr className="border-t border-border/50 my-2" />
                        )}
                      </div>
                    ))}
                  </div>

                  <div ref={consigneesEndRef} />

                  {/* Add More Consignee Button */}
                  <button
                    type="button"
                    onClick={handleAddConsignee}
                    className="w-full h-9 rounded-lg border border-dashed border-primary/50 hover:border-primary bg-background hover:bg-primary/5 text-primary font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <i className="fa-solid fa-plus text-xs" />
                    <span>Add more consignee details</span>
                  </button>
                </div>
              </form>
            ) : (
              /* ======================================================== */
              /* TAB 3: NOTIFY PARTY DETAILS (Matching Bank Unified Container) */
              /* ======================================================== */
              <form onSubmit={handleSaveNotifyPartiesSubmit} className="space-y-3">
                <div className="rounded-xl border border-border bg-muted/20 dark:bg-muted/15 p-3.5 sm:p-4 space-y-3">
                  {/* Top Bar inside the container: Title & Linked with Company on Left, Count Badge on Right */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs shrink-0">
                        <i className="fa-solid fa-bell" />
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                          <span>Notify Party Details</span>
                          {isLoadingNotifyParties && (
                            <i className="fa-solid fa-circle-notch fa-spin text-brand-blue text-xs" />
                          )}
                        </h4>
                        {companyName && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <span>•</span>
                            <span>Linked with:</span>
                            <strong className="text-foreground font-semibold">{companyName}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="self-start sm:self-auto px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
                      {notifyPartyItems.length} {notifyPartyItems.length === 1 ? 'Notify Party' : 'Notify Parties'}
                    </span>
                  </div>

                  <hr className="border-t border-border/70" />

                  {/* Notify Party List */}
                  <div className="space-y-3.5">
                    {notifyPartyItems.map((item, index) => (
                      <div key={item.id} className="space-y-2.5">
                        {/* Item Header */}
                        <div className="flex items-center justify-between pb-1 gap-2 border-b border-border/40">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-bold">
                              {index + 1}
                            </span>
                            <span>Notify Party Option #{index + 1}</span>
                          </span>

                          <div className="flex items-center gap-3">
                            {/* Status Switch */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-muted-foreground select-none">
                                {item.is_active !== false ? 'Active' : 'Inactive'}
                              </span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={item.is_active !== false}
                                onClick={() => {
                                  const newStatus = item.is_active === false ? true : false;
                                  setNotifyPartyItems((prev) =>
                                    prev.map((n) => (n.id === item.id ? { ...n, is_active: newStatus } : n))
                                  );
                                }}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-brand-blue ${
                                  item.is_active !== false ? 'bg-brand-blue' : 'bg-muted-foreground/30'
                                }`}
                                title={item.is_active !== false ? 'Active' : 'Inactive'}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                    item.is_active !== false ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>

                            {(notifyPartyItems.length > 1 || existingBackendNotifyIds.has(item.id)) && (
                              <button
                                type="button"
                                onClick={() => handleRemoveNotifyParty(item)}
                                disabled={deletingNotifyPartyId === item.id}
                                title={existingBackendNotifyIds.has(item.id) ? "Delete notify party from server" : "Remove notify party"}
                                className="w-6.5 h-6.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {deletingNotifyPartyId === item.id ? (
                                  <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                                ) : (
                                  <i className="fa-solid fa-trash-can text-xs" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="flex flex-col gap-1">
                            <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1 leading-4">
                              <span>Company Name</span>
                              <span className="text-destructive">*</span>
                            </label>
                            <input
                              id={`notify_company_name_${item.id}`}
                              type="text"
                              value={item.company_name}
                              onChange={(e) => handleNotifyPartyChange(item.id, 'company_name', e.target.value)}
                              placeholder="Enter notify party company name"
                              className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors ${
                                errors[`notify_company_name_${item.id}`]
                                  ? 'border-destructive focus:ring-1 focus:ring-destructive'
                                  : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                              }`}
                            />
                            {errors[`notify_company_name_${item.id}`] && (
                              <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                                <i className="fa-solid fa-circle-exclamation text-[10px]" />
                                <span>{errors[`notify_company_name_${item.id}`]}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1 leading-4">
                              Certificate Name & Number
                            </label>
                            <input
                              type="text"
                              value={item.certificate_name_number}
                              onChange={(e) => handleNotifyPartyChange(item.id, 'certificate_name_number', e.target.value)}
                              placeholder="e.g. IEC / Tax ID"
                              className="w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            Address
                          </label>
                          <textarea
                            rows={3}
                            value={item.address}
                            onChange={(e) => handleNotifyPartyChange(item.id, 'address', e.target.value)}
                            placeholder="Full address of notify party..."
                            className="w-full p-3 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors resize-none leading-relaxed"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                          <div className="flex flex-col gap-1.5">
                            <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              City
                            </label>
                            <input
                              type="text"
                              value={item.city}
                              onChange={(e) => handleNotifyPartyChange(item.id, 'city', e.target.value)}
                              placeholder="Enter city"
                              className="w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              State / Province
                            </label>
                            <input
                              type="text"
                              value={item.state}
                              onChange={(e) => handleNotifyPartyChange(item.id, 'state', e.target.value)}
                              placeholder="Enter state / province"
                              className="w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                          <CountrySelectField
                            label="Country"
                            selectedCountryName={item.country}
                            selectedCountryCode={(item.country_code as Country) || null}
                            selectedCountryId={item.country_id}
                            countries={countries}
                            allCountries={allCountries}
                            onSelect={(sel) => {
                              setNotifyPartyItems((prev) =>
                                prev.map((n) =>
                                  n.id === item.id
                                    ? {
                                        ...n,
                                        country: sel.name,
                                        country_code: sel.code || '',
                                        country_id: sel.id || '',
                                      }
                                    : n
                                )
                              );
                              setErrors((prev) => {
                                const next = { ...prev };
                                delete next[`notify_country_${item.id}`];
                                return next;
                              });
                            }}
                            error={errors[`notify_country_${item.id}`]}
                          />

                          <div className="flex flex-col gap-1.5">
                            <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              Zipcode
                            </label>
                            <input
                              type="text"
                              value={item.zip_code}
                              onChange={(e) => handleNotifyPartyChange(item.id, 'zip_code', e.target.value.replace(/[^\d-]/g, ''))}
                              placeholder="Postal / Zip code"
                              className="w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                          <div className="flex flex-col gap-1.5">
                            <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              Email
                            </label>
                            <input
                              type="email"
                              value={item.email}
                              onChange={(e) => handleNotifyPartyChange(item.id, 'email', e.target.value)}
                              placeholder="notify@example.com"
                              className="w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg outline-none transition-colors"
                            />
                          </div>

                          <PhoneInputField
                            label="Contact Number"
                            phoneCountryCode={
                              item.phone_country_code ||
                              (item.country_code?.startsWith('+') || /^\d+$/.test(item.country_code || '')
                                ? item.country_code
                                : '') ||
                              ''
                            }
                            contactNumber={item.contact_number}
                            allPhoneCountries={allPhoneCountries}
                            onChange={({ phoneCountryCode: newCode, contactNumber: newNum }) => {
                              setNotifyPartyItems((prev) =>
                                prev.map((n) =>
                                  n.id === item.id
                                    ? {
                                        ...n,
                                        phone_country_code: newCode,
                                        country_code: newCode || n.country_code,
                                        contact_number: newNum,
                                      }
                                    : n
                                )
                              );
                              setErrors((prev) => {
                                const next = { ...prev };
                                delete next[`notify_contact_number_${item.id}`];
                                return next;
                              });
                            }}
                            error={errors[`notify_contact_number_${item.id}`]}
                          />
                        </div>

                        {index < notifyPartyItems.length - 1 && (
                          <hr className="border-t border-border/50 my-2" />
                        )}
                      </div>
                    ))}
                  </div>

                  <div ref={notifyEndRef} />

                  {/* Add More Notify Party Button */}
                  <button
                    type="button"
                    onClick={handleAddNotifyParty}
                    className="w-full h-9 rounded-lg border border-dashed border-primary/50 hover:border-primary bg-background hover:bg-primary/5 text-primary font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <i className="fa-solid fa-plus text-xs" />
                    <span>Add more notify party details</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Modal Actions Footer (EXACT SAME AS SELLER: bg-brand-green, same dimensions, same active effects) */}
        <div
          style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
          className="sticky bottom-0 z-20 flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-border bg-card shrink-0 transform-gpu shadow-md"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSavingBusiness || isSavingConsignees || isSavingNotifyParties}
            className="h-9.5 px-4 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            {dict?.common?.cancel || 'Cancel'}
          </button>

          {activeTab === 'business' ? (
            <button
              type="button"
              onClick={handleSaveBusinessSubmit}
              disabled={isSavingBusiness || isLoading}
              className="h-9.5 px-5 text-xs font-bold rounded-lg bg-brand-green hover:bg-brand-green-hover text-white shadow-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSavingBusiness ? (
                <i className="fa-solid fa-circle-notch fa-spin text-xs" />
              ) : (
                <i className="fa-solid fa-arrow-right text-xs" />
              )}
              <span>
                {mode === 'add'
                  ? 'Save & Continue to Consignee Details'
                  : 'Update Business Details'}
              </span>
            </button>
          ) : activeTab === 'consignee' ? (
            <button
              type="button"
              onClick={handleSaveConsigneesSubmit}
              disabled={isSavingConsignees || isLoading}
              className="h-9.5 px-5 text-xs font-bold rounded-lg bg-brand-green hover:bg-brand-green-hover text-white shadow-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSavingConsignees ? (
                <i className="fa-solid fa-circle-notch fa-spin text-xs" />
              ) : (
                <i className="fa-solid fa-arrow-right text-xs" />
              )}
              <span>Save & Continue to Notify Party</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveNotifyPartiesSubmit}
              disabled={isSavingNotifyParties || isLoading}
              className="h-9.5 px-5 text-xs font-bold rounded-lg bg-brand-green hover:bg-brand-green-hover text-white shadow-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSavingNotifyParties ? (
                <i className="fa-solid fa-circle-notch fa-spin text-xs" />
              ) : (
                <i className="fa-solid fa-check text-xs" />
              )}
              <span>Save Notify Party Details</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
