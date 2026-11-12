export interface AuthorDetail {
  id: string;
  name: string;
  short_description: string;
  long_description: string;
  image: string;
  thumbnail: string;
  slug: string;
}

export interface AuthorResponse {
  success: number;
  message: string;
  data: AuthorDetail;
  response_time?: string;
}

export interface AuthorNewsArticle {
  slug: string;
  title: string;
  image: string;
  thumbnail: string;
  posting_date: string;
  created_at: string;
}

export interface AuthorNewsData {
  news: AuthorNewsArticle[];
  total: number;
}

export interface AuthorNewsResponse {
  success: number;
  message: string;
  data: AuthorNewsData;
  response_time?: string;
}

