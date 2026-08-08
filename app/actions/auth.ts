"use server";

import disposableDomains from "disposable-email-domains";

export async function validateEmailDomain(email: string): Promise<{ isValid: boolean; error?: string }> {
  const domain = email.split("@")[1]?.toLowerCase();
  
  if (!domain) {
    return { isValid: false, error: "Invalid email format." };
  }
  
  if (disposableDomains.includes(domain)) {
    return { isValid: false, error: "Temporary or disposable emails are not allowed." };
  }
  
  return { isValid: true };
}
