export interface NewsTranslation {
  lang_code: string;
  title: string;
  source: string;
  description: string;
}

export interface NewsArticle {
  id: string;
  image: string;
  thumbnail: string;
  is_active: boolean;
  slug: string;
  title: string;
  description: string;
  source?: string;
  posting_date: string;
  created_at: string;
  translations?: NewsTranslation[];
}

export interface NewsResponse {
  success: number;
  message: string;
  data: {
    news: NewsArticle[];
    total: number;
  };
}
