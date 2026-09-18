"use client";

import { useState, useEffect } from "react";
import { HeaderGuest } from "./HeaderGuest";
import { HeaderAuth } from "./HeaderAuth";
import { getClientAuthData } from "@/app/actions/authData";
import { SearchProduct } from "@/types/search";

interface ClientHeaderWrapperProps {
  dict: any;
  activeLang: string;
  categories: Array<{ name: string; href: string }>;
  initialSearchProducts: SearchProduct[];
}

export function ClientHeaderWrapper({
  dict,
  activeLang,
  categories,
  initialSearchProducts,
}: ClientHeaderWrapperProps) {
  const [authState, setAuthState] = useState<any>({
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Check if user info cookie exists to avoid unnecessary server calls
    if (document.cookie.includes("user_info=")) {
      getClientAuthData(activeLang).then((data) => {
        setAuthState({ isLoading: false, ...data });
      });
    } else {
      setAuthState({ isLoading: false, isAuthenticated: false });
    }
  }, [activeLang]);

  // While checking auth state, or if not authenticated, render the static guest header.
  if (authState.isLoading || !authState.isAuthenticated) {
    return (
      <HeaderGuest
        dict={dict}
        activeLang={activeLang}
        categories={categories}
        initialSearchProducts={initialSearchProducts}
      />
    );
  }

  return (
    <HeaderAuth
      token={authState.token}
      dict={dict}
      activeLang={activeLang}
      categories={categories}
      profile={authState.userProfile}
      alerts={authState.alertsData}
      notifications={authState.notificationsData}
      aiPredicts={authState.aiPredictsData}
      initialSearchProducts={initialSearchProducts}
    />
  );
}
