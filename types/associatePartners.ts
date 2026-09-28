export interface AssociatePartner {
  id: string;
  image_type: string;
  image: string;
  url: string;
  title: string;
  is_active: boolean;
  slug: string;
}

export interface AssociatePartnersResponse {
  success: number;
  message: string;
  data: {
    logo: AssociatePartner[];
    total: number;
  };
  response_time: string;
}
