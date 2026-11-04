'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import flags from 'react-phone-number-input/flags';
import { getCountries, type Country } from 'react-phone-number-input';
import en from 'react-phone-number-input/locale/en.json';
import { generatePackingCuid } from '@/lib/api/smart-docs.service';
import CountrySelectField from '@/components/smart-docs/CountrySelectField';
import { handleFormFocusScroll } from '@/components/smart-docs/form-scroll-utils';

const countryNames = en as Record<string, string>;

// Popular trade countries for quick access
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

export type PackingUnitType = 'solid' | 'liquid';

export interface PackingTypeItem {
  id: string;
  title: string;
  quantity: string; // for solid: kg; for liquid: volume in liters
  density: string; // only if liquid, default '1'
  netWeightKg: string; // only if liquid, auto-calculated
  conversion_factor?: number | string;
}

export interface ProductManageModalData {
  id: string;
  label: string;
  product_name: string;
  name: string;
  unit_type: PackingUnitType;
  unitType: PackingUnitType;
  country: string;
  country_name: string;
  origin_country: string;
  hsn: string;
  hsn_code: string;
  spec: string;
  specification: string;
  category: string;
  category_name: string;
  packings: Array<PackingTypeItem & { unitType: PackingUnitType; unit_type: PackingUnitType; conversion_factor?: number | string }>;
  packing_types?: any[];
  [key: string]: any;
}

export interface ProductManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  product?: any;
  onSave: (productData: ProductManageModalData) => Promise<any> | void;
  dict?: any;
  isLoading?: boolean;
  isSubmitting?: boolean;
  externalErrors?: Record<string, string>;
}

/**
 * Calculates Net Weight in KG for liquid: Volume (L) * Density (Kg/L)
 */
function calculateNetWeightKg(quantity: string | number, density: string | number): string {
  const q = parseFloat(String(quantity));
  if (isNaN(q) || q <= 0) return '0.00';
  const d = parseFloat(String(density));
  const effectiveDensity = isNaN(d) || d <= 0 ? 1 : d;
  const net = q * effectiveDensity;
  return (Math.round(net * 100) / 100).toFixed(2);
}

