"use server"

import { userService } from '@/lib/api'

export async function submitContactUsAction(payload: any) {
  try {
    const res = await userService.submitContactUs(payload);
    
    if (res.ok) {
      return { success: true };
    } else {
      const errorData = await res.json().catch(() => null);
      return { success: false, message: errorData?.message || 'Failed to send message' };
    }
  } catch (error: any) {
    console.error('Contact form submission error:', error);
    return { success: false, message: error.message || 'An unexpected error occurred' };
  }
}
