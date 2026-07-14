export interface GameSearchResult {
  providerId: string;
  providerName: string;
  title: string;
  releaseDate?: string;
  confidence: number;
}

export interface GameMetadata {
  title: string;
  description?: string;
  developer?: string;
  publisher?: string;
  releaseDate?: string;
  genres: string[];
  platforms: string[];
  rating?: number;
  metacriticScore?: number;
  coverUrl?: string;
  heroUrl?: string;
  logoUrl?: string;
  screenshotUrls: string[];
  providerIds: {
    igdb?: number;
    rawg?: number;
    steam?: number;
  };
}

export interface MetadataProvider {
  name: string;
  priority: number;

  search(query: string): Promise<GameSearchResult[]>;
  getMetadata(providerId: string): Promise<GameMetadata | null>;
  isAvailable(): Promise<boolean>;
}
