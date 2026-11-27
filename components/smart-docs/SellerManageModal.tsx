'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import flags from 'react-phone-number-input/flags';
import { getCountries, getCountryCallingCode, parsePhoneNumber, type Country } from 'react-phone-number-input';
import en from 'react-phone-number-input/locale/en.json';
import CountrySelectField from './CountrySelectField';
import PhoneInputField from './PhoneInputField';
import { handleFormFocusScroll } from './form-scroll-utils';
import DocSignatureBox from '@/components/smart-docs/draft/form/DocSignatureBox';
import {
  getSellerBankDetailsAction,
  deleteSellerBankDetailAction,
} from '@/app/actions/smart-docs';
import {
  generateSmartDocsCuid,
  isValidCuidOrId,
  formatAssetUrl,
} from '@/lib/api/smart-docs.service';
import { toast } from 'sonner';

const countryNames = en as Record<string, string>;

export interface BankDetailItem {
  id: string;
  name: string;
  account_details: string;
}

export const DEFAULT_BANK_DETAILS_TEMPLATE = `A/C Holder Name: 
A/C Number: 
Address: 
Email: 
Contact: `;

export const isBankDetailsTemplateEmpty = (text?: string): boolean => {
  if (!text || !text.trim()) return true;
  const stripped = text
    .replace(/A\/C\s*Holder\s*Name\s*:\s*/gi, '')
    .replace(/A\/C\s*Number\s*:\s*/gi, '')
    .replace(/Address\s*:\s*/gi, '')
    .replace(/Email\s*:\s*/gi, '')
    .replace(/Contact\s*:\s*/gi, '')
    .trim();
  return stripped.length === 0;
};

const generateBankCuid = generateSmartDocsCuid;

const POPULAR_COUNTRY_CODES: Country[] = [
  'IN', // India
  'AE', // UAE
  'VN', // Vietnam
  'BR', // Brazil
  'CN', // China
  'US', // USA
  'TH', // Thailand
  'ID', // Indonesia
  'SG', // Singapore
  'MY', // Malaysia
  'TR', // Turkey
  'EG', // Egypt
  'BD', // Bangladesh
  'PK', // Pakistan
  'ZA', // South Africa
  'RU', // Russia
  'UA', // Ukraine
  'CA', // Canada
  'AU', // Australia
  'AR', // Argentina
];

const POPULAR_PHONE_COUNTRY_CODES: Country[] = [
  'IN', // +91
  'AE', // +971
  'US', // +1
  'GB', // +44
  'VN', // +84
  'TH', // +66
  'CN', // +86
  'SG', // +65
  'MY', // +60
  'CA', // +1
  'AU', // +61
  'TR', // +90
  'EG', // +20
  'BD', // +880
  'PK', // +92
  'BR', // +55
  'ZA', // +27
];

export interface SellerFormData {
  id?: string;
  type: 'S';
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
  bank_name: string;
  bank_details: string;
}

export interface SellerManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  seller?: any | null;
  countries?: any[];
  onSaveBusiness: (
    businessData: Partial<SellerFormData> | FormData | any
  ) => Promise<{ success: boolean; data?: any; message?: string; error_fields?: any[]; errors?: any }>;
  onSaveBank?: (
    bankData: Partial<SellerFormData> | FormData | any,
    sellerId: string
  ) => Promise<{ success: boolean; data?: any; message?: string; error_fields?: any[]; errors?: any }>;
  onFetchBankDetails?: (
    sellerId: string
  ) => Promise<{ success: boolean; data?: { items: BankDetailItem[]; total: number } | null }>;
  onDeleteBankDetail?: (
    bankDetailId: string
  ) => Promise<{ success: boolean; message: string; data?: any }>;
  dict?: any;
  isLoading?: boolean;
  basicDetailsOnly?: boolean;
}

