"use server";

import { cookies } from "next/headers";
import { getAuthData, invalidateUserAuthCache } from "@/lib/user-data";
import { getValidAuthToken } from "@/lib/auth-token";

export async function getClientAuthData(activeLang: string) {
  const token = await getValidAuthToken();
  const cookieStore = await cookies();

  if (!token) {
    return { isAuthenticated: false };
  }

  try {
    const data = await getAuthData(token, activeLang);
    
    let userProfile = data?.userProfile;
    if (!userProfile) {
      try {
        const userInfoStr = cookieStore.get('user_info')?.value;
        if (userInfoStr) {
          userProfile = JSON.parse(userInfoStr);
        }
      } catch (e) {}
    }

    return { 
      isAuthenticated: true, 
      token: token, 
      userProfile: userProfile || null, 
      alertsData: data?.alertsData || [], 
      notificationsData: data?.notificationsData || [], 
      aiPredictsData: data?.aiPredictsData || [] 
    };
  } catch (error) {
    console.error("Error fetching client auth data:", error);
    let fallbackProfile = null;
    try {
      const userInfoStr = cookieStore.get('user_info')?.value;
      if (userInfoStr) {
        fallbackProfile = JSON.parse(userInfoStr);
      }
    } catch (e) {}
    return { 
      isAuthenticated: true, 
      token: token, 
      userProfile: fallbackProfile, 
      alertsData: [], 
      notificationsData: [], 
      aiPredictsData: [] 
    };
  }
}
