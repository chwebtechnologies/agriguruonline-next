"use client";

import React, { useState, useEffect } from 'react';
import type { Country } from 'react-phone-number-input';
import SearchableCountrySelect from '@/components/ui/SearchableCountrySelect';
import SearchablePhoneInput from '@/components/ui/SearchablePhoneInput';
import { parsePhoneNumber } from 'react-phone-number-input';
import en from 'react-phone-number-input/locale/en.json';
import { toast } from 'sonner';
import ReCAPTCHA from 'react-google-recaptcha';
import { userService } from '@/lib/api';

interface ContactFormProps {
  contactDict?: any;
}

export default function ContactForm({ contactDict = {} }: ContactFormProps) {
  const [country, setCountry] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [defaultCountryCode, setDefaultCountryCode] = useState<Country>('IN');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const recaptchaRef = React.useRef<ReCAPTCHA>(null);

  useEffect(() => {
    const fetchCountry = async () => {
      try {
        const response = await fetch('https://get.geojs.io/v1/ip/country.json');
        if (response.ok) {
          const data = await response.json();
          if (data.country) {
            setCountry(data.country);
            setDefaultCountryCode(data.country as Country);
          }
        }
      } catch (error) {
        console.error('Failed to fetch country from IP', error);
      }
    };
    
    fetchCountry();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!country || !phone) {
      toast.error('Please complete all required fields.');
      return;
    }

    if (!captchaToken) {
      toast.error('Please verify that you are not a robot.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      const name = formData.get('name') as string;
      const email = formData.get('email') as string;
      const source = formData.get('source') as string;
      const message = formData.get('message') as string;

      // Split name into first and last name
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '.';

      // Get full country name from code
      const countryName = (en as Record<string, string>)[country] || country;

      // Extract phone parts
      let countryCodeStr = '';
      let mobileNoStr = phone;
      try {
        const parsed = parsePhoneNumber(phone);
        if (parsed) {
          countryCodeStr = `+${parsed.countryCallingCode}`;
          mobileNoStr = parsed.nationalNumber;
        }
      } catch (err) {}

      const payload = {
        first_name: firstName,
        last_name: lastName,
        country: countryName,
        mobile_no: mobileNoStr,
        email,
        source,
        message,
        country_code: countryCodeStr,
        captcha_token: captchaToken
      };

      const res = await userService.submitContactUs(payload);

      if (res.ok) {
        toast.success('Your message has been sent successfully!');
        e.currentTarget.reset();
        setPhone('');
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      } else {
        const errorData = await res.json().catch(() => null);
        toast.error(errorData?.message || 'Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Submission error:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 flex-1 flex flex-col">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {/* Name */}
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-[13px] sm:text-[14px] font-bold text-foreground">{contactDict.name || "Name"} <span className="text-brand-red">*</span></label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-brand-blue transition-colors">
              <i className="fa-regular fa-user text-[14px]"></i>
            </div>
            <input 
              type="text" 
              id="name" 
              name="name" 
              className="w-full h-12 pl-10 pr-4 bg-background border border-border/80 hover:border-border rounded-xl text-sm font-medium text-foreground focus:bg-background focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all shadow-sm placeholder:text-muted-foreground/50"
              placeholder="John Doe"
              required
            />
          </div>
        </div>
        {/* Country */}
        <div className="space-y-1.5">
          <label className="text-[13px] sm:text-[14px] font-bold text-foreground">{contactDict.country || "Country"} <span className="text-brand-red">*</span></label>
          <SearchableCountrySelect 
            value={country} 
            onChange={(val) => setCountry(val || '')} 
            showDialCode={false}
            name="country"
            className="w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {/* Phone */}
        <div className="space-y-1.5">
          <label className="text-[13px] sm:text-[14px] font-bold text-foreground">{contactDict.contact_no || "Contact No."} <span className="text-brand-red">*</span></label>
          <SearchablePhoneInput 
            value={phone} 
            onChange={setPhone} 
            defaultCountry={defaultCountryCode}
            required
          />
        </div>
        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-[13px] sm:text-[14px] font-bold text-foreground">{contactDict.email || "Email Address"} <span className="text-brand-red">*</span></label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-brand-blue transition-colors">
              <i className="fa-regular fa-envelope text-[14px]"></i>
            </div>
            <input 
              type="email" 
              id="email" 
              name="email" 
              className="w-full h-12 pl-10 pr-4 bg-background border border-border/80 hover:border-border rounded-xl text-sm font-medium text-foreground focus:bg-background focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all shadow-sm placeholder:text-muted-foreground/50"
              placeholder="john@example.com"
              required
            />
          </div>
        </div>
      </div>

      {/* Source */}
      <div className="space-y-1.5">
        <label htmlFor="source" className="text-[13px] sm:text-[14px] font-bold text-foreground">{contactDict.source || "How did you find out about us?"}</label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-brand-blue transition-colors">
            <i className="fa-solid fa-magnifying-glass text-[14px]"></i>
          </div>
          <input 
            type="text" 
            id="source" 
            name="source" 
            className="w-full h-12 pl-10 pr-4 bg-background border border-border/80 hover:border-border rounded-xl text-sm font-medium text-foreground focus:bg-background focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all shadow-sm placeholder:text-muted-foreground/50"
            placeholder="e.g. Google, Social Media, etc."
          />
        </div>
      </div>

      {/* Message */}
      <div className="space-y-1.5 flex-1 flex flex-col">
        <label htmlFor="message" className="text-[13px] sm:text-[14px] font-bold text-foreground">{contactDict.message || "Message"} <span className="text-brand-red">*</span></label>
        <textarea 
          id="message" 
          name="message" 
          className="w-full flex-1 min-h-[120px] p-4 bg-background border border-border/80 hover:border-border rounded-xl text-sm font-medium text-foreground focus:bg-background focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all shadow-sm resize-none placeholder:text-muted-foreground/50"
          placeholder="Type your message here..."
          required
        ></textarea>
      </div>

      {/* ReCAPTCHA */}
      <div className="py-3 flex justify-center overflow-hidden">
        <div className="bg-card p-2 rounded-xl shadow-sm border border-border/50">
          <ReCAPTCHA
            ref={recaptchaRef}
            sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"}
            onChange={(token) => setCaptchaToken(token)}
            theme="light"
          />
        </div>
      </div>

      {/* Submit */}
      <div className="pt-2">
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-brand-blue hover:bg-brand-blue-hover text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2.5 text-[15px] transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden"
        >
          {loading ? (
            <i className="fa-solid fa-circle-notch fa-spin text-[14px]"></i>
          ) : (
            <i className="fa-solid fa-paper-plane text-[14px] group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"></i>
          )}
          {loading ? (contactDict.sending || 'Sending...') : (contactDict.send_message || 'Send Message')}
          
          {/* Shine effect */}
          <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-button-shine" />
        </button>
      </div>
    </form>
  );
}
