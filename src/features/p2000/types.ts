/**
 * P2000 Feature Types
 */

export interface P2000Message {
  id: string;
  timestamp: Date;
  region: string;
  service: 'brandweer' | 'ambulance' | 'politie' | 'knm' | 'ghor';
  priority: number;
  description: string;
  location?: {
    address?: string;
    city?: string;
    coordinates?: { lat: number; lon: number };
  };
}

export interface P2000Subscription {
  chatId: string;
  enabled: boolean;
  regions: string[];
  filters: P2000Filter[];
}

export interface P2000Filter {
  service?: string;
  priority?: number;
  keyword?: string;
}

export interface P2000ScraperOptions {
  regions?: string[];
  limit?: number;
  /** Filter by service types */
  services?: P2000Message['service'][];
  /** Filter by minimum priority (lower = higher priority) */
  maxPriority?: number;
}
