import { userService, UserProfileResult, AuthDataResult, invalidateUserAuthCache } from '@/lib/api/user.service';

export type { UserProfileResult, AuthDataResult };

export const getUserProfile = userService.getUserProfile;
export const getUserAlerts = userService.getUserAlerts;
export const getUserNotifications = userService.getUserNotifications;
export const getUserAiPredicts = userService.getUserAiPredicts;
export const getAuthData = userService.getAuthData;
export { invalidateUserAuthCache };
