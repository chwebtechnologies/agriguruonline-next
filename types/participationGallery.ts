export interface ParticipationCategory {
  category_id: string;
  category_name: string;
  slug: string;
  image: string;
  thumbnail: string;
  count: number;
}

export interface ParticipationCategoriesResponse {
  success: number;
  message: string;
  data: {
    categories: ParticipationCategory[];
    total_categories: number;
  };
  response_time?: string;
}

export interface ParticipationPhotoTranslation {
  lang_code: string;
  title: string;
}

export interface ParticipationPhotoItem {
  id: string;
  slug: string;
  title: string;
  image: string;
  thumbnail: string;
  translations?: ParticipationPhotoTranslation[];
}

export interface ParticipationAlbumCategory {
  id: string;
  category_name: string;
  sequence?: number;
  type?: string;
  is_active?: boolean;
  translations?: Array<{
    lang_code: string;
    category_name: string;
  }>;
}

export interface ParticipationAlbumResponse {
  success: number;
  message: string;
  data: {
    category: ParticipationAlbumCategory;
    images?: ParticipationPhotoItem[];
    galleries?: ParticipationPhotoItem[];
    total: number;
  };
  response_time?: string;
}
