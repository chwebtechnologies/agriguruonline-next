export interface MediaVideoItem {
  id?: string;
  slug: string;
  title: string;
  url: string;
  video_type: string;
  image: string;
  description?: string;
  video_url?: string;
  video_thumbnail?: string;
  thumbnail?: string;
  created_at?: string;
  translations?: Array<{
    lang_code: string;
    title: string;
  }>;
}

export interface MediaVideoResponse {
  success: number;
  message: string;
  data: {
    media_videos: MediaVideoItem[];
    total: number;
  };
  response_time: string;
}

export interface VideoCategory {
  category_name: string;
  category_id: string;
  slug: string;
  image: string;
  count: number;
}

export interface VideoGalleryResponse {
  success: number;
  message: string;
  data: {
    categories: VideoCategory[];
    total_categories: number;
  };
  response_time: string;
}

