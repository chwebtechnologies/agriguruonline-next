import { cache } from 'react';
import { getCmsApiUrl } from '@/lib/api-utils';
import { customFetch, customFetchJSON } from './fetcher';
import type { MarketReportsResponse } from '@/types/marketReports';
import type { NewsResponse, NewsArticle } from '@/types/news';
import type { EventsResponse, EventDetail, EventItem } from '@/types/events';
import type { MarketUpdatesResponse, MarketUpdateItem } from '@/types/marketUpdates';
import type { VideoGalleryResponse, VideoCategory } from '@/types/videoGallery';
import type {
  ParticipationCategoriesResponse,
  ParticipationAlbumResponse,
  ParticipationCategory,
} from '@/types/participationGallery';
import type { AssociatePartnersResponse } from '@/types/associatePartners';

export interface CollectionVideoData {
  category: {
    category_name: string;
    translations?: Array<{
      lang_code: string;
      category_name: string;
    }>;
  };
  videos: Array<{
    id: string;
    title: string;
    url?: string;
    video_type?: string;
    image?: string;
    video_url?: string;
    thumbnail?: string;
    video_thumbnail?: string;
    created_at?: string;
    translations?: Array<{
      lang_code: string;
      title: string;
    }>;
  }>;
  total: number;
}

export interface NewsDetail {
  id: string;
  title: string;
  description: string;
  image: string;
  thumbnail: string;
  is_active: boolean;
  slug: string;
  posting_date: string;
  created_at: string;
  source?: string;
  source_url?: string;
  meta_keywords?: string;
  meta_description?: string;
  categories?: Array<{
    id: string;
    name: string;
  }>;
  translations?: import('@/types/news').NewsTranslation[];
}

