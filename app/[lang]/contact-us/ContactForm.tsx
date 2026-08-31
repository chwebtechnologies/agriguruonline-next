"use client";

import React, { useState, useEffect } from 'react';
import type { Country } from 'react-phone-number-input';
import SearchableCountrySelect from '@/components/ui/SearchableCountrySelect';
import SearchablePhoneInput from '@/components/ui/SearchablePhoneInput';
import { parsePhoneNumber } from 'react-phone-number-input';
import en from 'react-phone-number-input/locale/en.json';
import { toast } from 'sonner';
import ReCAPTCHA from 'react-google-recaptcha';

export default function ContactForm() {
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

      const res = await fetch('https://user-api.agriguruonline.cloud/contact-us', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

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
    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 flex-1 flex flex-col">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Name */}
        <div className="space-y-1">
          <label htmlFor="name" className="text-[12px] sm:text-[13px] font-bold text-foreground">Name <span className="text-brand-red">*</span></label>
          <input 
            type="text" 
            id="name" 
            name="name" 
            className="w-full h-[46px] px-3.5 bg-foreground/[0.02] hover:bg-foreground/[0.04] border border-foreground/15 rounded-xl text-sm font-medium text-foreground focus:bg-background focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue transition-all placeholder:text-foreground/30"
            placeholder="John Doe"
            required
          />
        </div>
        {/* Country */}
        <div className="space-y-1">
          <label className="text-[12px] sm:text-[13px] font-bold text-foreground">Country <span className="text-brand-red">*</span></label>
          <SearchableCountrySelect 
            value={country} 
            onChange={(val) => setCountry(val || '')} 
            showDialCode={false}
            name="country"
            className="w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Phone */}
        <div className="space-y-1">
          <label className="text-[12px] sm:text-[13px] font-bold text-foreground">Contact No. <span className="text-brand-red">*</span></label>
          <SearchablePhoneInput 
            value={phone} 
            onChange={setPhone} 
            defaultCountry={defaultCountryCode}
            required
          />
        </div>
        {/* Email */}
        <div className="space-y-1">
          <label htmlFor="email" className="text-[12px] sm:text-[13px] font-bold text-foreground">Email Address <span className="text-brand-red">*</span></label>
          <input 
            type="email" 
            id="email" 
            name="email" 
            className="w-full h-[46px] px-3.5 bg-foreground/[0.02] hover:bg-foreground/[0.04] border border-foreground/15 rounded-xl text-sm font-medium text-foreground focus:bg-background focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue transition-all placeholder:text-foreground/30"
            placeholder="john@example.com"
            required
          />
        </div>
      </div>

      {/* Source */}
      <div className="space-y-1">
        <label htmlFor="source" className="text-[12px] sm:text-[13px] font-bold text-foreground">How did you find out about us?</label>
        <input 
          type="text" 
          id="source" 
          name="source" 
          className="w-full h-[46px] px-3.5 bg-foreground/[0.02] hover:bg-foreground/[0.04] border border-foreground/15 rounded-xl text-sm font-medium text-foreground focus:bg-background focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue transition-all placeholder:text-foreground/30"
          placeholder="e.g. Google, Social Media, etc."
        />
      </div>

      {/* Message */}
      <div className="space-y-1 flex-1 flex flex-col">
        <label htmlFor="message" className="text-[12px] sm:text-[13px] font-bold text-foreground">Message <span className="text-brand-red">*</span></label>
        <textarea 
          id="message" 
          name="message" 
          className="w-full flex-1 min-h-[100px] p-3.5 bg-foreground/[0.02] hover:bg-foreground/[0.04] border border-foreground/15 rounded-xl text-sm font-medium text-foreground focus:bg-background focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue transition-all resize-none placeholder:text-foreground/30"
          placeholder="Type your message here..."
          required
        ></textarea>
      </div>

      {/* ReCAPTCHA */}
      <div className="py-2 flex justify-center overflow-hidden">
        <ReCAPTCHA
          ref={recaptchaRef}
          sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"}
          onChange={(token) => setCaptchaToken(token)}
        />
      </div>

      {/* Submit */}
      <div className="pt-2">
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-brand-blue hover:opacity-90 text-white font-bold h-10 rounded-lg flex items-center justify-center gap-2 text-[14px] transition-opacity shadow-xs active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
            <i className="fa-solid fa-circle-notch fa-spin text-[12px]"></i>
          ) : (
            <i className="fa-solid fa-paper-plane text-[12px]"></i>
          )}
          {loading ? 'Sending...' : 'Submit Message'}
        </button>
      </div>
    </form>
  );
}
