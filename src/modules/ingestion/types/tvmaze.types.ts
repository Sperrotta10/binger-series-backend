export interface TvmazeImage {
  medium: string;
  original: string;
}

export interface TvmazeCountry {
  name: string;
  code: string;
  timezone: string;
}

export interface TvmazeNetwork {
  id: number;
  name: string;
  country: TvmazeCountry | null;
  officialSite: string | null;
}

export interface TvmazeWebChannel {
  id: number;
  name: string;
  country: TvmazeCountry | null;
  officialSite: string | null;
}

export interface TvmazeEpisode {
  id: number;
  url: string;
  name: string;
  season: number;
  number: number;
  type: string;
  airdate: string;
  airtime: string;
  airstamp: string;
  runtime: number;
  rating: { average: number | null };
  image: TvmazeImage | null;
  summary: string | null;
}

export interface TvmazeSeason {
  id: number;
  url: string;
  number: number;
  name: string | null;
  episodeOrder: number | null;
  premiereDate: string | null;
  endDate: string | null;
  network: TvmazeNetwork | null;
  webChannel: TvmazeWebChannel | null;
  image: TvmazeImage | null;
  summary: string | null;
}

export interface TvmazeShow {
  id: number;
  url: string;
  name: string;
  type: string;
  language: string;
  genres: string[];
  status: string;
  runtime: number;
  averageRuntime: number;
  premiered: string | null;
  ended: string | null;
  officialSite: string | null;
  schedule: { time: string; days: string[] };
  rating: { average: number | null };
  weight: number;
  network: TvmazeNetwork | null;
  webChannel: TvmazeWebChannel | null;
  dvdCountry: TvmazeCountry | null;
  externals: { tvrage: number | null; thetvdb: number | null; imdb: string | null };
  image: TvmazeImage | null;
  summary: string | null;
  updated: number;
  _embedded?: {
    seasons?: TvmazeSeason[];
    episodes?: TvmazeEpisode[];
  };
}