export function ProductManageModal({
  isOpen,
  onClose,
  mode,
  product,
  onSave,
  dict,
  isLoading = false,
  isSubmitting = false,
  externalErrors,
}: ProductManageModalProps) {
  const [mounted, setMounted] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [selectedCountryName, setSelectedCountryName] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState<Country | null>(null);
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');
  const [hsn, setHsn] = useState('');
  const [category, setCategory] = useState('');
  const [spec, setSpec] = useState('');

  // Common Unit Type for the Product: Solid | Liquid
  const [unitType, setUnitType] = useState<PackingUnitType>('solid');

  // Packing Types List
  const [packings, setPackings] = useState<PackingTypeItem[]>([
    {
      id: generatePackingCuid(),
      title: '',
      quantity: '',
      density: '1',
      netWeightKg: '',
      conversion_factor: undefined,
    },
  ]);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (externalErrors && Object.keys(externalErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...externalErrors }));
    }
  }, [externalErrors]);

  // Country Dropdown state
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const countrySearchInputRef = useRef<HTMLInputElement>(null);
  const backdropMouseDownRef = useRef(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const packingsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Build full sorted country list
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

  // Helper to resolve country code from name or string
  const resolveCountry = (input: any): { code: Country | null; name: string } => {
    if (!input) return { code: null, name: '' };
    const raw = typeof input === 'object' ? (input.name || input.country_name || input.country || '') : String(input);
    const trimmed = raw.trim();
    if (!trimmed) return { code: null, name: '' };

    const byName = allCountries.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (byName) return { code: byName.code, name: byName.name };

    const byCode = allCountries.find((c) => c.code.toLowerCase() === trimmed.toLowerCase());
    if (byCode) return { code: byCode.code, name: byCode.name };

    const partial = allCountries.find((c) => c.name.toLowerCase().includes(trimmed.toLowerCase()));
    if (partial) return { code: partial.code, name: partial.name };

    return { code: null, name: trimmed };
  };

  // Sync state when modal opens or editing product changes
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && product) {
        setName(product.label || product.product_name || product.name || '');

        const rawCountryId = String(
          product.country_id ||
          product.countryId ||
          product.origin_country_id ||
          product.raw?.country_id ||
          product.raw?.country?.id ||
          product.raw?.origin_country_id ||
          ''
        );
        setSelectedCountryId(rawCountryId);

        const resolved = resolveCountry(
          product.country ||
          product.country_name ||
          product.origin_country ||
          product.origin ||
          ''
        );
        setSelectedCountryName(resolved.name);
        setSelectedCountryCode(resolved.code);

        setHsn(
          String(
            product.hsn ||
            product.hsn_code ||
            product.hsn_sac_code ||
            product.hsnCode ||
            ''
          )
        );

        setCategory(
          product.category ||
          product.category_name ||
          product.categoryName ||
          product.sub_category_name ||
          ''
        );

        setSpec(product.spec || product.specification || '');

        // Detect unit type accurately without false overrides
        const rawPackings =
          product.packings ||
          product.packing_types ||
          product.packingTypes ||
          [];

        const isLiquidFlag =
          product.is_liquid ??
          product.isLiquid ??
          product.liquid ??
          product.raw?.is_liquid ??
          product.raw?.isLiquid;

        const explicitUnitType = String(
          product.unit_type ||
          product.unitType ||
          product.packing_unit_type ||
          product.packingUnitType ||
          product.raw?.unit_type ||
          product.raw?.unitType ||
          ''
        ).trim().toLowerCase();

        const explicitUnit = String(
          product.unit ||
          product.unit_name ||
          product.unitName ||
          product.default_unit ||
          product.raw?.unit ||
          ''
        ).trim().toLowerCase();

        let detectedUnitType: PackingUnitType = 'solid';

        if (isLiquidFlag === true || isLiquidFlag === 1 || isLiquidFlag === 'true' || isLiquidFlag === '1') {
          detectedUnitType = 'liquid';
        } else if (isLiquidFlag === false || isLiquidFlag === 0 || isLiquidFlag === 'false' || isLiquidFlag === '0') {
          detectedUnitType = 'solid';
        } else if (explicitUnitType === 'liquid') {
          detectedUnitType = 'liquid';
        } else if (explicitUnitType === 'solid') {
          detectedUnitType = 'solid';
        } else if (['l', 'ltr', 'ltrs', 'liter', 'liters', 'litre', 'litres', 'ml'].includes(explicitUnit)) {
          detectedUnitType = 'liquid';
        } else if (['kg', 'kgs', 'g', 'gm', 'gms', 'mt', 'ton', 'tons', 'quintal'].includes(explicitUnit)) {
          detectedUnitType = 'solid';
        } else if (Array.isArray(rawPackings) && rawPackings.length > 0) {
          const hasExplicitLiquidPacking = rawPackings.some((p: any) => {
            const uType = String(p.unit_type || p.unitType || '').toLowerCase();
            const uUnit = String(p.unit || p.uom || '').toLowerCase();
            const title = String(p.title || p.name || p.packing_name || (typeof p === 'string' ? p : '')).toLowerCase();

            if (uType === 'liquid') return true;
            if (['l', 'ltr', 'liter', 'liters', 'litre', 'litres', 'ml'].includes(uUnit)) return true;
            if (/\b(ltrs?|liters?|litres?|ml)\b/i.test(title)) return true;
            if (title.includes('liquid') || title.includes('flexitank') || title.includes('ibc tank')) return true;
            return false;
          });

          const hasExplicitSolidPacking = rawPackings.some((p: any) => {
            const uType = String(p.unit_type || p.unitType || '').toLowerCase();
            const uUnit = String(p.unit || p.uom || '').toLowerCase();
            const title = String(p.title || p.name || p.packing_name || (typeof p === 'string' ? p : '')).toLowerCase();

            if (uType === 'solid') return true;
            if (['kg', 'kgs', 'g', 'gm', 'mt', 'ton', 'tons'].includes(uUnit)) return true;
            if (/\b(kgs?|grams?|gms?|mts?|tons?)\b/i.test(title)) return true;
            if (title.includes('bag') || title.includes('sack') || title.includes('jute') || title.includes('box') || title.includes('carton')) return true;
            return false;
          });

          if (hasExplicitLiquidPacking && !hasExplicitSolidPacking) {
            detectedUnitType = 'liquid';
          } else {
            detectedUnitType = 'solid';
          }
        }

        setUnitType(detectedUnitType);

        if (Array.isArray(rawPackings) && rawPackings.length > 0) {
          const parsed = rawPackings.map((p: any, idx: number) => {
            const pkObj = p?.packing_type && typeof p.packing_type === 'object' ? p.packing_type : null;
            const rawTitle = String(
              p.title ||
              p.name ||
              p.packing_name ||
              p.packing_type_name ||
              pkObj?.title ||
              pkObj?.name ||
              (typeof p.packing_type === 'string' ? p.packing_type : '') ||
              p.label ||
              ''
            ).trim();

            let rawQty = String(
              p.quantity ??
              p.qty ??
              p.pack_qty ??
              p.bagWeightKg ??
              p.weight ??
              p.size ??
              ''
            );

            if (!rawQty && rawTitle) {
              const match = rawTitle.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|g|gm|gms|l|ltr|ltrs|liter|liters|ml|ton|tons|mt)/i);
              if (match && match[1]) {
                rawQty = match[1];
              }
            }

            const isProductLiquid = detectedUnitType === 'liquid';
            const rawDensity = String(p.density ?? '1');
            const density = isProductLiquid ? (rawDensity || '1') : '1';
            const netWeightKg = isProductLiquid
              ? calculateNetWeightKg(rawQty, density)
              : String(p.netWeightKg || p.net_weight_kg || rawQty);

            const rawId = p.id || p._id || p.packing_type_id || p.packing_id || (p.packing_type?.id);
            const resolvedId = (rawId && !String(rawId).startsWith('pack-')) ? String(rawId) : generatePackingCuid();
            const rawCf = p.conversion_factor ?? p.conversionFactor ?? p.packing_type?.conversion_factor;
            const parsedCf =
              rawCf !== undefined && rawCf !== null && String(rawCf).trim() !== '' && !isNaN(Number(rawCf))
                ? parseFloat(Number(rawCf).toFixed(3))
                : undefined;

            return {
              id: resolvedId,
              title: rawTitle,
              quantity: rawQty,
              density,
              netWeightKg,
              conversion_factor: parsedCf,
            };
          });
          setPackings(parsed);
        } else {
          setPackings([
            {
              id: generatePackingCuid(),
              title: '',
              quantity: '',
              density: '1',
              netWeightKg: '',
              conversion_factor: undefined,
            },
          ]);
        }
      } else {
        // Reset for Add mode
        setName('');
        setSelectedCountryName('');
        setSelectedCountryCode(null);
        setSelectedCountryId('');
        setHsn('');
        setCategory('');
        setSpec('');
        setUnitType('solid');
        setPackings([
          {
            id: generatePackingCuid(),
            title: '',
            quantity: '',
            density: '1',
            netWeightKg: '',
            conversion_factor: undefined,
          },
        ]);
      }

      setErrors({});
      setIsCountryDropdownOpen(false);
      setCountrySearch('');

      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, mode, product]);

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

  // Backdrop Click Handlers - Guard against text selection drag closing
  // Backdrop Click Handlers - Do NOT close on outside click to prevent data loss
  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    // Backdrop click disabled to prevent accidental closure
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Backdrop click disabled - only explicit [X] or Cancel button closes modal
  };

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCountryDropdownOpen) {
          setIsCountryDropdownOpen(false);
        } else if (!isSubmitting && !isLoading) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isCountryDropdownOpen, isSubmitting, isLoading, onClose]);

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

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  // Handle country selection
  const handleSelectCountry = (country: { code: Country | null; name: string; id?: string }) => {
    setSelectedCountryName(country.name);
    setSelectedCountryCode(country.code);
    if (country.id) {
      setSelectedCountryId(country.id);
    }
    setIsCountryDropdownOpen(false);
    setCountrySearch('');
    if (errors.country) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.country;
        return next;
      });
    }
  };

  // Toggle unit type for entire product
  const handleUnitTypeChange = (newType: PackingUnitType) => {
    setUnitType(newType);
    setPackings((prev) =>
      prev.map((item) => {
        if (newType === 'liquid') {
          const density = item.density || '1';
          return {
            ...item,
            density,
            netWeightKg: calculateNetWeightKg(item.quantity, density),
          };
        } else {
          return {
            ...item,
            density: '1',
            netWeightKg: '',
          };
        }
      })
    );
  };

  const ensureFieldInView = (el: HTMLElement | null) => {
    if (!el || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const rect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (rect.bottom > containerRect.bottom - 40) {
      container.scrollBy({
        top: rect.bottom - containerRect.bottom + 60,
        behavior: 'smooth',
      });
    }
  };

  // Packing handlers
  const handleAddPacking = () => {
    const newId = generatePackingCuid();
    setPackings((prev) => [
      ...prev,
      {
        id: newId,
        title: '',
        quantity: '',
        density: '1',
        netWeightKg: '',
        conversion_factor: undefined,
      },
    ]);

    // Force scroll modal body all the way to the bottom
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight + 1000,
          behavior: 'smooth',
        });
      }
      const titleInput = document.getElementById(`packing_title_${newId}`);
      if (titleInput) {
        titleInput.focus();
      }
    }, 80);
  };

  const handleRemovePacking = (id: string) => {
    if (packings.length <= 1) return;
    setPackings((prev) => prev.filter((p) => p.id !== id));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`packing_title_${id}`];
      delete next[`packing_qty_${id}`];
      return next;
    });
  };

  const handlePackingChange = (
    id: string,
    field: keyof PackingTypeItem,
    value: any
  ) => {
    setPackings((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        if (unitType === 'liquid') {
          if (field === 'quantity' || field === 'density') {
            updated.netWeightKg = calculateNetWeightKg(
              field === 'quantity' ? value : updated.quantity,
              field === 'density' ? value : updated.density
            );
          }
        }

        return updated;
      })
    );

    if (field === 'title' && (errors[`packing_title_${id}`] || errors.packing_types)) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`packing_title_${id}`];
        delete next.packing_types;
        return next;
      });
    }
    if (field === 'quantity' && (errors[`packing_qty_${id}`] || errors.packing_types)) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`packing_qty_${id}`];
        delete next.packing_types;
        return next;
      });
    }
    if (field === 'density' && errors[`packing_density_${id}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`packing_density_${id}`];
        return next;
      });
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    const trimmedName = name.trim();
    const trimmedHsn = hsn.trim();
    const trimmedCategory = category.trim();
    const trimmedSpec = spec.trim();

    if (!trimmedName) {
      newErrors.name =
        dict?.smart_docs?.confirmation_form?.enter_product_name ||
        'Product name is required';
    }

    if (!selectedCountryName.trim()) {
      newErrors.country = 'Please select a country';
    }

    // Validate packings
    if (!packings || packings.length === 0) {
      newErrors.packing_types = 'At least one packing type is required';
    } else {
      packings.forEach((p, idx) => {
        if (!p.title.trim()) {
          newErrors[`packing_title_${p.id}`] = `Packing #${idx + 1} title is required`;
        }
        if (!p.quantity || parseFloat(p.quantity) <= 0) {
          newErrors[`packing_qty_${p.id}`] = `Quantity is required for Packing #${idx + 1}`;
        }
        if (unitType === 'liquid') {
          if (!p.density || parseFloat(p.density) <= 0) {
            newErrors[`packing_density_${p.id}`] = `Density is required for Packing #${idx + 1}`;
          }
        }
      });
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.name) {
        nameInputRef.current?.focus();
      }
      return;
    }

    const id =
      mode === 'edit' && (product?.id || product?.value)
        ? (product.id || product.value)
        : `prod-custom-${Date.now()}`;

    const cleanPackings = packings.map((p) => {
      const resolvedId = (p.id && !String(p.id).startsWith('pack-')) ? String(p.id) : generatePackingCuid();
      return {
        id: resolvedId,
        unitType,
        unit_type: unitType,
        title: p.title.trim(),
        quantity: p.quantity.trim(),
        conversion_factor: p.conversion_factor,
        density: unitType === 'liquid' ? p.density.trim() || '1' : '1',
        netWeightKg:
          unitType === 'liquid'
            ? calculateNetWeightKg(p.quantity, p.density || '1')
            : p.quantity.trim(),
      };
    });

    const uTypeUpper = unitType === 'liquid' ? 'LIQUID' : 'SOLID';
    let effectiveCountryId =
      selectedCountryId ||
      product?.country_id ||
      product?.countryId ||
      product?.raw?.country_id ||
      product?.raw?.country?.id ||
      product?.raw?.origin_country_id ||
      '';

    if (!effectiveCountryId) {
      const cLower = selectedCountryName.trim().toLowerCase();
      if (cLower === 'india' || selectedCountryCode === 'IN') {
        effectiveCountryId = 'cm710m0og002smzt00fy4a8cg';
      }
    }

    const packingTypesPayload = cleanPackings.map((p) => {
      const cleanQty = parseFloat(p.quantity) || 0;
      const cleanDensity = parseFloat(p.density) || 1;

      let effectiveCf: number;
      const rawCf = (p as any).conversion_factor;
      if (rawCf !== undefined && rawCf !== null && String(rawCf).trim() !== '' && !isNaN(Number(rawCf)) && Number(rawCf) > 0) {
        effectiveCf = parseFloat(Number(rawCf).toFixed(3));
      } else {
        const siblingWithCf = packings.find(
          (other: any) =>
            other.id !== p.id &&
            other.conversion_factor !== undefined &&
            other.conversion_factor !== null &&
            !isNaN(Number(other.conversion_factor)) &&
            Number(other.conversion_factor) > 0 &&
            parseFloat(other.quantity) > 0
        );
        if (siblingWithCf) {
          const sQty = parseFloat(siblingWithCf.quantity);
          const sCf = Number(siblingWithCf.conversion_factor);
          effectiveCf = parseFloat((cleanQty * (sCf / sQty)).toFixed(3));
        } else {
          effectiveCf = cleanQty > 0 ? parseFloat(cleanQty.toFixed(3)) : 1;
        }
      }
      if (isNaN(effectiveCf) || effectiveCf <= 0) {
        effectiveCf = cleanQty > 0 ? parseFloat(cleanQty.toFixed(3)) : 1;
      }

      const item: any = {
        id: p.id,
        title: p.title,
        quantity: cleanQty,
        conversion_factor: effectiveCf,
        unit_type: uTypeUpper,
      };

      if (unitType === 'liquid') {
        item.density = cleanDensity;
        item.net_weight_kg = parseFloat(p.netWeightKg) || cleanQty;
      }

      return item;
    });

    const res = await onSave({
      id,
      category: trimmedCategory,
      country_id: effectiveCountryId,
      hsn_code: trimmedHsn,
      name: trimmedName,
      packing_types: packingTypesPayload,
      specifications: trimmedSpec,
      // Backward compatibility fields
      label: trimmedName,
      product_name: trimmedName,
      country: selectedCountryName.trim(),
      country_name: selectedCountryName.trim(),
      origin_country: selectedCountryName.trim(),
      hsn: trimmedHsn,
      spec: trimmedSpec,
      specification: trimmedSpec,
      category_name: trimmedCategory,
      unitType,
      unit_type: unitType,
      packings: cleanPackings,
    });

    // If onSave returned validation error fields from backend, display them under inputs
    if (res && typeof res === 'object' && !res.success) {
      const backendErrors: Record<string, string> = {};
      const fields = res.error_fields || res.data?.error_fields || res.errors || [];
      if (Array.isArray(fields) && fields.length > 0) {
        fields.forEach((ef: any) => {
          if (typeof ef === 'string') {
            backendErrors.general = ef;
          } else if (ef && typeof ef === 'object') {
            const fKey = String(ef.field || ef.name || ef.param || ef.path || '').toLowerCase();
            const msg = String(ef.message || ef.msg || ef.error || 'Invalid value');
            if (fKey.includes('name')) backendErrors.name = msg;
            else if (fKey.includes('country')) backendErrors.country = msg;
            else if (fKey.includes('hsn')) backendErrors.hsn_code = msg;
            else if (fKey.includes('category')) backendErrors.category = msg;
            else if (fKey.includes('spec')) backendErrors.specifications = msg;
            else if (
              fKey.includes('packing') ||
              fKey.includes('conversion_factor') ||
              msg.toLowerCase().includes('conversion_factor') ||
              msg.toLowerCase().includes('id should not be empty')
            ) backendErrors.packing_types = msg;
            else backendErrors[fKey] = msg;
          }
        });
      }
      if (Object.keys(backendErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...backendErrors }));
      }
    }
  };

  const title =
    mode === 'edit'
      ? dict?.smart_docs?.confirmation_form?.edit_product || 'Edit Product'
      : dict?.smart_docs?.confirmation_form?.add_product || 'Add Product';

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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-manage-title"
      className="fixed inset-0 w-screen h-screen z-9999 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] bg-card border border-border text-foreground rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8.5 h-8.5 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm shrink-0">
              <i
                className={`fa-solid ${
                  mode === 'edit' ? 'fa-pen-to-square' : 'fa-box-open'
                }`}
              />
            </span>
            <h3
              id="product-manage-title"
              className="text-sm sm:text-base font-bold text-foreground leading-tight"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Modal Body */}
        {isLoading ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Scrollable Skeleton Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 animate-pulse">
              <div className="space-y-3.5">
                {/* Product Name */}
                <div className="flex flex-col gap-1.5">
                  <div className="h-3.5 w-28 bg-muted/70 rounded" />
                  <div className="w-full h-10 bg-muted/40 rounded-lg border border-border" />
                </div>

                {/* HSN Code & Origin */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <div className="h-3.5 w-20 bg-muted/70 rounded" />
                    <div className="w-full h-10 bg-muted/40 rounded-lg border border-border" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="h-3.5 w-16 bg-muted/70 rounded" />
                    <div className="w-full h-10 bg-muted/40 rounded-lg border border-border" />
                  </div>
                </div>

                {/* Category */}
                <div className="flex flex-col gap-1.5">
                  <div className="h-3.5 w-24 bg-muted/70 rounded" />
                  <div className="w-full h-10 bg-muted/40 rounded-lg border border-border" />
                </div>

                {/* Specification */}
                <div className="flex flex-col gap-1.5">
                  <div className="h-3.5 w-24 bg-muted/70 rounded" />
                  <div className="w-full h-20 bg-muted/40 rounded-lg border border-border" />
                </div>

                {/* Unit Type Radio Pills */}
                <div className="flex flex-col gap-1.5">
                  <div className="h-3.5 w-20 bg-muted/70 rounded" />
                  <div className="flex gap-2.5">
                    <div className="w-24 h-9 bg-muted/40 rounded-lg border border-border" />
                    <div className="w-24 h-9 bg-muted/40 rounded-lg border border-border" />
                  </div>
                </div>

                {/* Packing Types Container */}
                <div className="rounded-xl border border-border bg-muted/20 p-3.5 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-28 bg-muted/70 rounded" />
                    <div className="h-5 w-20 bg-muted/60 rounded-md" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="h-10 bg-muted/40 rounded-lg border border-border" />
                    <div className="h-10 bg-muted/40 rounded-lg border border-border" />
                  </div>
                  <div className="w-full h-9 bg-muted/40 rounded-lg border border-dashed border-border" />
                </div>
              </div>
            </div>

            {/* Modal Actions Footer Skeleton */}
            <div className="sticky bottom-0 z-20 flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-border bg-card/95 backdrop-blur-xs shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.35)]">
              <button
                type="button"
                onClick={onClose}
                className="h-9.5 px-4 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {dict?.common?.cancel || 'Cancel'}
              </button>
              <div className="h-9.5 w-28 bg-muted/50 rounded-lg border border-border" />
            </div>
          </div>
        ) : (
          /* Modal Form */
          <form
            onSubmit={handleSubmit}
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
          >
            {/* Scrollable Form Body */}
            <div
              ref={scrollContainerRef}
              onFocusCapture={handleFormFocusScroll}
              className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 text-xs sm:text-sm scroll-smooth"
            >
              {/* SECTION 1: PRODUCT DETAILS */}
          <div className="space-y-3.5">
            {/* Product Name* */}
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <span>
                  {dict?.smart_docs?.confirmation_form?.product_name || 'Product Name'}
                </span>
                <span className="text-destructive">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.name;
                      return next;
                    });
                  }
                }}
                placeholder="Product Name"
                className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors ${
                  errors.name
                    ? 'border-destructive focus:ring-1 focus:ring-destructive'
                    : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                }`}
              />
              {errors.name && (
                <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                  <i className="fa-solid fa-circle-exclamation text-[10px]" />
                  <span>{errors.name}</span>
                </span>
              )}
            </div>

            {/* Country, HSN CODE, and Category in 1 Row (3 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-3.5">
              {/* 1. Country* (Searchable Dropdown) */}
              <CountrySelectField
                label={dict?.smart_docs?.confirmation_form?.country || 'Country'}
                required={true}
                selectedCountryName={selectedCountryName}
                selectedCountryCode={selectedCountryCode}
                selectedCountryId={selectedCountryId}
                allCountries={allCountries}
                onSelect={(country) => handleSelectCountry(country)}
                error={errors.country}
              />

              {/* 2. HSN CODE (Number Input) */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>{dict?.smart_docs?.confirmation_form?.hsn_code || 'HSN CODE'}</span>
                  <span className="text-[10px] lowercase text-muted-foreground/70 font-normal">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={hsn}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d.]/g, '');
                    setHsn(val);
                    if (errors.hsn_code || errors.hsn) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.hsn_code;
                        delete next.hsn;
                        return next;
                      });
                    }
                  }}
                  placeholder="HSN CODE"
                  className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors font-mono ${
                    (errors.hsn_code || errors.hsn)
                      ? 'border-destructive focus:ring-1 focus:ring-destructive'
                      : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                  }`}
                />
                {(errors.hsn_code || errors.hsn) && (
                  <span className="text-[11px] text-destructive font-medium flex items-center gap-1 mt-1">
                    <i className="fa-solid fa-circle-exclamation text-[10px]" />
                    <span>{errors.hsn_code || errors.hsn}</span>
                  </span>
                )}
              </div>

              {/* 3. Category (Text Input) */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Category</span>
                  <span className="text-[10px] lowercase text-muted-foreground/70 font-normal">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    if (errors.category) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.category;
                        return next;
                      });
                    }
                  }}
                  placeholder="Category"
                  className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors ${
                    errors.category
                      ? 'border-destructive focus:ring-1 focus:ring-destructive'
                      : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                  }`}
                />
                {errors.category && (
                  <span className="text-[11px] text-destructive font-medium flex items-center gap-1 mt-1">
                    <i className="fa-solid fa-circle-exclamation text-[10px]" />
                    <span>{errors.category}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Specifications (Text Area - 4 Rows) */}
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>{dict?.smart_docs?.confirmation_form?.specification || 'Specifications'}</span>
                <span className="text-[10px] lowercase text-muted-foreground/70 font-normal">
                  (optional)
                </span>
              </label>
              <textarea
                rows={4}
                value={spec}
                onChange={(e) => {
                  setSpec(e.target.value);
                  if (errors.specifications || errors.spec || errors.specification) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.specifications;
                      delete next.spec;
                      delete next.specification;
                      return next;
                    });
                  }
                }}
                placeholder="Specifications..."
                className={`w-full p-3 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors resize-none leading-relaxed ${
                  (errors.specifications || errors.spec || errors.specification)
                    ? 'border-destructive focus:ring-1 focus:ring-destructive'
                    : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                }`}
              />
              {(errors.specifications || errors.spec || errors.specification) && (
                <span className="text-[11px] text-destructive font-medium flex items-center gap-1 mt-1">
                  <i className="fa-solid fa-circle-exclamation text-[10px]" />
                  <span>{errors.specifications || errors.spec || errors.specification}</span>
                </span>
              )}
            </div>
          </div>

          {/* SECTION 2: PACKING TYPES (Single Unified Container with Internal Separators) */}
          <div className="rounded-xl border border-border bg-muted/20 dark:bg-muted/15 p-4 sm:p-5 space-y-4">
            {errors.packing_types && (
              <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-medium flex items-center gap-1.5">
                <i className="fa-solid fa-circle-exclamation text-xs shrink-0" />
                <span>{errors.packing_types}</span>
              </div>
            )}
            {/* Top Bar inside the container: Section Title on Left, Large Unit Type Toggle on Right */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs shrink-0">
                  <i className="fa-solid fa-boxes-stacked" />
                </span>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">
                    Packing Types
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Configure packing specifications and units
                  </p>
                </div>
              </div>

              {/* Prominent Unit Type Toggle */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <span>Unit Type</span>
                  <span className="text-destructive">*</span>:
                </label>
                <div
                  role="radiogroup"
                  aria-label="Unit Type"
                  className="inline-flex items-center p-1 bg-background border border-border rounded-xl shadow-xs"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={unitType === 'solid'}
                    data-no-focus-outline="true"
                    onClick={() => handleUnitTypeChange('solid')}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        handleUnitTypeChange('liquid');
                      }
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer data-no-focus-outline outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                      unitType === 'solid'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    }`}
                  >
                    <i className="fa-solid fa-cubes-stacked text-xs" />
                    <span>Solid</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={unitType === 'liquid'}
                    data-no-focus-outline="true"
                    onClick={() => handleUnitTypeChange('liquid')}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        handleUnitTypeChange('solid');
                      }
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer data-no-focus-outline outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                      unitType === 'liquid'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    }`}
                  >
                    <i className="fa-solid fa-droplet text-xs" />
                    <span>Liquid</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Nice HR Separator between header and packings */}
            <hr className="border-t border-border/70" />

            {/* Packings List inside the same card */}
            <div className="space-y-4">
              {packings.map((item, index) => {
                const titleErr = errors[`packing_title_${item.id}`];
                const qtyErr = errors[`packing_qty_${item.id}`];
                const densityErr = errors[`packing_density_${item.id}`];
                const isLiquid = unitType === 'liquid';

                return (
                  <div key={item.id} className="space-y-3">
                    {/* Packing Header if multiple items */}
                    {packings.length > 1 && (
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-bold">
                            {index + 1}
                          </span>
                          <span>Packing Option #{index + 1}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemovePacking(item.id)}
                          title="Remove packing"
                          className="w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <i className="fa-solid fa-trash-can text-xs" />
                        </button>
                      </div>
                    )}

                    {/* Inputs Row with Uniform Sizing (h-10) */}
                    {!isLiquid ? (
                      /* SOLID MODE: Packing Title* + Quantity (KG)* */
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                        {/* Packing Title* */}
                        <div className="sm:col-span-7 flex flex-col gap-1.5">
                          <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <span>Packing Title</span>
                            <span className="text-destructive">*</span>
                          </label>
                          <input
                            id={`packing_title_${item.id}`}
                            type="text"
                            value={item.title}
                            onChange={(e) => {
                              handlePackingChange(item.id, 'title', e.target.value);
                              ensureFieldInView(e.currentTarget);
                            }}
                            onFocus={(e) => ensureFieldInView(e.currentTarget)}
                            placeholder="Example: 50 KG BOPP Bag"
                            className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors ${
                              titleErr
                                ? 'border-destructive focus:ring-1 focus:ring-destructive'
                                : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                            }`}
                          />
                          {titleErr && (
                            <span className="text-[10px] text-destructive font-medium">
                              {titleErr}
                            </span>
                          )}
                        </div>

                        {/* Quantity (KG)* */}
                        <div className="sm:col-span-5 flex flex-col gap-1.5">
                          <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <span>Quantity (KG)</span>
                            <span className="text-destructive">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.quantity}
                              onChange={(e) =>
                                handlePackingChange(item.id, 'quantity', e.target.value)
                              }
                              placeholder="Example: 50"
                              className={`w-full h-10 pl-3.5 pr-10 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors font-mono ${
                                qtyErr
                                  ? 'border-destructive focus:ring-1 focus:ring-destructive'
                                  : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                              }`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
                              KG
                            </span>
                          </div>
                          {qtyErr && (
                            <span className="text-[10px] text-destructive font-medium">
                              {qtyErr}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* LIQUID MODE: Packing Title* + Quantity (L)* + Density (Kg/L) + Net WT (KG) */
                      <div className="space-y-3">
                        {/* Packing Title* */}
                        <div className="flex flex-col gap-1.5">
                          <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <span>Packing Title</span>
                            <span className="text-destructive">*</span>
                          </label>
                          <input
                            id={`packing_title_${item.id}`}
                            type="text"
                            value={item.title}
                            onChange={(e) => {
                              handlePackingChange(item.id, 'title', e.target.value);
                              ensureFieldInView(e.currentTarget);
                            }}
                            onFocus={(e) => ensureFieldInView(e.currentTarget)}
                            placeholder="Example: 200L Drum"
                            className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors ${
                              titleErr
                                ? 'border-destructive focus:ring-1 focus:ring-destructive'
                                : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                            }`}
                          />
                          {titleErr && (
                            <span className="text-[10px] text-destructive font-medium">
                              {titleErr}
                            </span>
                          )}
                        </div>

                        {/* 3 Columns: Quantity (L)* + Density (Kg/L) + Net WT (KG) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                          {/* Quantity (L)* */}
                          <div className="flex flex-col gap-1.5">
                            <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <span>Quantity (L)</span>
                              <span className="text-destructive">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.quantity}
                                onChange={(e) =>
                                  handlePackingChange(item.id, 'quantity', e.target.value)
                                }
                                placeholder="Example: 200"
                                className={`w-full h-10 pl-3.5 pr-8 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors font-mono ${
                                  qtyErr
                                    ? 'border-destructive focus:ring-1 focus:ring-destructive'
                                    : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                                }`}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
                                L
                              </span>
                            </div>
                            {qtyErr && (
                              <span className="text-[10px] text-destructive font-medium">
                                {qtyErr}
                              </span>
                            )}
                          </div>

                          {/* Density (Kg/L) (Default: 1) */}
                          <div className="flex flex-col gap-1.5">
                            <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                              <span>Density (Kg/L)</span>
                              <span className="text-[10px] lowercase text-muted-foreground/70 font-normal">
                                (optional)
                              </span>
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={item.density}
                                onChange={(e) =>
                                  handlePackingChange(item.id, 'density', e.target.value)
                                }
                                placeholder="1.00"
                                className={`w-full h-10 pl-3.5 pr-13 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors font-mono ${
                                  densityErr
                                    ? 'border-destructive focus:ring-1 focus:ring-destructive'
                                    : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                                }`}
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground pointer-events-none">
                                Kg/L
                              </span>
                            </div>
                            {densityErr && (
                              <span className="text-[10px] text-destructive font-medium">
                                {densityErr}
                              </span>
                            )}
                          </div>

                          {/* Net WT (KG) (Auto calculate not input) */}
                          <div className="flex flex-col gap-1.5">
                            <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <span>Net WT (KG)</span>
                            </label>
                            <div className="h-10 px-3.5 bg-background border border-border rounded-lg flex items-center justify-between">
                              <span className="font-mono font-bold text-xs sm:text-sm text-foreground">
                                {item.netWeightKg || '0.00'}
                              </span>
                              <span className="text-[11px] font-bold text-muted-foreground">
                                KG
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* HR Separator between multiple packing entries */}
                    {index < packings.length - 1 && (
                      <hr className="border-t border-border/50 my-2" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Scroll Anchor to reliably scroll into view */}
            <div ref={packingsEndRef} />

            {/* Add More Packing Type Button inside the same card */}
            <button
              type="button"
              onClick={handleAddPacking}
              className="w-full h-9.5 rounded-lg border border-dashed border-primary/50 hover:border-primary bg-background hover:bg-primary/5 text-primary font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <i className="fa-solid fa-plus text-xs" />
              <span>Add more packing type</span>
            </button>
          </div>
          </div>

          {/* Sticky Modal Actions Footer */}
          <div className="sticky bottom-0 z-20 flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-border bg-card/95 backdrop-blur-xs shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.35)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9.5 px-4 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
            >
              {dict?.common?.cancel || 'Cancel'}
            </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-9.5 px-5 text-xs font-bold rounded-lg bg-brand-green hover:bg-brand-green-hover text-white shadow-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                ) : (
                  <i className="fa-solid fa-check text-xs" />
                )}
                <span>
                  {mode === 'edit'
                    ? dict?.common?.update || 'Update Product'
                    : dict?.common?.save || 'Save Product'}
                </span>
              </button>
          </div>
        </form>
        )}
      </div>
    </div>,
    document.body
  );
}

export default ProductManageModal;
