"use client";

import { useState, useRef, useEffect } from "react";
import { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { toast } from "sonner";
import "@/components/auth/phone-input.css"; 
import SearchableCountrySelect from "@/components/ui/SearchableCountrySelect"; 
import SearchablePhoneInput from "@/components/ui/SearchablePhoneInput"; 

const CATEGORIES = [
  "Agriculture", "Technology", "Trading", "Logistics", "Finance", "Manufacturing", "Retail",
];

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "IN", name: "India" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
];

export default function ProfileForm() {
  const [fullName, setFullName] = useState("John Doe");
  const [email] = useState("john.doe@example.com"); 
  const [phone, setPhone] = useState("+971501234567");
  const [userType] = useState("Business User"); 
  const [companyName, setCompanyName] = useState("Agriguru Trading LLC");
  const [country, setCountry] = useState("AE");
  
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["Agriculture", "Trading"]);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const categoryRef = useRef<HTMLDivElement>(null);

  const [businessAddress, setBusinessAddress] = useState("");
  const [altNumber, setAltNumber] = useState("");
  const [altEmail, setAltEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPersonalOpen, setIsPersonalOpen] = useState(false);
  const [isBusinessOpen, setIsBusinessOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const filteredCategories = CATEGORIES.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase()));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Full Name is required");
    if (!phone || !isValidPhoneNumber(phone)) return toast.error("Valid Mobile Number is required");
    if (!companyName.trim()) return toast.error("Company Name is required");
    if (selectedCategories.length === 0) return toast.error("Please select at least one category");
    
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      toast.success("Profile updated successfully!");
    }, 1500);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 lg:gap-6">
        
      {/* Personal Details Group */}
      <div className="group bg-background border border-foreground/10 rounded-xl shadow-sm flex flex-col">
        <div onClick={() => setIsPersonalOpen(!isPersonalOpen)} className="px-4 py-2 sm:px-6 sm:py-4 flex items-center justify-between cursor-pointer lg:pointer-events-none list-none lg:border-b lg:border-foreground/5 select-none bg-foreground/[0.02] rounded-xl lg:rounded-b-none transition-colors">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-[#1D92EB]/10 text-[#1D92EB] flex items-center justify-center">
                <i className="fa-regular fa-user text-[11px] sm:text-sm"></i>
              </div>
              <h3 className="text-[15px] sm:text-lg font-bold text-foreground">
                Personal Details
              </h3>
            </div>
            <i className={`fa-solid fa-chevron-down lg:!hidden transition-transform duration-300 text-foreground/50 ${isPersonalOpen ? 'rotate-180' : ''}`}></i>
          </div>
          
          <div className={`${isPersonalOpen ? 'block' : 'hidden'} lg:!block p-5 sm:p-6 animate-in slide-in-from-top-2 duration-300`}>
          
          <div className="flex flex-col sm:flex-row gap-6 lg:gap-8 items-start">
            {/* Form Fields Column */}
            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 w-full">
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-sm font-semibold text-foreground/90 pl-0.5">Full Name <span className="text-red-500">*</span></label>
                <div className="relative">
                  <i className="fa-regular fa-id-card absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30"></i>
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-3.5 h-[46px] bg-foreground/[0.02] hover:bg-foreground/[0.04] border border-foreground/15 rounded-xl focus:bg-background focus:outline-none focus:ring-2 focus:ring-[#0c5a53]/50 focus:border-[#0c5a53] transition-all font-medium text-sm text-foreground"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-foreground/90 pl-0.5 flex justify-between">
                  Email Address <span className="text-[10px] uppercase tracking-wider text-foreground/40 bg-foreground/5 px-2 py-0.5 rounded-md font-bold">Read-only</span>
                </label>
                <div className="relative opacity-70">
                  <i className="fa-regular fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40"></i>
                  <input 
                    type="email" 
                    value={email}
                    readOnly
                    className="w-full pl-10 pr-3.5 h-[46px] bg-foreground/5 border border-foreground/10 rounded-xl text-foreground/70 cursor-not-allowed focus:outline-none font-medium text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-foreground/90 pl-0.5">Mobile Number <span className="text-red-500">*</span></label>
                <SearchablePhoneInput
                  defaultCountry="AE"
                  value={phone}
                  onChange={(val) => setPhone(val || "")}
                />
              </div>
              </div>
            </div>
            
            {/* Mobile Save Button (Inside Collapse) */}
            <div className="mt-6 flex lg:!hidden justify-end border-t border-foreground/5 pt-4 pb-1 pr-2">
              <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-[#1D92EB] hover:bg-[#157dc9] text-white rounded-lg text-[13px] font-bold shadow-md flex items-center gap-2">
                {isSubmitting ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : <><i className="fa-solid fa-check"></i> Save</>}
              </button>
            </div>
          </div>
      </div>

      {/* Business Details Group */}
      <div className="group bg-background border border-foreground/10 rounded-xl shadow-sm flex flex-col">
        <div onClick={() => setIsBusinessOpen(!isBusinessOpen)} className="px-4 py-2 sm:px-6 sm:py-4 flex items-center justify-between cursor-pointer lg:pointer-events-none list-none lg:border-b lg:border-foreground/5 select-none bg-foreground/[0.02] rounded-xl lg:rounded-b-none transition-colors">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-[#1D92EB]/10 text-[#1D92EB] flex items-center justify-center">
                <i className="fa-solid fa-briefcase text-[11px] sm:text-sm"></i>
              </div>
              <h3 className="text-[15px] sm:text-lg font-bold text-foreground">
                Business Profile
              </h3>
            </div>
            <i className={`fa-solid fa-chevron-down lg:!hidden transition-transform duration-300 text-foreground/50 ${isBusinessOpen ? 'rotate-180' : ''}`}></i>
          </div>
          
          <div className={`${isBusinessOpen ? 'block' : 'hidden'} lg:!block p-5 sm:p-6 animate-in slide-in-from-top-2 duration-300`}>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-foreground/90 pl-0.5">Company Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <i className="fa-regular fa-building absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30"></i>
                <input 
                  type="text" 
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full pl-10 pr-3.5 h-[46px] bg-foreground/[0.02] hover:bg-foreground/[0.04] border border-foreground/15 rounded-xl focus:bg-background focus:outline-none focus:ring-2 focus:ring-[#0c5a53]/50 focus:border-[#0c5a53] transition-all font-medium text-sm text-foreground"
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-foreground/90 pl-0.5 flex justify-between">
                User Type <span className="text-[10px] uppercase tracking-wider text-foreground/40 bg-foreground/5 px-2 py-0.5 rounded-md font-bold">Read-only</span>
              </label>
              <div className="relative opacity-70">
                <i className="fa-solid fa-user-tag absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40"></i>
                <input 
                  type="text" 
                  value={userType}
                  readOnly
                  className="w-full pl-10 pr-3.5 h-[46px] bg-foreground/5 border border-foreground/10 rounded-xl text-foreground/70 cursor-not-allowed focus:outline-none font-medium text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-foreground/90 pl-0.5">Country <span className="text-red-500">*</span></label>
              <SearchableCountrySelect
                value={country}
                onChange={(val) => setCountry(val || "AE")}
                showDialCode={false}
              />
            </div>

            <div className="flex flex-col gap-1.5 relative md:col-span-2" ref={categoryRef}>
              <label className="text-sm font-semibold text-foreground/90 pl-0.5">Categories <span className="text-red-500">*</span></label>
              <div 
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                className="w-full px-3.5 min-h-[46px] bg-foreground/[0.02] hover:bg-foreground/[0.04] border border-foreground/15 rounded-xl flex items-center justify-between cursor-pointer focus:bg-background focus:outline-none focus:ring-2 focus:ring-[#0c5a53]/50 focus:border-[#0c5a53] transition-all font-medium text-sm"
                tabIndex={0}
              >
                <div className="flex flex-wrap gap-1.5 py-1.5">
                  {selectedCategories.length > 0 ? (
                    selectedCategories.map(cat => (
                      <span key={cat} className="px-2.5 py-1 bg-[#0c5a53]/10 text-[#0c5a53] border border-[#0c5a53]/20 rounded-md text-sm flex items-center gap-1.5 shadow-sm">
                        {cat}
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleCategory(cat); }}
                          className="text-[#0c5a53]/50 hover:text-[#0c5a53] transition-colors"
                        >
                          <i className="fa-solid fa-xmark text-xs"></i>
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-foreground/40 flex items-center gap-2">
                      <i className="fa-solid fa-tags text-foreground/30"></i> Select categories...
                    </span>
                  )}
                </div>
                <i className="fa-solid fa-chevron-down text-xs text-foreground/40 shrink-0 ml-2"></i>
              </div>
              
              {isCategoryOpen && (
                <div className="absolute top-full mt-1 left-0 w-full bg-background border border-foreground/10 rounded-xl shadow-xl z-20 max-h-60 flex flex-col animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-2 border-b border-foreground/5 shrink-0">
                    <input 
                      type="text" 
                      placeholder="Search categories..." 
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="w-full px-3 py-2 bg-foreground/5 border border-transparent rounded-lg text-sm focus:outline-none focus:border-[#0c5a53]/30 focus:bg-background transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="overflow-y-auto p-1.5 custom-scrollbar">
                    {filteredCategories.map(cat => (
                      <div 
                        key={cat} 
                        onClick={() => toggleCategory(cat)}
                        className="px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-foreground/5 transition-colors flex items-center justify-between"
                      >
                        <span className={selectedCategories.includes(cat) ? "font-semibold text-foreground" : "text-foreground/80"}>{cat}</span>
                        {selectedCategories.includes(cat) && <i className="fa-solid fa-check text-[#0c5a53]"></i>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-sm font-semibold text-foreground/90 pl-0.5">Business Address</label>
              <div className="relative">
                <i className="fa-solid fa-location-dot absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30"></i>
                <input 
                  type="text"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  className="w-full pl-10 pr-3.5 h-[46px] bg-foreground/[0.02] hover:bg-foreground/[0.04] border border-foreground/15 rounded-xl focus:bg-background focus:outline-none focus:ring-2 focus:ring-[#0c5a53]/50 focus:border-[#0c5a53] transition-all font-medium text-sm text-foreground"
                  placeholder="Building, Street, City"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-foreground/90 pl-0.5">Alternate Number</label>
              <SearchablePhoneInput
                defaultCountry="AE"
                value={altNumber}
                onChange={(val) => setAltNumber(val || "")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-foreground/90 pl-0.5">Website</label>
              <div className="relative">
                <i className="fa-solid fa-link absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30"></i>
                <input 
                  type="url" 
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full pl-10 pr-3.5 h-[46px] bg-foreground/[0.02] hover:bg-foreground/[0.04] border border-foreground/15 rounded-xl focus:bg-background focus:outline-none focus:ring-2 focus:ring-[#0c5a53]/50 focus:border-[#0c5a53] transition-all font-medium text-sm text-foreground"
                  placeholder="https://www.example.com"
                />
              </div>
            </div>
          </div>
          
          {/* Mobile Save Button (Inside Collapse) */}
          <div className="mt-6 flex lg:!hidden justify-end border-t border-foreground/5 pt-4 pb-1 pr-2">
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-[#1D92EB] hover:bg-[#157dc9] text-white rounded-lg text-[13px] font-bold shadow-md flex items-center gap-2">
              {isSubmitting ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : <><i className="fa-solid fa-check"></i> Save</>}
            </button>
          </div>
          
          </div>
        </div>

      {/* Form Actions (Desktop Only) */}
      <div className="hidden lg:!flex justify-end">
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-[#1D92EB] hover:bg-[#157dc9] text-white rounded-lg text-[13px] font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
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