export default function SellerManageModal({
  isOpen,
  onClose,
  mode,
  seller,
  countries = [],
  onSaveBusiness,
  onSaveBank,
  onFetchBankDetails,
  onDeleteBankDetail,
  dict,
  isLoading = false,
  basicDetailsOnly = false,
}: SellerManageModalProps) {
  const [mounted, setMounted] = useState(false);

  // Tab State: 'business' | 'bank'
  const [activeTab, setActiveTab] = useState<'business' | 'bank'>('business');

  // Tracking the active seller id (passed from edit or received after business save)
  const [savedSellerId, setSavedSellerId] = useState<string>('');
  const [isBusinessSaved, setIsBusinessSaved] = useState<boolean>(mode === 'edit');

  // Business Details Form State
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [selectedCountryName, setSelectedCountryName] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState<Country | null>(null);
  const [selectedCountryId, setSelectedCountryId] = useState('');

  // Contact Number & Calling Code (Decoupled from address country, ZERO forced defaults)
  const [contactNumber, setContactNumber] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<Country | null>(null);
  const [isPhoneDropdownOpen, setIsPhoneDropdownOpen] = useState(false);
  const [phoneSearch, setPhoneSearch] = useState('');
  const phoneDropdownRef = useRef<HTMLDivElement>(null);
  const phoneSearchInputRef = useRef<HTMLInputElement>(null);
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const banksEndRef = useRef<HTMLDivElement>(null);

  const [zipcode, setZipcode] = useState('');
  const [email, setEmail] = useState('');
  const [certificateNameNumber, setCertificateNameNumber] = useState('');
  const [authorityName, setAuthorityName] = useState('');
  const [authorisedSignature, setAuthorisedSignature] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');

  // Bank Details Form State (Multiple items, matching Packing Types)
  const [bankItems, setBankItems] = useState<BankDetailItem[]>([
    {
      id: generateBankCuid(),
      name: '',
      account_details: DEFAULT_BANK_DETAILS_TEMPLATE,
    },
  ]);
  const [isLoadingBankDetails, setIsLoadingBankDetails] = useState(false);
  const [fetchedBankSellerId, setFetchedBankSellerId] = useState<string>('');
  const [existingBackendBankIds, setExistingBackendBankIds] = useState<Set<string>>(new Set());
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);

  // Submitting States & Backend Field-Level Validation Errors
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Country Dropdown State
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const countrySearchInputRef = useRef<HTMLInputElement>(null);

  const backdropMouseDownRef = useRef(false);

  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const companyNameInputRef = useRef<HTMLInputElement>(null);
  const bankNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper to map backend error keys to form field keys
  const mapBackendKeyToError = useCallback(
    (rawKey: string, message: string, targetErrors: Record<string, string>) => {
      const k = rawKey.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (k.includes('company_name') || k.includes('companyname') || k === 'company' || k === 'name') {
        targetErrors.company_name = message;
      } else if (k.includes('address')) {
        targetErrors.address = message;
      } else if (k.includes('city')) {
        targetErrors.city = message;
      } else if (k.includes('state') || k.includes('province')) {
        targetErrors.state = message;
      } else if (k.includes('country')) {
        targetErrors.country = message;
      } else if (k.includes('zip') || k.includes('postal')) {
        targetErrors.zip_code = message;
      } else if (k.includes('email')) {
        targetErrors.email = message;
      } else if (k.includes('contact') || k.includes('phone') || k.includes('mobile')) {
        targetErrors.contact_number = message;
      } else if (k.includes('certificate')) {
        targetErrors.certificate_name_number = message;
      } else if (k.includes('authority_name') || k.includes('authorityname')) {
        targetErrors.authority_name = message;
      } else if (k.includes('signature')) {
        targetErrors.authorised_signature = message;
      } else if (k.includes('logo')) {
        targetErrors.company_logo = message;
      } else if (k.includes('bank_name') || k.includes('bankname')) {
        targetErrors.bank_name = message;
      } else if (k.includes('bank_details') || k.includes('bankdetails') || k.includes('bank')) {
        targetErrors.bank_details = message;
      } else {
        targetErrors[rawKey] = message;
      }
    },
    []
  );

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

  const isFirstOpenRef = useRef(false);
  const prevOpenedIdRef = useRef<string | null>(null);

  // Helper to populate seller data into state without resetting scroll or active tab
  const populateSellerData = useCallback(
    (sellerData: any) => {
      if (!sellerData) return;
      const id = String(sellerData.id || sellerData._id || sellerData.instruction_id || '');
      setSavedSellerId(id);
      setIsBusinessSaved(true);

      setCompanyName(
        sellerData.company_name ||
        sellerData.companyName ||
        sellerData.company ||
        sellerData.business_name ||
        sellerData.name ||
        ''
      );
      setAddress(sellerData.address || sellerData.address_details || sellerData.details || '');
      setCity(sellerData.city || sellerData.city_name || '');
      setStateName(sellerData.state || sellerData.state_name || sellerData.province || '');

      const countryRaw =
        sellerData.country?.name ||
        (typeof sellerData.country === 'string' ? sellerData.country : '') ||
        sellerData.country_name ||
        sellerData.countryName ||
        '';
      if (countryRaw) {
        const resolved = resolveCountry(countryRaw);
        setSelectedCountryName(resolved.name || countryRaw);
        setSelectedCountryCode(resolved.code);

        let rawCountryId = String(
          sellerData.country?.id ||
          sellerData.country_id ||
          sellerData.countryId ||
          sellerData.raw?.country_id ||
          sellerData.raw?.country?.id ||
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
      } else {
        setSelectedCountryName('');
        setSelectedCountryCode(null);
        setSelectedCountryId('');
      }

      // Contact Number & Country Code (100% decoupled from address country, ZERO forced defaults)
      const rawPhone = String(
        sellerData.contact_number || sellerData.contactNumber || sellerData.phone || sellerData.mobile || ''
      ).trim();
      const rawPCode = String(
        sellerData.country_code || sellerData.countryCode || ''
      ).trim();

      if (rawPhone.startsWith('+')) {
        try {
          const parsed = parsePhoneNumber(rawPhone);
          if (parsed) {
            setPhoneCountryCode(`+${parsed.countryCallingCode}`);
            setPhoneCountry((parsed.country as Country) || null);
            setContactNumber(parsed.nationalNumber || '');
          } else {
            setPhoneCountryCode('');
            setPhoneCountry(null);
            setContactNumber(rawPhone);
          }
        } catch {
          setPhoneCountryCode('');
          setPhoneCountry(null);
          setContactNumber(rawPhone);
        }
      } else if (rawPCode) {
        const cleanCode = rawPCode.startsWith('+') ? rawPCode : `+${rawPCode}`;
        setPhoneCountryCode(cleanCode);
        setContactNumber(rawPhone);
        const matched = allPhoneCountries.find((c) => c.callingCode === cleanCode);
        setPhoneCountry(matched?.code || null);
      } else {
        setPhoneCountryCode('');
        setPhoneCountry(null);
        setContactNumber(rawPhone);
      }
      setIsPhoneDropdownOpen(false);
      setPhoneSearch('');

      setZipcode(String(sellerData.zip_code || sellerData.zipcode || sellerData.postal_code || ''));
      setEmail(sellerData.email || sellerData.email_address || '');
      setCertificateNameNumber(
        sellerData.certificate_name_number ||
        sellerData.certificate_name_and_number ||
        sellerData.certificate_no ||
        sellerData.certificate ||
        ''
      );
      setAuthorityName(
        sellerData.authority_name || sellerData.authorityName || sellerData.authority || ''
      );
      setAuthorisedSignature(
        sellerData.authorised_signature ||
        sellerData.authority_signature ||
        sellerData.authoritySignature ||
        sellerData.signature ||
        ''
      );
      setCompanyLogo(sellerData.company_logo || sellerData.companyLogo || sellerData.logo || '');
      const fallbackName = sellerData.bank_name || sellerData.bankName || '';
      const fallbackDetails = sellerData.bank_details || sellerData.bankDetails || sellerData.bank_detail || '';
      setBankItems([
        {
          id: generateBankCuid(),
          name: fallbackName,
          account_details:
            fallbackDetails && !isBankDetailsTemplateEmpty(fallbackDetails)
              ? fallbackDetails
              : DEFAULT_BANK_DETAILS_TEMPLATE,
        },
      ]);
      setFetchedBankSellerId('');
      setExistingBackendBankIds(new Set());
      setDeletingBankId(null);
    },
    [countries, allPhoneCountries, resolveCountry]
  );

  // Sync state when modal opens or editing seller changes
  useEffect(() => {
    if (!isOpen) {
      isFirstOpenRef.current = false;
      prevOpenedIdRef.current = null;
      return;
    }

    const currentSellerId =
      mode === 'edit' && seller
        ? String(seller.id || seller._id || seller.instruction_id || '')
        : '';

    // Only populate if first open or switched to a different seller
    if (!isFirstOpenRef.current || (mode === 'edit' && currentSellerId && currentSellerId !== prevOpenedIdRef.current)) {
      isFirstOpenRef.current = true;
      prevOpenedIdRef.current = currentSellerId;

      // Always reset to Business Details tab upon opening modal
      setActiveTab('business');

      if (mode === 'edit' && seller) {
        populateSellerData(seller);
      } else {
        // Add Mode Reset - NOTHING is selected by default
        setSavedSellerId('');
        setIsBusinessSaved(false);
        setActiveTab('business');
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
        setBankItems([
          {
            id: generateBankCuid(),
            name: '',
            account_details: DEFAULT_BANK_DETAILS_TEMPLATE,
          },
        ]);
        setFetchedBankSellerId('');
        setExistingBackendBankIds(new Set());
        setDeletingBankId(null);
      }

      setErrors({});
      if (modalBodyRef.current) {
        modalBodyRef.current.scrollTop = 0;
      }
      setTimeout(() => {
        companyNameInputRef.current?.focus();
      }, 100);
      return;
    }

    // Modal was already open, same record (asynchronous detailed fetch returned):
    if (mode === 'edit' && currentSellerId && currentSellerId === prevOpenedIdRef.current && seller) {
      populateSellerData(seller);
    }
  }, [isOpen, mode, seller, populateSellerData]);

  // Scroll to top when activeTab changes
  useEffect(() => {
    if (modalBodyRef.current) {
      modalBodyRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // Click outside country dropdown to close
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

  // Click outside phone dial code dropdown to close
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

  // Backdrop Click Handlers - Do NOT close on outside click to prevent data loss
  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    // Backdrop click disabled to prevent accidental closure
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Backdrop click disabled - only explicit [X] or Cancel button closes modal
  };

  // Handle ESC key to close
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
        if (!isSavingBusiness && !isSavingBank && !isLoading) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSavingBusiness, isSavingBank, isLoading, isCountryDropdownOpen, isPhoneDropdownOpen, onClose]);

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

  // Upload Company Logo Handler
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

  // Address Country Selection (Independent of Phone number's country)
  const handleSelectCountry = (c: { code: Country | null; name: string; id?: string }) => {
    setSelectedCountryName(c.name);
    setSelectedCountryCode(c.code);

    let matchedId = c.id || '';
    if (!matchedId && countries && countries.length > 0) {
      const match = countries.find(
        (item: any) =>
          (c.code && item.iso2?.toUpperCase() === c.code.toUpperCase()) ||
          item.name?.toLowerCase() === c.name.toLowerCase()
      );
      if (match?.id) {
        matchedId = String(match.id);
      }
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

  // Phone Dial Code Selection (Independent of Address Country, ZERO forced defaults)
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

  // Contact number input handler (Supports typing and pasting full + international numbers)
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

  // Render flag helper matching ProductManageModal
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

  // Validate Business Details Form (Client pre-flight)
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

  // Validate Bank Details Form (Client pre-flight)
  const validateBankDetails = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!bankItems || bankItems.length === 0) {
      newErrors.bank_items = 'At least one bank account is required';
    } else {
      const seenNames = new Map<string, number>();

      bankItems.forEach((b, idx) => {
        const trimmedName = (b.name || '').trim();
        if (!trimmedName) {
          newErrors[`bank_name_${b.id}`] =
            bankItems.length > 1
              ? `Bank name is required for Option #${idx + 1}`
              : 'Bank name is required';
        } else {
          const lower = trimmedName.toLowerCase();
          if (seenNames.has(lower)) {
            const firstIdx = seenNames.get(lower)!;
            newErrors[`bank_name_${b.id}`] = `Duplicate bank name "${trimmedName}" (matches Option #${firstIdx + 1}). Please enter a distinct name.`;
          } else {
            seenNames.set(lower, idx);
          }
        }
      });
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstInvalidItem = bankItems.find(
        (b) => newErrors[`bank_name_${b.id}`]
      );
      if (firstInvalidItem) {
        const el = document.getElementById(`bank_name_input_${firstInvalidItem.id}`);
        if (el) el.focus();
      }
      return false;
    }

    return true;
  };

  const ensureFieldInView = (el: HTMLElement | null) => {
    if (!el || !modalBodyRef.current) return;
    const container = modalBodyRef.current;
    const rect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (rect.bottom > containerRect.bottom - 40) {
      container.scrollBy({
        top: rect.bottom - containerRect.bottom + 60,
        behavior: 'smooth',
      });
    }
  };

  const handleAddBank = () => {
    const newId = generateSmartDocsCuid();
    setBankItems((prev) => [
      ...prev,
      {
        id: newId,
        name: '',
        account_details: DEFAULT_BANK_DETAILS_TEMPLATE,
      },
    ]);

    // Force scroll modal body all the way to the bottom
    setTimeout(() => {
      if (modalBodyRef.current) {
        modalBodyRef.current.scrollTo({
          top: modalBodyRef.current.scrollHeight + 1000,
          behavior: 'smooth',
        });
      }
      const bankInput = document.getElementById(`bank_name_input_${newId}`);
      if (bankInput) {
        bankInput.focus();
      }
    }, 80);
  };

  const handleRemoveBank = async (item: BankDetailItem) => {
    const id = item.id;
    if (deletingBankId) return;

    const clearErrorsForId = (targetId: string) => {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`bank_name_${targetId}`];
        delete next[`name_${targetId}`];
        delete next[`bank_details_${targetId}`];
        delete next[`account_details_${targetId}`];
        delete next[`id_${targetId}`];
        return next;
      });
    };

    // If item exists in the backend database, call DELETE /instructions/bank-details/:bankDetailId API
    if (existingBackendBankIds.has(id)) {
      setDeletingBankId(id);
      try {
        const res = onDeleteBankDetail
          ? await onDeleteBankDetail(id)
          : await deleteSellerBankDetailAction(id, { lang: 'en', source: 'web' });

        if (res && res.success) {
          toast.success(res.message || 'Bank detail deleted successfully');
          setExistingBackendBankIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          setBankItems((prev) => {
            const filtered = prev.filter((b) => b.id !== id);
            return filtered.length > 0
              ? filtered
              : [{ id: generateSmartDocsCuid(), name: '', account_details: DEFAULT_BANK_DETAILS_TEMPLATE }];
          });
          clearErrorsForId(id);
        } else {
          toast.error(res?.message || 'Failed to delete bank detail');
        }
      } catch (err: any) {
        toast.error(err?.message || 'Error deleting bank detail');
      } finally {
        setDeletingBankId(null);
      }
    } else {
      // Unsaved local bank account row, simply remove from form state
      setBankItems((prev) => {
        const filtered = prev.filter((b) => b.id !== id);
        return filtered.length > 0
          ? filtered
          : [{ id: generateSmartDocsCuid(), name: '', account_details: DEFAULT_BANK_DETAILS_TEMPLATE }];
      });
      clearErrorsForId(id);
    }
  };

  const handleBankItemChange = (
    id: string,
    field: 'name' | 'account_details',
    value: string
  ) => {
    setBankItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
    setErrors((prev) => {
      let changed = false;
      const next = { ...prev };
      const keysToRemove = [
        `bank_${field}_${id}`,
        `${field}_${id}`,
        `bank_${field}`,
        field,
        'bank_items',
        'items',
        'general',
      ];
      keysToRemove.forEach((k) => {
        if (next[k]) {
          delete next[k];
          changed = true;
        }
      });
      Object.keys(next).forEach((k) => {
        if (k.includes(field) || k.includes('item')) {
          delete next[k];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  };

  // Helper specifically for mapping Bank Details errors to exact inputs
  const mapBankBackendError = useCallback(
    (
      rawKey: string,
      message: string,
      targetErrors: Record<string, string>,
      currentBankItems: BankDetailItem[]
    ) => {
      const k = (rawKey || '').toLowerCase();
      const msg = (message || '').toLowerCase();
      const combined = `${k} ${msg}`;

      // Check if an index is present in rawKey or message (e.g. items.0.name, items[0].name, items_0_name, 0.name, items.0.id)
      const indexMatch = combined.match(/(?:items)?[._\[\s]?(\d+)[._\]\s]?([a-zA-Z0-9_]*)/i);
      let targetIndex: number | null = null;
      let propName = '';

      if (indexMatch && indexMatch[1] !== undefined) {
        targetIndex = parseInt(indexMatch[1], 10);
        propName = (indexMatch[2] || '').toLowerCase();
      }

      if (targetIndex !== null && !isNaN(targetIndex) && currentBankItems[targetIndex]) {
        const item = currentBankItems[targetIndex];
        if (propName.includes('name') || k.includes('name') || msg.includes('name')) {
          targetErrors[`bank_name_${item.id}`] = message;
          targetErrors[`name_${item.id}`] = message;
          targetErrors[`items.${targetIndex}.name`] = message;
        } else if (
          propName.includes('detail') ||
          propName.includes('account') ||
          k.includes('detail') ||
          k.includes('account') ||
          msg.includes('detail') ||
          msg.includes('account')
        ) {
          targetErrors[`bank_details_${item.id}`] = message;
          targetErrors[`account_details_${item.id}`] = message;
          targetErrors[`items.${targetIndex}.account_details`] = message;
        } else {
          targetErrors[`bank_name_${item.id}`] = message;
        }
        return;
      }

      // Check without index
      if (
        k.includes('bank_name') ||
        k.includes('bankname') ||
        k === 'name' ||
        msg.includes('bank name') ||
        (msg.includes('name') && !msg.includes('company'))
      ) {
        const targetItem = currentBankItems.find((it) => !it.name?.trim()) || currentBankItems[0];
        if (targetItem) {
          targetErrors[`bank_name_${targetItem.id}`] = message;
          targetErrors[`name_${targetItem.id}`] = message;
        }
        targetErrors.bank_name = message;
        targetErrors.name = message;
      } else if (
        k.includes('account_details') ||
        k.includes('accountdetails') ||
        k.includes('bank_details') ||
        k.includes('bankdetails') ||
        k.includes('account') ||
        k.includes('detail') ||
        msg.includes('account') ||
        msg.includes('bank detail')
      ) {
        const targetItem = currentBankItems.find((it) => !it.account_details?.trim()) || currentBankItems[0];
        if (targetItem) {
          targetErrors[`bank_details_${targetItem.id}`] = message;
          targetErrors[`account_details_${targetItem.id}`] = message;
        }
        targetErrors.bank_details = message;
        targetErrors.account_details = message;
      } else if (
        k === 'id' ||
        msg.includes('id must be a string') ||
        msg.includes('id should not be empty')
      ) {
        const targetItem =
          currentBankItems.find((it) => !it.id || !isValidCuidOrId(it.id)) ||
          currentBankItems[currentBankItems.length - 1] ||
          currentBankItems[0];
        if (targetItem) {
          targetErrors[`bank_name_${targetItem.id}`] = message;
          targetErrors[`id_${targetItem.id}`] = message;
        }
        targetErrors.id = message;
        targetErrors.general = message;
      } else if (k.includes('items') || k.includes('bank_items') || msg.includes('items')) {
        targetErrors.bank_items = message;
        targetErrors.items = message;
      } else {
        const firstId = currentBankItems[0]?.id;
        if (firstId) {
          targetErrors[`bank_name_${firstId}`] = message;
        }
        targetErrors[rawKey || 'general'] = message;
      }
    },
    []
  );

  const fetchBankDetailsForSeller = useCallback(
    async (sellerId: string) => {
      if (!sellerId) return;
      setIsLoadingBankDetails(true);
      try {
        const res = onFetchBankDetails
          ? await onFetchBankDetails(sellerId)
          : await getSellerBankDetailsAction(sellerId);

        if (res && res.success) {
          const resAny = res as any;
          const rawItems = Array.isArray(resAny.data?.items)
            ? resAny.data.items
            : Array.isArray(resAny.data)
            ? resAny.data
            : Array.isArray(resAny.items)
            ? resAny.items
            : [];

          if (rawItems.length > 0) {
            const backendIds = new Set<string>();
            const items = rawItems.map((it: any) => {
              const rawId = String(it.id || it._id || '').trim();
              const cleanId = isValidCuidOrId(rawId) ? rawId : generateSmartDocsCuid();
              if (rawId) {
                backendIds.add(cleanId);
              }
              const details = String(
                it.account_details ??
                  it.accountDetails ??
                  it.bank_details ??
                  it.bankDetails ??
                  it.details ??
                  ''
              ).trim();
              return {
                id: cleanId,
                name: String(it.name || it.bank_name || it.bankName || '').trim(),
                account_details: details && !isBankDetailsTemplateEmpty(details) ? details : DEFAULT_BANK_DETAILS_TEMPLATE,
              };
            });
            setBankItems(items);
            setExistingBackendBankIds(backendIds);
          } else {
            setBankItems((prev) =>
              prev.length > 0 && prev.some((p) => p.name || (p.account_details && !isBankDetailsTemplateEmpty(p.account_details)))
                ? prev
                : [{ id: generateSmartDocsCuid(), name: '', account_details: DEFAULT_BANK_DETAILS_TEMPLATE }]
            );
          }
        }
        setFetchedBankSellerId(sellerId);
      } catch (err: any) {
        console.warn('[fetchBankDetailsForSeller] Error fetching bank details:', err);
      } finally {
        setIsLoadingBankDetails(false);
      }
    },
    [onFetchBankDetails]
  );

  useEffect(() => {
    if (
      isOpen &&
      activeTab === 'bank' &&
      savedSellerId &&
      fetchedBankSellerId !== savedSellerId &&
      !savedSellerId.startsWith('seller-custom-') &&
      !savedSellerId.startsWith('inst-custom-')
    ) {
      fetchBankDetailsForSeller(savedSellerId);
    }
  }, [isOpen, activeTab, savedSellerId, fetchedBankSellerId, fetchBankDetailsForSeller]);

  // Helper to convert base64 data URLs to real binary PNG/image File objects
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
    } catch (e) {
      console.warn('[dataUrlToFile] Failed to convert dataUrl to File:', e);
      return null;
    }
  };

  // Handle Save Business Details
  const handleSaveBusinessSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateBusinessDetails()) return;

    setIsSavingBusiness(true);

    const formData = new FormData();
    formData.append('type', 'S');
    if (savedSellerId) formData.append('id', savedSellerId);
    formData.append('company_name', companyName.trim());
    formData.append('address', address.trim());
    formData.append('city', city.trim());
    formData.append('state', stateName.trim());
    // Address Country (Only if selected by user, no forced defaults)
    if (selectedCountryName) formData.append('country', selectedCountryName.trim());
    if (selectedCountryId) formData.append('country_id', selectedCountryId.trim());

    // Contact Number & Calling Code (Independent of address country, ZERO forced defaults)
    const cleanPhone = contactNumber.trim().replace(/\s+/g, '');
    const cleanDialCode = phoneCountryCode.trim();
    if (cleanPhone) {
      formData.append('contact_number', cleanPhone);
    }
    if (cleanDialCode) {
      formData.append('country_code', cleanDialCode);
    }

    formData.append('zip_code', zipcode.trim());
    formData.append('email', email.trim());
    formData.append('certificate_name_number', certificateNameNumber.trim());
    formData.append('authority_name', authorityName.trim());

    // Submit authorised_signature as binary PNG file or existing string URL
    if (authorisedSignature) {
      if (authorisedSignature.startsWith('data:')) {
        const sigFile = dataUrlToFile(authorisedSignature, 'authorised_signature.png');
        if (sigFile) {
          formData.append('authorised_signature', sigFile);
        }
      } else {
        const cleanSig = authorisedSignature
          .replace(/^https?:\/\/assets\.agriguruonline\.(com|cloud)\/?/, '')
          .trim();
        formData.append('authorised_signature', cleanSig);
      }
    }

    // Submit company_logo as binary image file or existing string URL
    if (companyLogo) {
      if (companyLogo.startsWith('data:')) {
        const logoFile = dataUrlToFile(companyLogo, 'company_logo.png');
        if (logoFile) {
          formData.append('company_logo', logoFile);
        }
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
        const newId =
          res.data?.id ||
          res.data?._id ||
          res.data?.instruction_id ||
          savedSellerId ||
          `inst-custom-${Date.now()}`;

        setSavedSellerId(String(newId));
        setIsBusinessSaved(true);
        setErrors({});

        // If returned data contains updated company_logo, sync it
        const returnedLogo =
          res.data?.company_logo ||
          res.data?.logo ||
          res.data?.companyLogo;
        if (returnedLogo) {
          setCompanyLogo(returnedLogo);
        }

        if (basicDetailsOnly) {
          toast.success(
            res.message ||
              (mode === 'add'
                ? dict?.smart_docs?.sellers?.seller_created || 'Seller saved successfully'
                : dict?.smart_docs?.sellers?.seller_updated || 'Seller updated successfully')
          );
          onClose();
          return;
        }

        if (mode === 'add') {
          setActiveTab('bank');
          toast.success(
            res.message || 'Business details saved! Now you can enter bank details.'
          );
          setTimeout(() => {
            bankNameInputRef.current?.focus();
          }, 150);
        } else {
          toast.success(res.message || 'Business details updated successfully');
        }
      } else {
        // Parse backend field-level validation errors
        const backendErrors: Record<string, string> = {};
        const fields =
          res?.error_fields ||
          res?.data?.error_fields ||
          res?.errors ||
          res?.data?.errors;

        if (Array.isArray(fields) && fields.length > 0) {
          fields.forEach((ef: any) => {
            if (typeof ef === 'string') {
              backendErrors.general = ef;
            } else if (ef && typeof ef === 'object') {
              const fKey = String(ef.field || ef.name || ef.param || ef.path || ef.key || '');
              const msg = String(ef.message || ef.msg || ef.error || 'Invalid value');
              mapBackendKeyToError(fKey, msg, backendErrors);
            }
          });
        } else if (fields && typeof fields === 'object') {
          Object.entries(fields).forEach(([k, val]) => {
            const msg = Array.isArray(val) ? String(val[0]) : String(val);
            mapBackendKeyToError(k, msg, backendErrors);
          });
        }

        if (Object.keys(backendErrors).length > 0) {
          setErrors(backendErrors);
        }

        toast.error(res?.message || 'Failed to save business details');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error saving business details');
    } finally {
      setIsSavingBusiness(false);
    }
  };

  // Handle Save Bank Details
  const handleSaveBankSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateBankDetails()) return;

    if (!savedSellerId) {
      toast.error('Please save business details first');
      setActiveTab('business');
      return;
    }

    setIsSavingBank(true);

    const cleanBankItems = bankItems
      .filter((b) => b && b.name.trim())
      .map((b) => {
        let itemId = typeof b.id === 'string' ? b.id.trim() : '';
        if (!isValidCuidOrId(itemId)) {
          itemId = generateSmartDocsCuid();
        }
        const rawDetails = (b.account_details || '').trim();
        return {
          id: itemId,
          name: b.name.trim(),
          account_details: isBankDetailsTemplateEmpty(rawDetails) ? '' : rawDetails,
        };
      });

    if (cleanBankItems.length === 0) {
      setIsSavingBank(false);
      toast.error('Please enter at least one bank account name');
      return;
    }

    const bankPayload = {
      items: cleanBankItems,
    };

    try {
      if (!onSaveBank) {
        setIsSavingBank(false);
        return;
      }
      const res = await onSaveBank(bankPayload, savedSellerId);
      if (res && res.success) {
        toast.success(res.message || 'Bank details updated successfully!');
        setErrors({});
        onClose();
      } else {
        const backendErrors: Record<string, string> = {};

        const parseErrorItem = (ef: any) => {
          if (typeof ef === 'string') {
            mapBankBackendError('', ef, backendErrors, bankItems);
          } else if (ef && typeof ef === 'object') {
            const fKey = String(
              ef.field || ef.name || ef.param || ef.path || ef.property || ef.key || ''
            );
            const msg = String(
              ef.message ||
                ef.msg ||
                ef.error ||
                (ef.constraints ? Object.values(ef.constraints || {})[0] : '') ||
                'Invalid value'
            );
            mapBankBackendError(fKey, msg, backendErrors, bankItems);
          }
        };

        const errorSources = [
          res?.error_fields,
          res?.data?.error_fields,
          res?.errors,
          res?.data?.errors,
        ];

        errorSources.forEach((src) => {
          if (Array.isArray(src) && src.length > 0) {
            src.forEach(parseErrorItem);
          } else if (src && typeof src === 'object') {
            Object.entries(src).forEach(([k, val]) => {
              if (Array.isArray(val)) {
                val.forEach((v) => parseErrorItem({ field: k, message: String(v) }));
              } else if (typeof val === 'string') {
                parseErrorItem({ field: k, message: val });
              } else if (typeof val === 'object') {
                parseErrorItem(val);
              }
            });
          }
        });

        // Also check if res.message itself is an array or contains specific error
        if (Array.isArray(res?.message)) {
          res.message.forEach((m: any) => parseErrorItem(m));
        } else if (
          typeof res?.message === 'string' &&
          res.message.trim() &&
          Object.keys(backendErrors).length === 0
        ) {
          parseErrorItem(res.message.trim());
        }

        if (Object.keys(backendErrors).length > 0) {
          setErrors(backendErrors);
          const firstErrId = bankItems.find(
            (b) =>
              backendErrors[`bank_name_${b.id}`] ||
              backendErrors[`name_${b.id}`] ||
              backendErrors[`bank_details_${b.id}`] ||
              backendErrors[`account_details_${b.id}`]
          )?.id;
          if (firstErrId) {
            const el =
              document.getElementById(`bank_name_input_${firstErrId}`) ||
              document.getElementById(`bank_details_input_${firstErrId}`);
            if (el) el.focus();
          }
        }

        const toastMsg =
          typeof res?.message === 'string' && res.message.trim()
            ? res.message.trim()
            : Array.isArray(res?.message)
            ? res.message.join(', ')
            : 'Failed to update bank details';
        toast.error(toastMsg);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error saving bank details');
    } finally {
      setIsSavingBank(false);
    }
  };

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const isBankTabEnabled = isBusinessSaved || Boolean(savedSellerId);

  const modalTitle =
    mode === 'edit'
      ? dict?.smart_docs?.edit_seller || 'Edit Seller / Exporter'
      : dict?.smart_docs?.add_seller || 'Add New Seller / Exporter';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="seller-manage-title"
      className="fixed inset-0 w-screen h-screen z-9999 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/60 dark:bg-black/75 animate-in fade-in duration-200"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
        className="w-full max-w-2xl max-h-[85vh] bg-card border border-border text-foreground rounded-2xl shadow-2xl overflow-hidden flex flex-col transform-gpu animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div 
          style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
          className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card shrink-0 transform-gpu"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-8.5 h-8.5 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm shrink-0">
              <i
                className={`fa-solid ${
                  mode === 'edit' ? 'fa-pen-to-square' : 'fa-user-tie'
                }`}
              />
            </span>
            <h3
              id="seller-manage-title"
              className="text-sm sm:text-base font-bold text-foreground leading-tight"
            >
              {modalTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSavingBusiness || isSavingBank}
            aria-label="Close"
            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* 2 Tabs Navigation Header (Hidden in basic details only mode) */}
        {!basicDetailsOnly && (
          <div 
            style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
            className="px-5 pt-2 pb-0 border-b border-border bg-card shrink-0 transform-gpu"
          >
            <div className="flex items-center gap-2">
              {/* Tab 1: Business Details */}
              <button
                type="button"
                onClick={() => setActiveTab('business')}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'business'
                    ? 'border-brand-blue text-brand-blue'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <i className="fa-solid fa-building text-xs" />
                <span>{dict?.smart_docs?.business_details || 'Business Details'}</span>
              </button>

              {/* Tab 2: Bank Details */}
              <button
                type="button"
                onClick={() => {
                  if (isBankTabEnabled) {
                    setActiveTab('bank');
                  } else {
                    toast.info('Please save Business Details first to enable Bank Details');
                  }
                }}
                disabled={!isBankTabEnabled}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
                  activeTab === 'bank'
                    ? 'border-brand-blue text-brand-blue'
                    : isBankTabEnabled
                    ? 'border-transparent text-muted-foreground hover:text-foreground hover:border-border cursor-pointer'
                    : 'border-transparent text-muted-foreground/40 cursor-not-allowed'
                }`}
              >
                <i className="fa-solid fa-building-columns text-xs" />
                <span>{dict?.smart_docs?.bank_details_label || 'Bank Details'}</span>
                {!isBankTabEnabled && (
                  <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded ml-0.5">
                    <i className="fa-solid fa-lock text-[9px]" />
                    <span>Locked</span>
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* General Error Banner if backend returns general non-field error */}
        {errors.general && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 shrink-0">
            <i className="fa-solid fa-circle-exclamation shrink-0" />
            <span>{errors.general}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        {isLoading ? (
          <div 
            style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
            className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar p-5 space-y-4 animate-pulse transform-gpu"
          >
            {/* Row 1: Logo square + 2 stacked inputs */}
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

            {/* Row 2: Address Textarea */}
            <div className="flex flex-col gap-1.5">
              <div className="h-3.5 w-20 bg-muted/70 rounded" />
              <div className="w-full h-20 bg-muted/40 rounded-lg border border-border" />
            </div>

            {/* Row 3: City & State */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
              <div className="flex flex-col gap-1.5">
                <div className="h-3.5 w-16 bg-muted/70 rounded" />
                <div className="w-full h-10 bg-muted/40 rounded-lg border border-border" />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="h-3.5 w-24 bg-muted/70 rounded" />
                <div className="w-full h-10 bg-muted/40 rounded-lg border border-border" />
              </div>
            </div>

            {/* Row 4: Country & Zipcode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
              <div className="flex flex-col gap-1.5">
                <div className="h-3.5 w-20 bg-muted/70 rounded" />
                <div className="w-full h-10 bg-muted/40 rounded-lg border border-border" />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="h-3.5 w-18 bg-muted/70 rounded" />
                <div className="w-full h-10 bg-muted/40 rounded-lg border border-border" />
              </div>
            </div>

            {/* Row 5: Email & Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
              <div className="flex flex-col gap-1.5">
                <div className="h-3.5 w-16 bg-muted/70 rounded" />
                <div className="w-full h-10 bg-muted/40 rounded-lg border border-border" />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="h-3.5 w-28 bg-muted/70 rounded" />
                <div className="w-full h-10 bg-muted/40 rounded-lg border border-border" />
              </div>
            </div>

            {/* Row 6: Authority Name */}
            <div className="flex flex-col gap-1.5">
              <div className="h-3.5 w-28 bg-muted/70 rounded" />
              <div className="w-full h-10 bg-muted/40 rounded-lg border border-border" />
            </div>

            {/* Row 7: Authority Signature Box */}
            <div className="flex flex-col gap-1.5">
              <div className="h-3.5 w-32 bg-muted/70 rounded" />
              <div className="w-full h-36 bg-muted/40 rounded-lg border border-border" />
            </div>
          </div>
        ) : (
          <div 
            ref={modalBodyRef}
            onFocusCapture={handleFormFocusScroll}
            style={{ WebkitOverflowScrolling: 'touch' }}
            className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar p-5 space-y-4 text-xs sm:text-sm scroll-smooth"
          >
            {activeTab === 'business' ? (
              /* TAB 1: BUSINESS DETAILS */
              <form onSubmit={handleSaveBusinessSubmit} className="space-y-4">
                {/* Row 1: Left Square Logo (matches height of 2 inputs) & Right 2 Inputs (Company Name & Certificate) */}
                <div className="flex flex-col sm:flex-row gap-3.5 items-start">
                  {/* Left: Square Company Logo (110px x 110px exact square matching the 2 inputs) */}
                  <div className="flex flex-col gap-1 shrink-0 self-center sm:self-start">
                    <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between leading-4">
                      <span>Company Logo</span>
                      <span className="text-[10px] lowercase text-muted-foreground/70 font-normal">
                        (optional)
                      </span>
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

                    {(errors.company_logo || errors.logo) && (
                      <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                        <i className="fa-solid fa-circle-exclamation text-[10px]" />
                        <span>{errors.company_logo || errors.logo}</span>
                      </span>
                    )}
                  </div>

                  {/* Right: 2 Inputs stacked vertically (Company Name & Certificate Name & Number) */}
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
                          errors.company_name || errors.companyName
                            ? 'border-destructive focus:ring-1 focus:ring-destructive'
                            : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                        }`}
                      />
                      {(errors.company_name || errors.companyName) && (
                        <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                          <i className="fa-solid fa-circle-exclamation text-[10px]" />
                          <span>{errors.company_name || errors.companyName}</span>
                        </span>
                      )}
                    </div>

                    {/* Input 2: Certificate Name & Number */}
                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between leading-4">
                        <span>Certificate Name & Number</span>
                        <span className="text-[10px] lowercase text-muted-foreground/70 font-normal">
                          (optional)
                        </span>
                      </label>
                      <input
                        type="text"
                        value={certificateNameNumber}
                        onChange={(e) => {
                          setCertificateNameNumber(e.target.value);
                          clearFieldError('certificate_name_number', 'certificate_name_and_number');
                        }}
                        placeholder="e.g. IEC / GSTIN / ISO 9001"
                        className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors ${
                          errors.certificate_name_number || errors.certificate_name_and_number
                            ? 'border-destructive focus:ring-1 focus:ring-destructive'
                            : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                        }`}
                      />
                      {(errors.certificate_name_number || errors.certificate_name_and_number) && (
                        <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                          <i className="fa-solid fa-circle-exclamation text-[10px]" />
                          <span>{errors.certificate_name_number || errors.certificate_name_and_number}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 2: Address (Text Area) */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Address</span>
                    <span className="text-[10px] lowercase text-muted-foreground/70 font-normal">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    rows={3}
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      clearFieldError('address');
                    }}
                    placeholder="Enter full address, street, warehouse / office location..."
                    className={`w-full p-3 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors resize-none leading-relaxed ${
                      errors.address
                        ? 'border-destructive focus:ring-1 focus:ring-destructive'
                        : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                    }`}
                  />
                  {errors.address && (
                    <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                      <i className="fa-solid fa-circle-exclamation text-[10px]" />
                      <span>{errors.address}</span>
                    </span>
                  )}
                </div>

                {/* Row 3: City & State (2 columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>City</span>
                      <span className="text-[10px] lowercase text-muted-foreground/70 font-normal">
                        (optional)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        clearFieldError('city');
                      }}
                      placeholder="Enter city"
                      className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors ${
                        errors.city
                          ? 'border-destructive focus:ring-1 focus:ring-destructive'
                          : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                      }`}
                    />
                    {errors.city && (
                      <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                        <i className="fa-solid fa-circle-exclamation text-[10px]" />
                        <span>{errors.city}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>State / Province</span>
                      <span className="text-[10px] lowercase text-muted-foreground/70 font-normal">
                        (optional)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={stateName}
                      onChange={(e) => {
                        setStateName(e.target.value);
                        clearFieldError('state', 'stateName');
                      }}
                      placeholder="Enter state / province"
                      className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors ${
                        errors.state || errors.stateName
                          ? 'border-destructive focus:ring-1 focus:ring-destructive'
                          : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                      }`}
                    />
                    {(errors.state || errors.stateName) && (
                      <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                        <i className="fa-solid fa-circle-exclamation text-[10px]" />
                        <span>{errors.state || errors.stateName}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 4: Country (Searchable Dropdown) & Zipcode (2 columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                  <CountrySelectField
                    label="Country"
                    selectedCountryName={selectedCountryName}
                    selectedCountryCode={selectedCountryCode}
                    selectedCountryId={selectedCountryId}
                    countries={countries}
                    allCountries={allCountries}
                    onSelect={(country) => handleSelectCountry(country)}
                    error={errors.country}
                  />

                  {/* Zipcode */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Zipcode</span>
                      <span className="text-[10px] lowercase text-muted-foreground/70 font-normal">
                        (optional)
                      </span>
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
                      className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors ${
                        errors.zip_code || errors.zipcode
                          ? 'border-destructive focus:ring-1 focus:ring-destructive'
                          : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                      }`}
                    />
                    {(errors.zip_code || errors.zipcode) && (
                      <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                        <i className="fa-solid fa-circle-exclamation text-[10px]" />
                        <span>{errors.zip_code || errors.zipcode}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 5: Email & Contact Number (2 columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Email</span>
                      <span className="text-[10px] lowercase text-muted-foreground/70 font-normal">
                        (optional)
                      </span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearFieldError('email');
                      }}
                      placeholder="e.g. info@company.com"
                      className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors ${
                        errors.email
                          ? 'border-destructive focus:ring-1 focus:ring-destructive'
                          : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                      }`}
                    />
                    {errors.email && (
                      <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                        <i className="fa-solid fa-circle-exclamation text-[10px]" />
                        <span>{errors.email}</span>
                      </span>
                    )}
                  </div>

                  {/* Contact Number */}
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
                    error={errors.contact_number || errors.contactNumber}
                    placeholder="Enter contact number..."
                  />
                </div>

                {/* Row 6: Authority Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Authority Name</span>
                    <span className="text-[10px] lowercase text-muted-foreground/70 font-normal">
                      (optional)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={authorityName}
                    onChange={(e) => {
                      setAuthorityName(e.target.value);
                      clearFieldError('authority_name', 'authorityName');
                    }}
                    placeholder="Authorized signatory name"
                    className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors ${
                      errors.authority_name || errors.authorityName
                        ? 'border-destructive focus:ring-1 focus:ring-destructive'
                        : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                    }`}
                  />
                  {(errors.authority_name || errors.authorityName) && (
                    <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                      <i className="fa-solid fa-circle-exclamation text-[10px]" />
                      <span>{errors.authority_name || errors.authorityName}</span>
                    </span>
                  )}
                </div>

                {/* Row 7: Authority Signature (Full width flush alignment with form) */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Authority Signature</span>
                    <span className="text-[10px] lowercase text-muted-foreground/70 font-normal">
                      (optional)
                    </span>
                  </label>
                  <div className="w-full">
                    <DocSignatureBox
                      partyType="exporter"
                      signatureUrl={authorisedSignature}
                      onSignatureChange={(val) => {
                        setAuthorisedSignature(val);
                        clearFieldError('authorised_signature', 'authority_signature', 'signature');
                      }}
                      hideTitleFields={true}
                      className="!p-0 w-full"
                    />
                  </div>
                  {(errors.authorised_signature || errors.authority_signature || errors.signature) && (
                    <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                      <i className="fa-solid fa-circle-exclamation text-[10px]" />
                      <span>{errors.authorised_signature || errors.authority_signature || errors.signature}</span>
                    </span>
                  )}
                </div>
              </form>
            ) : isLoadingBankDetails ? (
              /* TAB 2: BANK DETAILS SKELETON STATE */
              <div 
                style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
                className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar p-5 space-y-3 animate-pulse transform-gpu"
              >
                <div className="rounded-xl border border-border bg-muted/20 dark:bg-muted/15 p-3.5 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-muted/70" />
                      <div className="h-4 w-32 bg-muted/70 rounded" />
                    </div>
                    <div className="h-5 w-24 bg-muted/60 rounded-md" />
                  </div>
                  <hr className="border-t border-border/70" />
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between pb-0.5">
                      <div className="h-4 w-28 bg-muted/70 rounded" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="h-3.5 w-20 bg-muted/70 rounded" />
                      <div className="w-full h-10 bg-muted/40 rounded-lg border border-border" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="h-3.5 w-28 bg-muted/70 rounded" />
                      <div className="w-full h-32 bg-muted/40 rounded-lg border border-border" />
                    </div>
                  </div>
                  <div className="w-full h-9 rounded-lg bg-muted/40 border border-dashed border-border" />
                </div>
              </div>
            ) : (
              /* TAB 2: BANK DETAILS (Multiple accounts, matching Packing Types) */
              <form onSubmit={handleSaveBankSubmit} className="space-y-3">
                {/* Bank Accounts Container (Single Unified Container matching Packing Types) */}
                <div className="rounded-xl border border-border bg-muted/20 dark:bg-muted/15 p-3.5 sm:p-4 space-y-3">
                  {errors.bank_items && (
                    <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-medium flex items-center gap-1.5">
                      <i className="fa-solid fa-circle-exclamation text-xs shrink-0" />
                      <span>{errors.bank_items}</span>
                    </div>
                  )}

                  {/* Top Bar inside the container: Title & Linked with Company on Left, Count Badge on Right */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs shrink-0">
                        <i className="fa-solid fa-building-columns" />
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-foreground">
                          Bank Details
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
                      {bankItems.length} {bankItems.length === 1 ? 'Bank Account' : 'Bank Accounts'}
                    </span>
                  </div>

                  <hr className="border-t border-border/70" />

                  {/* Bank Accounts List */}
                  <div className="space-y-3.5">
                    {bankItems.map((item, index) => {
                      const nameErr =
                        errors[`bank_name_${item.id}`] ||
                        errors[`name_${item.id}`] ||
                        errors[`items_${index}_name`] ||
                        errors[`items.${index}.name`] ||
                        errors[`items[${index}].name`] ||
                        errors[`items.${index}`] ||
                        (index === 0 ? (errors.bank_name || errors.name) : undefined);
                      const detailsErr =
                        errors[`bank_details_${item.id}`] ||
                        errors[`account_details_${item.id}`] ||
                        errors[`details_${item.id}`] ||
                        errors[`items_${index}_account_details`] ||
                        errors[`items.${index}.account_details`] ||
                        errors[`items[${index}].account_details`] ||
                        (index === 0 ? (errors.bank_details || errors.account_details || errors.bankDetails || errors.accountDetails || errors.details) : undefined);

                      return (
                        <div key={item.id} className="space-y-2.5">
                          {/* Item Header */}
                          <div className="flex items-center justify-between pb-0.5">
                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-bold">
                                {index + 1}
                              </span>
                              <span>Bank Option #{index + 1}</span>
                            </span>

                            {(bankItems.length > 1 || existingBackendBankIds.has(item.id)) && (
                              <button
                                type="button"
                                onClick={() => handleRemoveBank(item)}
                                disabled={deletingBankId === item.id}
                                title={existingBackendBankIds.has(item.id) ? "Delete bank account from server" : "Remove bank account"}
                                className="w-6.5 h-6.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {deletingBankId === item.id ? (
                                  <i className="fa-solid fa-spinner fa-spin text-xs" />
                                ) : (
                                  <i className="fa-solid fa-trash-can text-xs" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Bank Name* */}
                          <div className="flex flex-col gap-1">
                            <label
                              htmlFor={`bank_name_input_${item.id}`}
                              className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1"
                            >
                              <span>Bank Name</span>
                              <span className="text-destructive">*</span>
                            </label>
                            <input
                              id={`bank_name_input_${item.id}`}
                              type="text"
                              value={item.name}
                              onChange={(e) => {
                                handleBankItemChange(item.id, 'name', e.target.value);
                                ensureFieldInView(e.currentTarget);
                              }}
                              onFocus={(e) => ensureFieldInView(e.currentTarget)}
                              placeholder="e.g. HDFC Bank, State Bank of India, HSBC, Citibank, etc."
                              className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors ${
                                nameErr
                                  ? 'border-destructive ring-1 ring-destructive'
                                  : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                              }`}
                            />
                            {nameErr && (
                              <span className="text-[11px] text-destructive font-medium flex items-center gap-1 mt-0.5">
                                <i className="fa-solid fa-circle-exclamation text-[10px]" />
                                <span>{nameErr}</span>
                              </span>
                            )}
                          </div>

                          {/* Bank Details (Account Details Text Area - 5 Rows) */}
                          <div className="flex flex-col gap-1">
                            <label
                              htmlFor={`bank_details_input_${item.id}`}
                              className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between"
                            >
                              <span>Account Details</span>
                              <span className="text-[10px] lowercase text-muted-foreground/70 font-normal">
                                (optional)
                              </span>
                            </label>
                            <textarea
                              id={`bank_details_input_${item.id}`}
                              rows={5}
                              value={item.account_details}
                              onChange={(e) => {
                                handleBankItemChange(item.id, 'account_details', e.target.value);
                                ensureFieldInView(e.currentTarget);
                              }}
                              onFocus={(e) => ensureFieldInView(e.currentTarget)}
                              onKeyUp={(e) => ensureFieldInView(e.currentTarget)}
                              placeholder={DEFAULT_BANK_DETAILS_TEMPLATE}
                              className={`w-full p-3 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors resize-y min-h-[140px] leading-relaxed ${
                                detailsErr
                                  ? 'border-destructive ring-1 ring-destructive'
                                  : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                              }`}
                            />
                            {detailsErr && (
                              <span className="text-[11px] text-destructive font-medium flex items-center gap-1 mt-0.5">
                                <i className="fa-solid fa-circle-exclamation text-[10px]" />
                                <span>{detailsErr}</span>
                              </span>
                            )}
                          </div>

                          {/* HR Separator between multiple bank accounts */}
                          {index < bankItems.length - 1 && (
                            <hr className="border-t border-border/50 my-2" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Scroll Anchor to reliably scroll into view */}
                  <div ref={banksEndRef} />

                  {/* Add More Bank Details Button */}
                  <button
                    type="button"
                    onClick={handleAddBank}
                    className="w-full h-9 rounded-lg border border-dashed border-primary/50 hover:border-primary bg-background hover:bg-primary/5 text-primary font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <i className="fa-solid fa-plus text-xs" />
                    <span>Add more bank details</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Modal Actions Footer (Solid bg-card with transform-gpu & translate3d to prevent scroll blinking) */}
        <div 
          style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
          className="sticky bottom-0 z-20 flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-border bg-card shrink-0 transform-gpu shadow-md"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSavingBusiness || isSavingBank}
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
                {basicDetailsOnly
                  ? mode === 'add'
                    ? dict?.smart_docs?.sellers?.save_seller || 'Save Seller'
                    : dict?.smart_docs?.sellers?.update_seller || 'Update Seller'
                  : mode === 'add'
                  ? 'Save & Continue to Bank Details'
                  : 'Update Business Details'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveBankSubmit}
              disabled={isSavingBank || isLoading}
              className="h-9.5 px-5 text-xs font-bold rounded-lg bg-brand-green hover:bg-brand-green-hover text-white shadow-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSavingBank ? (
                <i className="fa-solid fa-circle-notch fa-spin text-xs" />
              ) : (
                <i className="fa-solid fa-check text-xs" />
              )}
              <span>Save Bank Details</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
