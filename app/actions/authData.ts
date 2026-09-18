"use server";

import { cookies } from "next/headers";
import { getAuthData, invalidateUserAuthCache } from "@/lib/user-data";

export async function getClientAuthData(activeLang: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return { isAuthenticated: false };
  }

  try {
    const data = await getAuthData(token, activeLang);
    
    if (data.shouldLogout) {
      invalidateUserAuthCache(token);
      return { isAuthenticated: false, shouldLogout: true };
    }

    return { 
      isAuthenticated: true, 
      token: token, 
      userProfile: data.userProfile, 
      alertsData: data.alertsData, 
      notificationsData: data.notificationsData, 
      aiPredictsData: data.aiPredictsData 
    };
  } catch (error) {
    console.error("Error fetching client auth data:", error);
    return { isAuthenticated: false };
  }
}
