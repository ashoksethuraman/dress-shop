export interface ContactInfo {
  tradeName: string;
  brandName: string;
  address: string;
  phone: string;
  email: string;
  operatingHours: string;
  mapUrl: string;
  socialMedia: {
    facebook: string;
    instagram: string;
    youtube: string;
    whatsapp: string;
  };
}

export interface SiteConfig {
  bannerImage: string | null;
  contactInfo: ContactInfo | null;
}
