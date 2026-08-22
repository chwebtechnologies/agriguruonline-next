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
