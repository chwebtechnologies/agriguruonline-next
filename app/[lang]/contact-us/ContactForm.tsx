"use client";

import React, { useState, useEffect } from 'react';
import type { Country } from 'react-phone-number-input';
import SearchableCountrySelect from '@/components/ui/SearchableCountrySelect';
import SearchablePhoneInput from '@/components/ui/SearchablePhoneInput';
import { parsePhoneNumber } from 'react-phone-number-input';
import en from 'react-phone-number-input/locale/en.json';
import { toast } from 'sonner';
import ReCAPTCHA from 'react-google-recaptcha';
import { submitContactUsAction } from '@/app/actions/contact';

interface ContactFormProps {
  contactDict?: any;
  defaultCountry?: string;
}

export default function ContactForm({ contactDict = {}, defaultCountry = 'IN' }: ContactFormProps) {
  const [country, setCountry] = useState<string>(defaultCountry);
  const [phone, setPhone] = useState<string>('');
  const [defaultCountryCode, setDefaultCountryCode] = useState<Country>(defaultCountry as Country);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const recaptchaRef = React.useRef<ReCAPTCHA>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const source = formData.get('source') as string;
    const message = formData.get('message') as string;

    let hasErrors = false;
    const newErrors: Record<string, string> = {};

    if (!name || !name.trim()) {
      newErrors.name = contactDict.name_required || 'Name is required.';
      hasErrors = true;
    }
    if (!country) {
      newErrors.country = contactDict.country_required || 'Country is required.';
      hasErrors = true;
    }
    if (!phone) {
      newErrors.phone = contactDict.phone_required || 'Contact No. is required.';
      hasErrors = true;
    }
    if (!email || !email.trim()) {
      newErrors.email = contactDict.email_required || 'Email Address is required.';
      hasErrors = true;
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      newErrors.email = contactDict.email_invalid || 'Invalid email address.';
      hasErrors = true;
    }
    if (!message || !message.trim()) {
      newErrors.message = contactDict.message_required || 'Message is required.';
      hasErrors = true;
    }

    if (hasErrors) {
      setErrors(newErrors);
      return;
    }
    
    setErrors({});

    if (!captchaToken) {
      toast.error('Please verify that you are not a robot.');
      return;
    }

    setLoading(true);
    try {

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

      const res = await submitContactUsAction(payload);

      if (res.success) {
        toast.success('Your message has been sent successfully!');
        e.currentTarget.reset();
        setPhone('');
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      } else {
        toast.error(res.message || 'Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Submission error:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5 flex-1 flex flex-col">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {/* Name */}
        <div className="space-y-1.5">
          <label htmlFor="name" className={`text-[13px] sm:text-[14px] font-bold ${errors.name ? 'text-brand-red' : 'text-foreground'}`}>{contactDict.name || "Name"} <span className="text-brand-red">*</span></label>
          <div className="relative group">
            <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${errors.name ? 'text-brand-red' : 'text-muted-foreground group-focus-within:text-brand-blue'}`}>
              <i className="fa-regular fa-user text-[14px]"></i>
            </div>
            <input 
              type="text" 
              id="name" 
              name="name" 
              onChange={() => { if (errors.name) setErrors(prev => ({ ...prev, name: '' })) }}
              className={`w-full h-12 pl-10 pr-4 bg-background border ${errors.name ? 'border-brand-red text-brand-red focus:border-brand-red focus:ring-brand-red/20' : 'border-border/80 hover:border-border focus:ring-brand-blue/20 focus:border-brand-blue'} rounded-xl text-sm font-medium transition-all shadow-sm ${errors.name ? 'placeholder:text-brand-red/50 text-brand-red focus:bg-background' : 'text-foreground focus:bg-background placeholder:text-muted-foreground/50'}`}
              placeholder="John Doe"
            />
          </div>
          {errors.name && <p className="text-brand-red text-xs mt-1 ml-1 font-medium">{errors.name}</p>}
        </div>
        {/* Country */}
        <div className="space-y-1.5">
          <label className={`text-[13px] sm:text-[14px] font-bold ${errors.country ? 'text-brand-red' : 'text-foreground'}`}>{contactDict.country || "Country"} <span className="text-brand-red">*</span></label>
          <div className={errors.country ? 'border border-brand-red rounded-xl focus-within:ring-2 focus-within:ring-brand-red/20' : ''}>
            <SearchableCountrySelect 
              value={country} 
              onChange={(val) => {
                setCountry(val || '');
                if (errors.country) setErrors(prev => ({ ...prev, country: '' }));
              }} 
              showDialCode={false}
              name="country"
              className="w-full"
            />
          </div>
          {errors.country && <p className="text-brand-red text-xs mt-1 ml-1 font-medium">{errors.country}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {/* Phone */}
        <div className="space-y-1.5">
          <label className={`text-[13px] sm:text-[14px] font-bold ${errors.phone ? 'text-brand-red' : 'text-foreground'}`}>{contactDict.contact_no || "Contact No."} <span className="text-brand-red">*</span></label>
          <div className={errors.phone ? 'border border-brand-red rounded-xl focus-within:ring-2 focus-within:ring-brand-red/20' : ''}>
            <SearchablePhoneInput 
              value={phone} 
              onChange={(val) => {
                setPhone(val);
                if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
              }} 
              defaultCountry={defaultCountryCode}
            />
          </div>
          {errors.phone && <p className="text-brand-red text-xs mt-1 ml-1 font-medium">{errors.phone}</p>}
        </div>
        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className={`text-[13px] sm:text-[14px] font-bold ${errors.email ? 'text-brand-red' : 'text-foreground'}`}>{contactDict.email || "Email Address"} <span className="text-brand-red">*</span></label>
          <div className="relative group">
            <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${errors.email ? 'text-brand-red' : 'text-muted-foreground group-focus-within:text-brand-blue'}`}>
              <i className="fa-regular fa-envelope text-[14px]"></i>
            </div>
            <input 
              type="email" 
              id="email" 
              name="email" 
              onChange={() => { if (errors.email) setErrors(prev => ({ ...prev, email: '' })) }}
              className={`w-full h-12 pl-10 pr-4 bg-background border ${errors.email ? 'border-brand-red text-brand-red focus:border-brand-red focus:ring-brand-red/20' : 'border-border/80 hover:border-border focus:ring-brand-blue/20 focus:border-brand-blue'} rounded-xl text-sm font-medium transition-all shadow-sm ${errors.email ? 'placeholder:text-brand-red/50 text-brand-red focus:bg-background' : 'text-foreground focus:bg-background placeholder:text-muted-foreground/50'}`}
              placeholder="john@example.com"
            />
          </div>
          {errors.email && <p className="text-brand-red text-xs mt-1 ml-1 font-medium">{errors.email}</p>}
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
        <label htmlFor="message" className={`text-[13px] sm:text-[14px] font-bold ${errors.message ? 'text-brand-red' : 'text-foreground'}`}>{contactDict.message || "Message"} <span className="text-brand-red">*</span></label>
        <textarea 
          id="message" 
          name="message" 
          onChange={() => { if (errors.message) setErrors(prev => ({ ...prev, message: '' })) }}
          className={`w-full flex-1 min-h-[120px] p-4 bg-background border ${errors.message ? 'border-brand-red text-brand-red focus:border-brand-red focus:ring-brand-red/20' : 'border-border/80 hover:border-border focus:ring-brand-blue/20 focus:border-brand-blue'} rounded-xl text-sm font-medium transition-all shadow-sm resize-none ${errors.message ? 'placeholder:text-brand-red/50 text-brand-red focus:bg-background' : 'text-foreground focus:bg-background placeholder:text-muted-foreground/50'}`}
          placeholder="Type your message here..."
        ></textarea>
        {errors.message && <p className="text-brand-red text-xs mt-1 ml-1 font-medium">{errors.message}</p>}
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
