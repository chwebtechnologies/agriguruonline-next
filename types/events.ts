export interface EventCategory {
  id: string;
  name: string;
}

export interface EventTranslation {
  lang_code: string;
  title: string;
  location?: string;
  description: string;
  source?: string;
}

export interface EventItem {
  id: string;
  title: string;
  image: string;
  thumbnail: string;
  is_active: boolean;
  slug: string;
  start_date: string;
  end_date: string;
  location?: string;
  created_at: string;
  status: string;
  posting_date?: string;
  translations?: EventTranslation[];
}

export interface EventDetail {
  id: string;
  title: string;
  description: string;
  meta_keywords?: string | null;
  meta_description?: string | null;
  category_ids?: string[];
  image: string;
  thumbnail: string;
  start_date: string;
  end_date: string;
  location?: string;
  status?: string;
  source?: string;
  source_url?: string;
  is_active: boolean;
  slug: string;
  translations?: EventTranslation[];
  created_at?: string;
  posting_date?: string;
  categories?: EventCategory[];
}

export interface EventsResponse {
  success: number;
  message: string;
  data: {
    events: EventItem[];
    total: number;
  };
}

export interface EventDetailResponse {
  success: number;
  message: string;
  data?: EventDetail;
}
