export interface BusinessProfile {
  companyName: string;
  industry: string;
  founded: string;
  employees: number;
  headquarters: string;
  description: string;
  services: string[];
  keyClients: string[];
  mission: string;
  values: string[];
  contact: {
    email: string;
    phone: string;
    website: string;
  };
}

export interface MemoryData {
  [key: string]: any;
}

export interface HtmlDocument {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

