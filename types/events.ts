export interface EventItem {
  id: string;
  title: string;
  image: string;
  thumbnail: string;
  is_active: boolean;
  slug: string;
  start_date: string;
  end_date: string;
  created_at: string;
  status: string;
}

export interface EventsResponse {
  success: number;
  message: string;
  data: {
    events: EventItem[];
    total: number;
  };
}
