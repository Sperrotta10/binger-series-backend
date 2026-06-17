export type ReviewScope = 'SHOW' | 'SEASON' | 'EPISODE';
interface BaseReviewFields {
  rating: number;
  content?: string;
  containsSpoilers: boolean;
}

export interface CreateSeriesReviewData extends BaseReviewFields {
  userId: string;
  seriesId: string;
  scope: ReviewScope;
}

export interface CreateSeasonReviewData extends BaseReviewFields {
  userId: string;
  seriesId: string;
  seasonId: string;
  seasonNumber: number;
  scope: ReviewScope;
}

export interface CreateEpisodeReviewData extends BaseReviewFields {
  userId: string;
  seriesId: string;
  seasonId: string;
  episodeId: string;
  seasonNumber: number;
  episodeNumber: number;
  scope: ReviewScope;
  episodeProgressId?: string | null;
}

export type UpdateReviewData = Partial<BaseReviewFields>;

// ── Reviews (API layer – snake_case) ─────────────────────────────

interface BaseReviewInputFields {
  rating: number;
  content?: string;
  contains_spoilers: boolean;
}

export interface CreateSeriesReviewInput extends BaseReviewInputFields {
  series_id: string;
  scope?: ReviewScope;
}

export interface CreateSeasonReviewInput extends BaseReviewInputFields {
  series_id: string;
  season_id: string;
  season_number: number;
  scope?: ReviewScope;
}

export interface CreateEpisodeReviewInput extends BaseReviewInputFields {
  series_id: string;
  season_id: string;
  episode_id: string;
  season_number: number;
  episode_number: number;
  scope?: ReviewScope;
}

export type UpdateReviewInput = Partial<BaseReviewInputFields>;
