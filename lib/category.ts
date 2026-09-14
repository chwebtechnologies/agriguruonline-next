import { cache } from 'react';
import { tradingService } from '@/lib/api/trading.service';

export interface CategoryTranslation {
  name: string;
  lang_code: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  translations: CategoryTranslation[];
  is_active?: boolean;
  image?: string;
}

export interface CacheConfig {
  apiUrl: string;
  stale: number;
  revalidate: number;
  expire: number;
}

/**
 * Delegated to centralized tradingService with Next.js native fetch deduplication.
 */
export const getCategories = async (lang: string = 'en'): Promise<Category[]> => {
  return await tradingService.getCategories(lang);
};
