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
 * Delegated to centralized tradingService with React cache deduplication.
 */
export const getCategories = cache(async (lang: string = 'en', _config?: Partial<CacheConfig>): Promise<Category[]> => {
  return await tradingService.getCategories(lang);
});
