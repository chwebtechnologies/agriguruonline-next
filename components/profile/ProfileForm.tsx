"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { toast } from "sonner";
import "@/components/auth/phone-input.css"; 
import SearchableCountrySelect from "@/components/ui/SearchableCountrySelect"; 
import SearchablePhoneInput from "@/components/ui/SearchablePhoneInput"; 
import type { Category } from "@/lib/category";
import { updateProfile } from "@/app/actions/profile";
import { getDefaultUserCountry } from "@/lib/country";

interface ProfileFormProps {
  categories?: Category[];
  countries?: any[];
  lang?: string;
  profileData?: any;
  token?: string;
  common?: any;
}

export default function ProfileForm({ categories = [], countries = [], lang = "en", profileData = null, common = {} }: ProfileFormProps) {
  const router = useRouter();
  const availableCategories = categories
    .filter(cat => cat.is_active !== false)
    .map(cat => {
      const translation = cat.translations?.find(t => t.lang_code === lang);
      return { id: cat.id, name: translation ? translation.name : cat.name };
    });


  const categoryOptions = availableCategories.length > 0
    ? availableCategories
    : [{ id: '1', name: "Agriculture" }, { id: '2', name: "Technology" }];

  const getE164Phone = (code?: string, no?: string, fallback?: string) => {
    if (no) {
      let cCode = code || "";
      if (cCode && !cCode.startsWith('+')) cCode = `+${cCode}`;
      return `${cCode}${no}`;
    }
    return fallback || "";
  };

  const [fullName, setFullName] = useState(() => {
    if (profileData?.first_name) {
      return `${profileData.first_name} ${profileData.last_name || ''}`.trim();
    }
    return profileData?.name || "";
  });
  const [email] = useState(profileData?.email || ""); 
  const [phone, setPhone] = useState(() => getE164Phone(profileData?.country_code, profileData?.mobile_no, profileData?.phone));
  const [userType] = useState(() => {
    if (profileData?.role?.name) return String(profileData.role.name);
    if (profileData?.user_type) {
      if (typeof profileData.user_type === 'string') return profileData.user_type;
      if (typeof profileData.user_type === 'object' && profileData.user_type !== null) {
        return String(profileData.user_type.name || profileData.user_type.title || "Business User");
      }
    }
    return "Business User";
  });
  const [companyName, setCompanyName] = useState(profileData?.company_name || profileData?.business_name || "");

  const [country, setCountry] = useState(() => {
    // 1. If profileData already has country.iso2, use it directly
    if (profileData?.country?.iso2) {
      return String(profileData.country.iso2).toUpperCase();
    }

    // 2. Resolve ISO code from DB country_id by searching countries list
    const dbCountryId = profileData?.country_id || profileData?.country?.id || profileData?.country;
    if (dbCountryId && countries.length > 0) {
      const matched = countries.find(c => 
        c.id === dbCountryId || 
        c.iso2?.toUpperCase() === (typeof dbCountryId === 'string' ? dbCountryId.toUpperCase() : '')
      );
      if (matched && matched.iso2) {
        return matched.iso2.toUpperCase();
      }
    }

    // 2. Fallback to parsing from phone number
    try {
      if (profileData?.mobile_no || profileData?.phone) {
        const { parsePhoneNumber } = require('react-phone-number-input');
        const phoneStr = getE164Phone(profileData?.country_code, profileData?.mobile_no, profileData?.phone);
        const parsed = parsePhoneNumber(phoneStr);
        if (parsed && parsed.country) {
          return parsed.country;
        }
      }
    } catch (e) {}

    // 3. Fallback to raw code or AE
    return profileData?.country_code && typeof profileData.country_code === 'string' && !profileData.country_code.startsWith('+') 
      ? profileData.country_code 
      : "AE";
  });
  
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const cats = profileData?.category || profileData?.categories || profileData?.user_category || profileData?.user_categories;
    if (cats && Array.isArray(cats)) {
      return cats.map((c: any) => {
        const val = typeof c === 'string' ? c : (c.category_id || c.id || c._id || c.name);
        const matched = categoryOptions.find(opt => 
          String(opt.id) === String(val) || 
          opt.name?.toLowerCase() === (typeof c === 'string' ? c.toLowerCase() : c.name?.toLowerCase())
        );
        return matched ? String(matched.id) : (c.id || c.category_id || val);
      }).filter(Boolean).map(String);
    }
    return [];
  });
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const categoryRef = useRef<HTMLDivElement>(null);
  const personalRef = useRef<HTMLDivElement>(null);
  const businessRef = useRef<HTMLDivElement>(null);

  const [businessAddress, setBusinessAddress] = useState(profileData?.business_address || profileData?.address || "");
  const [altNumber, setAltNumber] = useState(() => {
    return getE164Phone(
      profileData?.other_country_code,
      profileData?.other_numer || profileData?.other_number,
      profileData?.alternate_mobile_no || profileData?.alternate_phone
    );
  });
  const [altEmail, setAltEmail] = useState(profileData?.other_email || profileData?.alternate_email || "");
  const [website, setWebsite] = useState(profileData?.website || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPersonalOpen, setIsPersonalOpen] = useState(false);
  const [isBusinessOpen, setIsBusinessOpen] = useState(false);

  useEffect(() => {
    const handleAccordion = (e: any) => {
      if (e.detail !== 'personal') setIsPersonalOpen(false);
      if (e.detail !== 'business') setIsBusinessOpen(false);
    };
    window.addEventListener('profile-accordion', handleAccordion);
    return () => window.removeEventListener('profile-accordion', handleAccordion);
  }, []);

  const togglePersonal = () => {
    const newState = !isPersonalOpen;
    setIsPersonalOpen(newState);
    if (newState) {
      window.dispatchEvent(new CustomEvent('profile-accordion', { detail: 'personal' }));
      setTimeout(() => {
        if (personalRef.current) {
          const yOffset = -140; 
          const y = personalRef.current.getBoundingClientRect().top + window.scrollY + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 350); // wait slightly longer for the accordion transition to finish
    }
  };

  const toggleBusiness = () => {
    const newState = !isBusinessOpen;
    setIsBusinessOpen(newState);
    if (newState) {
      window.dispatchEvent(new CustomEvent('profile-accordion', { detail: 'business' }));
      setTimeout(() => {
        if (businessRef.current) {
          const yOffset = -140;
          const y = businessRef.current.getBoundingClientRect().top + window.scrollY + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 350);
    }
  };

  // Derive initial values for dirty check
  const initialState = useRef({
    fullName: profileData?.first_name ? `${profileData.first_name} ${profileData.last_name || ''}`.trim() : (profileData?.name || ""),
    phone: getE164Phone(profileData?.country_code, profileData?.mobile_no, profileData?.phone),
    companyName: profileData?.company_name || profileData?.business_name || "",
    country: country,
    selectedCategories: (() => {
      const cats = profileData?.category || profileData?.categories || profileData?.user_category || profileData?.user_categories;
      if (cats && Array.isArray(cats)) {
        return cats.map((c: any) => {
          const val = typeof c === 'string' ? c : (c.category_id || c.id || c._id || c.name);
          const matched = categoryOptions.find(opt => 
            String(opt.id) === String(val) || 
            opt.name?.toLowerCase() === (typeof c === 'string' ? c.toLowerCase() : c.name?.toLowerCase())
          );
          return matched ? String(matched.id) : (c.id || c.category_id || val);
        }).filter(Boolean).map(String);
      }
      return [];
    })(),
    businessAddress: profileData?.business_address || profileData?.address || "",
    altNumber: getE164Phone(
      profileData?.other_country_code,
      profileData?.other_numer || profileData?.other_number,
      profileData?.alternate_mobile_no || profileData?.alternate_phone
    ),
    altEmail: profileData?.other_email || profileData?.alternate_email || "",
    website: profileData?.website || ""
  });

  const isDirty = 
    fullName !== initialState.current.fullName ||
    phone !== initialState.current.phone ||
    companyName !== initialState.current.companyName ||
    country !== initialState.current.country ||
    JSON.stringify(selectedCategories.sort()) !== JSON.stringify(initialState.current.selectedCategories.sort()) ||
    businessAddress !== initialState.current.businessAddress ||
    altNumber !== initialState.current.altNumber ||
    altEmail !== initialState.current.altEmail ||
    website !== initialState.current.website;

  // Synchronize internal state whenever profileData prop changes (e.g., after router.refresh() completes)
  useEffect(() => {
    if (!profileData) return;

    const newFullName = profileData?.first_name 
      ? `${profileData.first_name} ${profileData.last_name || ''}`.trim() 
      : (profileData?.name || "");
    const newPhone = getE164Phone(profileData?.country_code, profileData?.mobile_no, profileData?.phone);
    const newCompany = profileData?.company_name || profileData?.business_name || "";
    const newAddress = profileData?.business_address || profileData?.address || "";
    const newAltNumber = getE164Phone(
      profileData?.other_country_code,
      profileData?.other_numer || profileData?.other_number,
      profileData?.alternate_mobile_no || profileData?.alternate_phone
    );
    const newAltEmail = profileData?.other_email || profileData?.alternate_email || "";
    const newWebsite = profileData?.website || "";

    let newCountry = "AE";
    if (profileData?.country?.iso2) {
      newCountry = String(profileData.country.iso2).toUpperCase();
    } else {
      const dbCountryId = profileData?.country_id || profileData?.country?.id || profileData?.country;
      if (dbCountryId && countries.length > 0) {
        const matched = countries.find(c => 
          c.id === dbCountryId || 
          c.iso2?.toUpperCase() === (typeof dbCountryId === 'string' ? dbCountryId.toUpperCase() : '')
        );
        if (matched && matched.iso2) {
          newCountry = matched.iso2.toUpperCase();
        }
      } else {
        try {
          if (profileData?.mobile_no || profileData?.phone) {
            const { parsePhoneNumber } = require('react-phone-number-input');
            const phoneStr = getE164Phone(profileData?.country_code, profileData?.mobile_no, profileData?.phone);
            const parsed = parsePhoneNumber(phoneStr);
            if (parsed && parsed.country) {
              newCountry = parsed.country;
            }
          }
        } catch (e) {}
      }
    }

    const cats = profileData?.category || profileData?.categories || profileData?.user_category || profileData?.user_categories;
    let newCats: string[] = [];
    if (cats && Array.isArray(cats)) {
      newCats = cats.map((c: any) => {
        const val = typeof c === 'string' ? c : (c.category_id || c.id || c._id || c.name);
        const matched = categoryOptions.find(opt => 
          String(opt.id) === String(val) || 
          opt.name?.toLowerCase() === (typeof c === 'string' ? c.toLowerCase() : c.name?.toLowerCase())
        );
        return matched ? String(matched.id) : (c.id || c.category_id || val);
      }).filter(Boolean).map(String);
    }

    setFullName(newFullName);
    setPhone(newPhone);
    setCompanyName(newCompany);
    setCountry(newCountry);
    setSelectedCategories(newCats);
    setBusinessAddress(newAddress);
    setAltNumber(newAltNumber);
    setAltEmail(newAltEmail);
    setWebsite(newWebsite);

    initialState.current = {
      fullName: newFullName,
      phone: newPhone,
      companyName: newCompany,
      country: newCountry,
      selectedCategories: newCats,
      businessAddress: newAddress,
      altNumber: newAltNumber,
      altEmail: newAltEmail,
      website: newWebsite,
    };
  }, [profileData]);



  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev => 
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  const filteredCategories = categoryOptions.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()));

  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    if (!isDirty && !hasSubmitted) return;
    
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = "Full Name is required";
    if (!phone || !isValidPhoneNumber(phone)) newErrors.phone = "Valid Mobile Number is required";
    if (altNumber && !isValidPhoneNumber(altNumber)) newErrors.altNumber = "Valid Mobile Number is required";
    if (!companyName.trim()) newErrors.companyName = "Company Name is required";
    if (selectedCategories.length === 0) newErrors.categories = "Please select at least one category";
    const trimmedAltEmail = altEmail.trim();
    const trimmedWebsite = website.trim();
    if (trimmedAltEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedAltEmail)) newErrors.altEmail = "Valid email is required";
    if (trimmedWebsite && !/^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z]{2,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/i.test(trimmedWebsite)) newErrors.website = "Valid URL (e.g., https://example.com) is required";
    
    setErrors(newErrors);
  }, [fullName, phone, altNumber, companyName, selectedCategories, altEmail, website, isDirty, hasSubmitted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);
    if (!isDirty) return;
    
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = "Full Name is required";
    if (!phone || !isValidPhoneNumber(phone)) newErrors.phone = "Valid Mobile Number is required";
    if (altNumber && !isValidPhoneNumber(altNumber)) newErrors.altNumber = "Valid Mobile Number is required";
    if (!companyName.trim()) newErrors.companyName = "Company Name is required";
    if (selectedCategories.length === 0) newErrors.categories = "Please select at least one category";
    const trimmedAltEmail = altEmail.trim();
    const trimmedWebsite = website.trim();
    if (trimmedAltEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedAltEmail)) newErrors.altEmail = "Valid email is required";
    if (trimmedWebsite && !/^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z]{2,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/i.test(trimmedWebsite)) newErrors.website = "Valid URL (e.g., https://example.com) is required";
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fix the errors in the form");
      return;
    }
    setErrors({});
    
    setIsSubmitting(true);
    try {
      const { parsePhoneNumber } = require('react-phone-number-input');
      const parsed = parsePhoneNumber(phone);
      
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : "";
      
      const userId = profileData?.id || profileData?._id || profileData?.customer_id;
      if (!userId) throw new Error("User ID not found in profile data");

      const selectedCountryObj = countries.find(c => c.iso2?.toUpperCase() === country?.toUpperCase());
      const selectedCountryId = selectedCountryObj?.id || profileData?.country_id || "";

      let altParsed: any = null;
      if (altNumber) {
        try {
          altParsed = parsePhoneNumber(altNumber);
        } catch {}
      }

      const payload: Record<string, any> = {
        first_name: firstName,
        last_name: lastName,
        country_id: selectedCountryId, 
        country_code: parsed ? `+${parsed.countryCallingCode}` : "",
        mobile_no: parsed ? parsed.nationalNumber : phone,
        user_type: profileData?.user_type?.id || profileData?.user_type || "",
        email: email,
        category: selectedCategories,
        company_name: companyName.trim(),
        registration_type: profileData?.registration_type || "",
        registration_number: profileData?.registration_number || "",
      };

      if (altNumber && altNumber.trim()) {
        const otherCountryCode = altParsed ? `+${altParsed.countryCallingCode}` : "";
        const otherNum = altParsed ? altParsed.nationalNumber : altNumber.trim();
        payload.other_country_code = otherCountryCode;
        payload.other_numer = otherNum;
        payload.other_number = otherNum;
        payload.alternate_mobile_no = altNumber;
      } else {
        payload.other_country_code = null;
        payload.other_numer = null;
        payload.other_number = null;
        payload.alternate_mobile_no = null;
      }

      if (businessAddress.trim()) {
        payload.business_address = businessAddress.trim();
      }
      if (trimmedWebsite) {
        payload.website = trimmedWebsite;
      }
      if (trimmedAltEmail) {
        payload.other_email = trimmedAltEmail;
      } else {
        // Explicitly null or omitted so backend does not validate "" as an invalid email
        payload.other_email = null;
      }

      const result = await updateProfile(userId, payload, lang);

      if (!result.success) {
        throw new Error(result.error || "Failed to update profile");
      }

      toast.success(result.message || "Profile updated successfully!");
      
      // Update initial state to reflect new saved values
      initialState.current = {
        fullName, phone, companyName, country, selectedCategories, businessAddress, altNumber, altEmail, website
      };
      
      router.refresh();
      
    } catch (error: any) {
      toast.error(error.message || "An error occurred while updating profile");
      console.error("Profile update error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2 lg:gap-6">
        
      {/* Basic Details Group */}
      <div ref={personalRef} className="group bg-card border border-border shadow-xs rounded-2xl flex flex-col overflow-hidden">
        <div onClick={togglePersonal} className="px-4 py-3.5 sm:px-6 sm:py-4 flex items-center justify-between cursor-pointer lg:pointer-events-none list-none lg:border-b lg:border-border select-none bg-muted/30 rounded-2xl lg:rounded-b-none transition-colors">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center shadow-2xs">
                <i className="fa-regular fa-user text-[14px] sm:text-base"></i>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-foreground">
                Basic Details
              </h3>
            </div>
            <i className={`fa-solid fa-chevron-down lg:!hidden transition-transform duration-300 text-muted-foreground ${isPersonalOpen ? 'rotate-180' : ''}`}></i>
          </div>
          
          <div className={`${isPersonalOpen ? 'block' : 'hidden'} lg:!block p-5 sm:p-6 animate-in slide-in-from-top-2 duration-300`}>
          
          <div className="flex flex-col sm:flex-row gap-6 lg:gap-8 items-start">
            {/* Form Fields Column */}
            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 w-full">
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className={`text-xs font-bold uppercase tracking-wider pl-0.5 ${errors.fullName ? 'text-red-500' : 'text-foreground/80'}`}>Full Name <span className="text-red-500">*</span></label>
                <div className="relative group">
                  <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center transition-colors ${errors.fullName ? 'text-red-500' : 'text-muted-foreground group-focus-within:text-brand-blue'}`}>
                    <i className="fa-regular fa-id-card text-[15px]"></i>
                  </div>
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errors.fullName) setErrors(prev => ({ ...prev, fullName: "" }));
                    }}
                    className={`w-full pl-10 pr-4 h-[48px] bg-background hover:bg-muted/30 border ${errors.fullName ? 'border-red-500 text-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' : 'border-border/80 hover:border-border focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'} rounded-xl focus:bg-background focus:outline-none transition-all font-medium text-sm shadow-xs ${errors.fullName ? 'text-red-500 placeholder-red-300' : 'text-foreground placeholder:text-muted-foreground/50'}`}
                  />
                </div>
                {errors.fullName && <p className="text-red-500 text-xs mt-1 ml-1 font-medium">{errors.fullName}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground/80 pl-0.5 flex justify-between items-center">
                  <span>Email Address</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/90 border border-border/70 px-2.5 py-0.5 rounded-full font-bold select-none flex items-center gap-1 shadow-2xs">
                    <i className="fa-solid fa-lock text-[8px] opacity-70"></i>Read-only
                  </span>
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted-foreground/60">
                    <i className="fa-regular fa-envelope text-[15px]"></i>
                  </div>
                  <input 
                    type="email" 
                    value={email}
                    disabled
                    readOnly
                    tabIndex={-1}
                    className="w-full pl-10 pr-4 h-[48px] bg-muted/40 border border-dashed border-border/80 rounded-xl text-muted-foreground/90 cursor-not-allowed focus:outline-none font-medium text-sm select-none pointer-events-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={`text-xs font-bold uppercase tracking-wider pl-0.5 ${errors.phone ? 'text-red-500' : 'text-foreground/80'}`}>Mobile Number <span className="text-red-500">*</span></label>
                <div className={errors.phone ? 'border border-red-500 rounded-xl focus-within:ring-2 focus-within:ring-red-500/20' : ''}>
                  <SearchablePhoneInput
                    defaultCountry={getDefaultUserCountry()}
                    value={phone}
                    onChange={(val) => {
                      setPhone(val || "");
                      if (errors.phone) setErrors(prev => ({ ...prev, phone: "" }));
                    }}
                  />
                </div>
                {errors.phone && <p className="text-red-500 text-xs mt-1 ml-1 font-medium">{errors.phone}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={`text-xs font-bold uppercase tracking-wider pl-0.5 ${errors.altNumber ? 'text-red-500' : 'text-foreground/80'}`}>Alternate Number <span className={`font-normal lowercase tracking-normal text-xs ${errors.altNumber ? 'text-red-500/60' : 'text-muted-foreground/70'}`}>(optional)</span></label>
                <div className={errors.altNumber ? 'border border-red-500 rounded-xl focus-within:ring-2 focus-within:ring-red-500/20' : ''}>
                  <SearchablePhoneInput
                    defaultCountry={getDefaultUserCountry()}
                    value={altNumber}
                    onChange={(val) => {
                      setAltNumber(val || "");
                      if (errors.altNumber) setErrors(prev => ({ ...prev, altNumber: "" }));
                    }}
                  />
                </div>
                {errors.altNumber && <p className="text-red-500 text-xs mt-1 ml-1 font-medium">{errors.altNumber}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={`text-xs font-bold uppercase tracking-wider pl-0.5 ${errors.altEmail ? 'text-red-500' : 'text-foreground/80'}`}>Alternate Email <span className={`font-normal lowercase tracking-normal text-xs ${errors.altEmail ? 'text-red-500/60' : 'text-muted-foreground/70'}`}>(optional)</span></label>
                <div className="relative group">
                  <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center transition-colors ${errors.altEmail ? 'text-red-500' : 'text-muted-foreground group-focus-within:text-brand-blue'}`}>
                    <i className="fa-regular fa-envelope text-[15px]"></i>
                  </div>
                  <input 
                    type="email" 
                    value={altEmail}
                    onChange={(e) => {
                      setAltEmail(e.target.value);
                      if (errors.altEmail) setErrors(prev => ({ ...prev, altEmail: "" }));
                    }}
                    className={`w-full pl-10 pr-4 h-[48px] bg-background hover:bg-muted/30 border ${errors.altEmail ? 'border-red-500 text-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' : 'border-border/80 hover:border-border focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'} rounded-xl focus:bg-background focus:outline-none transition-all font-medium text-sm shadow-xs ${errors.altEmail ? 'text-red-500 placeholder-red-300' : 'text-foreground placeholder:text-muted-foreground/50'}`}
                    placeholder={common.alternate_email || "alternate@example.com"}
                  />
                </div>
                {errors.altEmail && <p className="text-red-500 text-xs mt-1 ml-1 font-medium">{errors.altEmail}</p>}
              </div>
              </div>
            </div>
            
            {/* Mobile Save Button (Inside Collapse) */}
            <div className="mt-6 flex lg:!hidden justify-end border-t border-foreground/5 pt-4 pb-1 pr-2">
              <button type="submit" disabled={isSubmitting || !isDirty} className={`px-6 py-2 bg-brand-blue hover:bg-brand-blue-hover text-white rounded-lg text-[13px] font-bold shadow-md flex items-center gap-2 ${(!isDirty || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {isSubmitting ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : <><i className="fa-solid fa-check"></i> Save</>}
              </button>
            </div>
          </div>
      </div>

      {/* Business Details Group */}
      <div ref={businessRef} className="group bg-card border border-border shadow-xs rounded-2xl flex flex-col overflow-hidden">
        <div onClick={toggleBusiness} className="px-4 py-3.5 sm:px-6 sm:py-4 flex items-center justify-between cursor-pointer lg:pointer-events-none list-none lg:border-b lg:border-border select-none bg-muted/30 rounded-2xl lg:rounded-b-none transition-colors">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center shadow-2xs">
                <i className="fa-solid fa-briefcase text-[14px] sm:text-base"></i>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-foreground">
                Business Details
              </h3>
            </div>
            <i className={`fa-solid fa-chevron-down lg:!hidden transition-transform duration-300 text-muted-foreground ${isBusinessOpen ? 'rotate-180' : ''}`}></i>
          </div>
          
          <div className={`${isBusinessOpen ? 'block' : 'hidden'} lg:!block p-5 sm:p-6 animate-in slide-in-from-top-2 duration-300`}>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div className="flex flex-col gap-1.5">
              <label className={`text-xs font-bold uppercase tracking-wider pl-0.5 ${errors.companyName ? 'text-red-500' : 'text-foreground/80'}`}>Company Name <span className="text-red-500">*</span></label>
              <div className="relative group">
                <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center transition-colors ${errors.companyName ? 'text-red-500' : 'text-muted-foreground group-focus-within:text-brand-blue'}`}>
                  <i className="fa-regular fa-building text-[15px]"></i>
                </div>
                <input 
                  type="text" 
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    if (errors.companyName) setErrors(prev => ({ ...prev, companyName: "" }));
                  }}
                  className={`w-full pl-10 pr-4 h-[48px] bg-background hover:bg-muted/30 border ${errors.companyName ? 'border-red-500 text-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' : 'border-border/80 hover:border-border focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'} rounded-xl focus:bg-background focus:outline-none transition-all font-medium text-sm shadow-xs ${errors.companyName ? 'text-red-500 placeholder-red-300' : 'text-foreground placeholder:text-muted-foreground/50'}`}
                />
              </div>
              {errors.companyName && <p className="text-red-500 text-xs mt-1 ml-1 font-medium">{errors.companyName}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground/80 pl-0.5">Country <span className="text-red-500">*</span></label>
              <SearchableCountrySelect
                value={country}
                onChange={(val) => setCountry(val || "AE")}
                showDialCode={false}
              />
            </div>

            <div className="flex flex-col gap-1.5 relative md:col-span-2" ref={categoryRef}>
              <label className={`text-xs font-bold uppercase tracking-wider pl-0.5 ${errors.categories ? 'text-red-500' : 'text-foreground/80'}`}>Categories <span className="text-red-500">*</span></label>
              <div 
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                className={`w-full px-3.5 min-h-[48px] bg-background hover:bg-muted/30 border ${errors.categories ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' : 'border-border/80 hover:border-border focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'} rounded-xl flex items-center justify-between cursor-pointer focus:bg-background focus:outline-none transition-all font-medium text-sm shadow-xs`}
                tabIndex={0}
              >
                <div className="flex flex-wrap gap-1.5 py-1.5">
                  {selectedCategories.length > 0 ? (
                    selectedCategories.map(catId => {
                      const foundOption = categoryOptions.find(c => String(c.id) === String(catId));
                      const origCats = profileData?.category || profileData?.categories || profileData?.user_category || profileData?.user_categories;
                      let origName = "";
                      if (Array.isArray(origCats)) {
                        const foundOrig = origCats.find((c: any) => String(c?.id || c?.category_id || c) === String(catId));
                        if (foundOrig && typeof foundOrig === 'object') {
                          origName = foundOrig.name || foundOrig.title || "";
                        }
                      }
                      const catName = foundOption?.name || origName || catId;
                      return (
                        <span key={catId} className="px-2.5 py-1 bg-brand-blue/10 text-brand-blue border border-brand-blue/20 rounded-md text-sm flex items-center gap-1.5 shadow-2xs font-semibold">
                          {catName}
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleCategory(catId); }}
                            className="text-brand-blue/60 hover:text-brand-blue transition-colors"
                          >
                            <i className="fa-solid fa-xmark text-xs"></i>
                          </button>
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-muted-foreground/60 flex items-center gap-2">
                      <i className="fa-solid fa-tags text-muted-foreground/40"></i> Select categories...
                    </span>
                  )}
                </div>
                <i className="fa-solid fa-chevron-down text-xs text-muted-foreground/60 shrink-0 ml-2"></i>
              </div>
              
              {isCategoryOpen && (
                <div className="absolute top-full mt-1.5 left-0 w-full bg-background border border-border rounded-xl shadow-xl z-20 max-h-60 flex flex-col animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                  <div className="p-2 border-b border-border/60 shrink-0 bg-muted/20">
                    <input 
                      type="text" 
                      placeholder={common.search_categories || "Search categories..."} 
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border/70 rounded-lg text-sm focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors placeholder:text-muted-foreground/50 text-foreground"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="overflow-y-auto p-1.5 custom-scrollbar">
                    {filteredCategories.map(cat => (
                      <div 
                        key={cat.id} 
                        onClick={() => toggleCategory(cat.id)}
                        className="px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-muted/60 transition-colors flex items-center justify-between"
                      >
                        <span className={selectedCategories.includes(cat.id) ? "font-semibold text-foreground" : "text-foreground/80"}>{cat.name}</span>
                        {selectedCategories.includes(cat.id) && <i className="fa-solid fa-check text-brand-blue"></i>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {errors.categories && <p className="text-red-500 text-xs mt-1 ml-1 font-medium">{errors.categories}</p>}
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground/80 pl-0.5">Business Address <span className="text-muted-foreground/70 lowercase tracking-normal font-normal text-xs">(optional)</span></label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted-foreground group-focus-within:text-brand-blue transition-colors">
                  <i className="fa-solid fa-location-dot text-[15px]"></i>
                </div>
                <input 
                  type="text"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  className="w-full pl-10 pr-4 h-[48px] bg-background hover:bg-muted/30 border border-border/80 hover:border-border rounded-xl focus:bg-background focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all font-medium text-sm text-foreground shadow-xs placeholder:text-muted-foreground/50"
                  placeholder={common.address_placeholder || "Building, Street, City"}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground/80 pl-0.5 flex justify-between items-center">
                <span>User Type</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/90 border border-border/70 px-2.5 py-0.5 rounded-full font-bold select-none flex items-center gap-1 shadow-2xs">
                  <i className="fa-solid fa-lock text-[8px] opacity-70"></i>Read-only
                </span>
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted-foreground/60">
                  <i className="fa-solid fa-user-tag text-[15px]"></i>
                </div>
                <input 
                  type="text" 
                  value={userType}
                  disabled
                  readOnly
                  tabIndex={-1}
                  className="w-full pl-10 pr-4 h-[48px] bg-muted/40 border border-dashed border-border/80 rounded-xl text-muted-foreground/90 cursor-not-allowed focus:outline-none font-medium text-sm select-none pointer-events-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={`text-xs font-bold uppercase tracking-wider pl-0.5 ${errors.website ? 'text-red-500' : 'text-foreground/80'}`}>Website <span className={`font-normal lowercase tracking-normal text-xs ${errors.website ? 'text-red-500/60' : 'text-muted-foreground/70'}`}>(optional)</span></label>
              <div className="relative group">
                <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center transition-colors ${errors.website ? 'text-red-500' : 'text-muted-foreground group-focus-within:text-brand-blue'}`}>
                  <i className="fa-solid fa-link text-[15px]"></i>
                </div>
                <input 
                  type="url" 
                  value={website}
                  onChange={(e) => {
                    setWebsite(e.target.value);
                    if (errors.website) setErrors(prev => ({ ...prev, website: "" }));
                  }}
                  className={`w-full pl-10 pr-4 h-[48px] bg-background hover:bg-muted/30 border ${errors.website ? 'border-red-500 text-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' : 'border-border/80 hover:border-border focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'} rounded-xl focus:bg-background focus:outline-none transition-all font-medium text-sm shadow-xs ${errors.website ? 'text-red-500 placeholder-red-300' : 'text-foreground placeholder:text-muted-foreground/50'}`}
                  placeholder={common.website_placeholder || "https://www.example.com"}
                />
              </div>
              {errors.website && <p className="text-red-500 text-xs mt-1 ml-1 font-medium">{errors.website}</p>}
            </div>
          </div>
          
          {/* Mobile Save Button (Inside Collapse) */}
          <div className="mt-6 flex lg:!hidden justify-end border-t border-foreground/5 pt-4 pb-1 pr-2">
            <button type="submit" disabled={isSubmitting || !isDirty} className={`px-6 py-2 bg-brand-blue hover:bg-brand-blue-hover text-white rounded-lg text-[13px] font-bold shadow-md flex items-center gap-2 ${(!isDirty || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {isSubmitting ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : <><i className="fa-solid fa-check"></i> Save</>}
            </button>
          </div>
          
          </div>
        </div>

      {/* Form Actions (Desktop Only) */}
      <div className="hidden lg:!flex justify-end">
        <button 
          type="submit" 
          disabled={isSubmitting || !isDirty}
          className={`px-6 py-2.5 bg-brand-blue hover:bg-brand-blue-hover text-white rounded-lg text-[13px] font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2 ${(!isDirty || isSubmitting) ? 'opacity-70 cursor-not-allowed transform-none hover:shadow-md hover:translate-y-0' : ''}`}
        >
          {isSubmitting ? (
            <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving changes...</>
          ) : (
            <><i className="fa-solid fa-check"></i> Save Changes</>
          )}
        </button>
      </div>
    </form>
  );
}
