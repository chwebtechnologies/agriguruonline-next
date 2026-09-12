import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import ContactForm from './ContactForm'
import { getDictionary } from '@/app/[lang]/dictionaries'

import { getStandardMetadata, getSafeLanguage } from '@/lib/seo'

export async function generateMetadata(props: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const params = await props.params
  const lang = getSafeLanguage(params?.lang)

  return getStandardMetadata({
    pageKey: 'contact',
    pathname: 'contact-us',
    lang,
  })
}

export const revalidate = 3600;

export default async function ContactUsPage(props: { params: Promise<{ lang: string }> }) {
  const params = await props.params;
  const lang = params.lang || 'en'
  
  const dict = await getDictionary(lang);
  const commonDict = (dict as Record<string, any>).common || {};
  const backText = commonDict.back || "Back";
  const contactDict = (dict as Record<string, any>).contact || {};

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={contactDict.title || "Contact Us"} backText={backText} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
            
            {/* Left Column: Office Info & Locations */}
            <div className="lg:col-span-5 flex flex-col gap-3 sm:gap-4">
              
              {/* Headquarters Card */}
              <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue shrink-0">
                    <i className="fa-solid fa-building text-lg"></i>
                  </div>
                  <div>
                    <h2 className="text-[16px] sm:text-[18px] font-bold text-foreground leading-tight">{contactDict.hq_title || "India Office (Headquarters)"}</h2>
                    <p className="text-[13px] sm:text-[14px] font-semibold text-muted-foreground mt-0.5">{contactDict.hq_subtitle || "AgriGuru Online Trade Pvt. Ltd."}</p>
                  </div>
                </div>
                
                <p className="text-[13px] sm:text-[15px] text-foreground/80 leading-relaxed mb-4">
                  {contactDict.hq_address || "Block: A, Office No 503 & 1107, Mondeal Height, SG Highway, Jivraj Park, Ahmedabad - 380051, Gujarat, India."}
                </p>

                <div className="flex flex-col gap-2.5 pt-3 border-t border-border mt-auto">
                  <a href="mailto:Contact@agriguruonline.com" className="group flex items-center gap-3 text-[13px] sm:text-[14px] font-semibold text-foreground hover:text-brand-blue transition-all">
                    <div className="w-8 h-8 rounded-xl border border-border/80 bg-background flex items-center justify-center shrink-0 group-hover:bg-brand-blue group-hover:border-brand-blue group-hover:text-white transition-all shadow-sm">
                      <i className="fa-solid fa-envelope text-muted-foreground group-hover:text-white transition-colors"></i>
                    </div>
                    Contact@agriguruonline.com
                  </a>
                  <a href="tel:+918980131000" className="group flex items-center gap-3 text-[13px] sm:text-[14px] font-semibold text-foreground hover:text-brand-blue transition-all" dir="ltr">
                    <div className="w-8 h-8 rounded-xl border border-border/80 bg-background flex items-center justify-center shrink-0 group-hover:bg-brand-blue group-hover:border-brand-blue group-hover:text-white transition-all shadow-sm">
                      <i className="fa-solid fa-phone text-muted-foreground group-hover:text-white transition-colors"></i>
                    </div>
                    +91 8980131000
                  </a>
                  <a href="https://www.agriguruonline.com" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 text-[13px] sm:text-[14px] font-semibold text-foreground hover:text-brand-blue transition-all">
                    <div className="w-8 h-8 rounded-xl border border-border/80 bg-background flex items-center justify-center shrink-0 group-hover:bg-brand-blue group-hover:border-brand-blue group-hover:text-white transition-all shadow-sm">
                      <i className="fa-solid fa-globe text-muted-foreground group-hover:text-white transition-colors"></i>
                    </div>
                    www.agriguruonline.com
                  </a>
                </div>
              </div>

              {/* Global Footprint */}
              <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <i className="fa-solid fa-earth-americas text-brand-blue"></i>
                  <h2 className="text-[15px] sm:text-[17px] font-bold text-foreground">{contactDict.locations_title || "We Operate in 7 Locations Worldwide Network."}</h2>
                </div>
                
                {/* Actual Interactive Map */}
                <div className="w-full h-[280px] sm:h-[310px] rounded-xl overflow-hidden border border-border mt-auto shadow-xs bg-muted">
                  <iframe
                    src="/contact-map.html"
                    className="w-full h-full border-0 block"
                    title={contactDict.locations_title || "We Operate in 7 Locations Worldwide Network"}
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Contact Form */}
            <div className="lg:col-span-7">
              <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-xs h-full flex flex-col">
                <div className="mb-4 sm:mb-5">
                  <h2 className="text-[18px] sm:text-[20px] font-bold text-foreground mb-1">{contactDict.form_title || "Send us a Message"}</h2>
                  <p className="text-[13px] sm:text-[14px] text-muted-foreground">{contactDict.form_subtitle || "Fill out the form below to get in touch with our team."}</p>
                </div>

                <ContactForm contactDict={contactDict} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}