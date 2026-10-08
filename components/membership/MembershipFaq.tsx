'use client';

import React, { useState } from 'react';

interface FaqItem {
  question: string;
  answer: string;
  tag: string;
}

const FAQS: FaqItem[] = [
  {
    tag: 'Trial & Risk-Free Access',
    question: 'How does the 90-day free trial on the Silver plan work?',
    answer:
      'When you activate the Silver tier, you receive 90 consecutive days of unrestricted access to live commodity spot prices, freight analytics, trade inquiries, and price alerts. No credit card, debit card, or banking details are ever required. It is 100% risk-free with zero auto-debits.',
  },
  {
    tag: 'Monthly Limits',
    question: 'How do monthly feature quotas work and when do they reset?',
    answer:
      'All countable quotas—including AI Predictive Analyses, Trade Inquiries, Product Price Alerts, and Favourites—refresh automatically on the 1st day of every calendar month. Unused quotas do not roll over, ensuring a fresh allocation every 30 days.',
  },
  {
    tag: 'Billing & Savings',
    question: 'Can I switch between Monthly and Yearly billing anytime?',
    answer:
      'Yes. You can upgrade, downgrade, or switch between Monthly and Annual billing at any time through your dashboard or with our Trade Support team. Switching to Annual billing instantly unlocks up to 15% savings compared to standard month-to-month pricing.',
  },
  {
    tag: 'Global Payments',
    question: 'What currencies and payment methods do you accept?',
    answer:
      'We support both USD ($) and Indian Rupees (₹). For INR payments, we accept major Credit/Debit Cards, Net Banking, and instant UPI. For international USD transactions, we process major credit cards, SWIFT international wire transfers, and corporate trade accounts with formal tax invoices.',
  },
  {
    tag: 'Trade Support',
    question: 'What is the role of the Dedicated Client Relations Executive?',
    answer:
      'Platinum members are assigned a seasoned Commodity Trade Relations Executive who provides bespoke assistance: fast-tracking bilateral counterparty inquiries, facilitating maritime freight quotations, providing customized market reports, and offering priority WhatsApp trade support.',
  },
  {
    tag: 'Multi-Seat Logins',
    question: 'Can my team access the platform from multiple devices?',
    answer:
      'Yes. The Silver and Gold plans include 2 concurrent authenticated device logins. The Platinum plan includes 4 simultaneous device logins, allowing your trading desk to monitor market intelligence across mobile and desktop simultaneously.',
  },
];

export default function MembershipFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="w-full mt-10 mb-6">
      <div className="text-center mb-6">
        <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
          Frequently Asked Questions
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl mx-auto">
          Clear details on billing, feature quotas, trial access, and multi-desk logins.
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-2.5">
        {FAQS.map((faq, idx) => {
          const isOpen = openIndex === idx;

          return (
            <div
              key={idx}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isOpen
                  ? 'bg-card border-border shadow-sm'
                  : 'bg-card/70 border-border/80 hover:border-border'
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                aria-expanded={isOpen}
                className="w-full p-4 text-left flex items-start sm:items-center justify-between gap-4 cursor-pointer"
              >
                <div className="flex-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-0.5">
                    {faq.tag}
                  </span>
                  <span className="font-bold text-sm sm:text-base text-foreground leading-snug">
                    {faq.question}
                  </span>
                </div>

                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
                    isOpen
                      ? 'rotate-180 bg-foreground text-background'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <i className="fa-solid fa-chevron-down text-[10px]"></i>
                </span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/50 animate-in fade-in duration-200">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