export const cmsService = {
  /**
   * Market Reports
   */
  getMarketReports: cache(
    async (params: {
      lang: string;
      page: number;
      limit: number;
      search?: string;
      categoryId?: string;
      token?: string;
    }): Promise<MarketReportsResponse | null> => {
      const { lang, page, limit, search, categoryId, token } = params;
      const cmsApiUrl = getCmsApiUrl();
      const url = `${cmsApiUrl}/market-report/?is_active=true`;

      try {
        const res = await customFetch(url, {
          token,
          params: {
            lang_code: lang,
            source: 'web',
            page,
            limit,
            search: search || undefined,
            category_id: categoryId || undefined,
          },
        });

        if (!res.ok) return null;
        const json = await res.json();
        return json;
      } catch (error) {
        console.error('[cmsService.getMarketReports] error:', error);
        return null;
      }
    }
  ),

  /**
   * Latest News List
   */
  getLatestNews: cache(
    async (params: {
      lang: string;
      page: number;
      limit: number;
      search?: string;
      categoryId?: string;
    }): Promise<NewsResponse | null> => {
      const { lang, page, limit, search, categoryId } = params;
      const cmsApiUrl = getCmsApiUrl();
      const url = `${cmsApiUrl}/latestnews?is_active=true`;

      return await customFetchJSON<NewsResponse>(url, {
        params: {
          lang_code: lang,
          source: 'web',
          page,
          limit,
          search: search || undefined,
          category_id: categoryId || undefined,
        },
      });
    }
  ),

  /**
   * Single News Detail
   */
  getNewsDetail: cache(async (slug: string, lang: string): Promise<NewsDetail | null> => {
    const cmsApiUrl = getCmsApiUrl();
    const url = `${cmsApiUrl}/latestnews/${encodeURIComponent(slug)}`;

    try {
      const res = await customFetch(url, {
        params: { lang_code: lang, source: 'web' },
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (json.success && json.data) return json.data;
      return null;
    } catch (error) {
      console.error('[cmsService.getNewsDetail] error:', error);
      return null;
    }
  }),

  /**
   * Other related news
   */
  getOtherNews: cache(
    async (lang: string, categoryId?: string, limit: number = 6): Promise<NewsArticle[]> => {
      const cmsApiUrl = getCmsApiUrl();
      const url = `${cmsApiUrl}/latestnews?is_active=true`;

      try {
        const res = await customFetch(url, {
          params: {
            lang_code: lang,
            source: 'web',
            page: 1,
            limit,
            category_id: categoryId || undefined,
          },
        });
        if (!res.ok) return [];
        const json: NewsResponse = await res.json();
        return json?.data?.news || [];
      } catch (error) {
        console.error('[cmsService.getOtherNews] error:', error);
        return [];
      }
    }
  ),

  /**
   * News list for static params generation
   */
  getAllNewsStaticParams: async (limit: number = 50): Promise<NewsArticle[]> => {
    const cmsApiUrl = getCmsApiUrl();
    const url = `${cmsApiUrl}/latestnews?is_active=true&source=web&page=1&limit=${limit}`;
    const json = await customFetchJSON<NewsResponse>(url);
    return json?.data?.news || [];
  },

  /**
   * Latest Events List
   */
  getLatestEvents: cache(
    async (params: {
      lang: string;
      page: number;
      limit: number;
      search?: string;
      categoryId?: string;
    }): Promise<EventsResponse | null> => {
      const { lang, page, limit, search, categoryId } = params;
      const cmsApiUrl = getCmsApiUrl();
      const url = `${cmsApiUrl}/latestevents?is_active=true`;

      return await customFetchJSON<EventsResponse>(url, {
        params: {
          lang_code: lang,
          source: 'web',
          page,
          limit,
          search: search || undefined,
          category_id: categoryId || undefined,
        },
      });
    }
  ),

  /**
   * Single Event Detail
   */
  getEventDetail: cache(async (slug: string, lang: string): Promise<EventDetail | null> => {
    const cmsApiUrl = getCmsApiUrl();
    const url = `${cmsApiUrl}/latestevents/${encodeURIComponent(slug)}`;

    try {
      const res = await customFetch(url, {
        params: { lang_code: lang, source: 'web' },
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (json.success && json.data) return json.data;
      return null;
    } catch (error) {
      console.error('[cmsService.getEventDetail] error:', error);
      return null;
    }
  }),

  /**
   * Other related events
   */
  getOtherEvents: cache(
    async (lang: string, categoryId?: string, limit: number = 6): Promise<EventItem[]> => {
      const cmsApiUrl = getCmsApiUrl();
      const url = `${cmsApiUrl}/latestevents?is_active=true`;

      try {
        const res = await customFetch(url, {
          params: {
            lang_code: lang,
            source: 'web',
            page: 1,
            limit,
            category_id: categoryId || undefined,
          },
        });
        if (!res.ok) return [];
        const json: EventsResponse = await res.json();
        return json?.data?.events || [];
      } catch (error) {
        console.error('[cmsService.getOtherEvents] error:', error);
        return [];
      }
    }
  ),

  /**
   * Events list for static params generation
   */
  getAllEventsStaticParams: async (limit: number = 50): Promise<EventItem[]> => {
    const cmsApiUrl = getCmsApiUrl();
    const url = `${cmsApiUrl}/latestevents?is_active=true&source=web&page=1&limit=${limit}`;
    const json = await customFetchJSON<EventsResponse>(url);
    return json?.data?.events || [];
  },

  /**
   * Video Categories
   */
  getVideoCategories: cache(async (): Promise<VideoGalleryResponse | null> => {
    const cmsApiUrl = getCmsApiUrl();
    const url = `${cmsApiUrl}/dashboard/categories/video?source=web`;
    return await customFetchJSON<VideoGalleryResponse>(url);
  }),

  /**
   * Collection Videos
   */
  getCollectionVideos: cache(
    async (slug: string, lang: string): Promise<CollectionVideoData | null> => {
      const cmsApiUrl = getCmsApiUrl();
      const url = `${cmsApiUrl}/dashboard/videos/${encodeURIComponent(slug)}?lang_code=${lang}&source=web&page=1&limit=100`;

      try {
        const res = await customFetch(url);
        if (!res.ok) return null;
        const json = await res.json();
        if (json.success && json.data) return json.data;
        return null;
      } catch (error) {
        console.error('[cmsService.getCollectionVideos] error:', error);
        return null;
      }
    }
  ),

  /**
   * Participation Gallery Categories
   */
  getParticipationCategories: cache(
    async (lang: string = 'en', page: number = 1, limit: number = 12): Promise<ParticipationCategoriesResponse | null> => {
      const cmsApiUrl = getCmsApiUrl();
      const url = `${cmsApiUrl}/dashboard/categories/gallery`;
      return await customFetchJSON<ParticipationCategoriesResponse>(url, {
        params: { lang_code: lang, source: 'web', page, limit },
      });
    }
  ),

  /**
   * Participation Gallery Album Details
   */
  getParticipationAlbumDetails: cache(
    async (slug: string, lang: string): Promise<ParticipationAlbumResponse | null> => {
      const cmsApiUrl = getCmsApiUrl();
      const url = `${cmsApiUrl}/dashboard/gallery/${encodeURIComponent(slug)}`;
      return await customFetchJSON<ParticipationAlbumResponse>(url, {
        params: { lang_code: lang, source: 'web' },
      });
    }
  ),

  /**
   * Participation Gallery Static Params
   */
  getAllParticipationCategoriesStaticParams: async (limit: number = 50): Promise<ParticipationCategory[]> => {
    const cmsApiUrl = getCmsApiUrl();
    const url = `${cmsApiUrl}/dashboard/categories/gallery?source=web&page=1&limit=${limit}`;
    const json = await customFetchJSON<ParticipationCategoriesResponse>(url);
    return json?.data?.categories || [];
  },

  /**
   * Market Updates (Flyers)
   */
  getMarketUpdates: cache(
    async (lang: string, page: number, limit: number, search?: string): Promise<MarketUpdatesResponse | null> => {
      const cmsApiUrl = getCmsApiUrl();
      const url = `${cmsApiUrl}/flyer?is_active=true`;
      return await customFetchJSON<MarketUpdatesResponse>(url, {
        params: {
          lang_code: lang,
          source: 'web',
          page,
          limit,
          search: search || undefined,
        },
      });
    }
  ),

  /**
   * Single Market Update Detail
   */
  getMarketUpdateDetail: cache(async (slug: string, lang: string): Promise<MarketUpdateItem | null> => {
    const cmsApiUrl = getCmsApiUrl();
    const url = `${cmsApiUrl}/flyer/${encodeURIComponent(slug)}`;

    try {
      const res = await customFetch(url, {
        params: { lang_code: lang, source: 'web' },
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (json.success && json.data) return json.data;
      return null;
    } catch (error) {
      console.error('[cmsService.getMarketUpdateDetail] error:', error);
      return null;
    }
  }),

  /**
   * Other Market Updates
   */
  getOtherMarketUpdates: cache(
    async (lang: string, limit: number = 6): Promise<MarketUpdateItem[]> => {
      const cmsApiUrl = getCmsApiUrl();
      const url = `${cmsApiUrl}/flyer?is_active=true`;

      try {
        const res = await customFetch(url, {
          params: { lang_code: lang, source: 'web', page: 1, limit },
        });
        if (!res.ok) return [];
        const json: MarketUpdatesResponse = await res.json();
        return json?.data?.flyers || [];
      } catch (error) {
        console.error('[cmsService.getOtherMarketUpdates] error:', error);
        return [];
      }
    }
  ),

  /**
   * Market updates list for static params generation
   */
  getAllMarketUpdatesStaticParams: async (limit: number = 50): Promise<MarketUpdateItem[]> => {
    const cmsApiUrl = getCmsApiUrl();
    const url = `${cmsApiUrl}/flyer?is_active=true&source=web&page=1&limit=${limit}`;
    const json = await customFetchJSON<MarketUpdatesResponse>(url);
    return json?.data?.flyers || [];
  },

  /**
   * Fetch marketing headers for AnnouncementBar
   */
  getMarketingHeaders: cache(async (lang: string = 'en'): Promise<Record<string, unknown>[]> => {
    const cmsApiUrl = getCmsApiUrl();
    const url = `${cmsApiUrl}/marketingheaders/`;
    try {
      const json = await customFetchJSON<Record<string, unknown>>(url, {
        params: { page: 1, limit: 25, is_active: 1, source: 'web', lang_code: lang },
      });
      if (json?.success === 1 && json.data && typeof json.data === 'object' && Array.isArray((json.data as Record<string, unknown>).marketing_headers)) {
        return ((json.data as Record<string, unknown>).marketing_headers as Record<string, unknown>[]).filter((item: Record<string, unknown>) => {
          if (!item.is_active) return false;
          const type = (item.type as string || '').toUpperCase();
          return type === 'WEB' || type === 'ALL';
        });
      }
      return [];
    } catch (err) {
      console.error('[cmsService.getMarketingHeaders] error:', err);
      return [];
    }
  }),
  /**
   * Associate Partners (Logos)
   */
  getAssociatePartners: cache(async (page: number = 1, limit: number = 25): Promise<AssociatePartnersResponse | null> => {
    const cmsApiUrl = getCmsApiUrl();
    const url = `${cmsApiUrl}/logo/`;
    try {
      return await customFetchJSON<AssociatePartnersResponse>(url, {
        params: { page, limit, is_active: 'true', source: 'web' },
      });
    } catch (err) {
      console.error('[cmsService.getAssociatePartners] error:', err);
      return null;
    }
  }),
};
