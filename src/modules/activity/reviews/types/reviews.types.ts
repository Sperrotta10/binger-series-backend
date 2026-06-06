interface BaseReviewFields {
  rating: number;
  content?: string;
  containsSpoilers: boolean;
}

export interface CreateSeriesReviewData extends BaseReviewFields {
  userId: string;
  seriesId: string;
}

export interface CreateSeasonReviewData extends BaseReviewFields {
  userId: string;
  seriesId: string;
  seasonId: string;
}

export interface CreateEpisodeReviewData extends BaseReviewFields {
  userId: string;
  seriesId: string;
  seasonId: string;
  episodeId: string;
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
}

export interface CreateSeasonReviewInput extends BaseReviewInputFields {
  series_id: string;
  season_id: string;
}

export interface CreateEpisodeReviewInput extends BaseReviewInputFields {
  series_id: string;
  season_id: string;
  episode_id: string;
}

export type UpdateReviewInput = Partial<BaseReviewInputFields>;
