// ── Progress ─────────────────────────────────────────────────────

export interface CreateProgressData {
  userId: string;
  episodeId: string;
  seasonId: string;
  seriesId: string;
  watchedAt: Date;
  isWatched: boolean;
}

export interface UpdateProgressData {
  rewatchCount?: { increment: number } | number;
  watchedAt?: Date;
}

// ── Reviews (DB layer – camelCase) ───────────────────────────────

interface BaseReviewFields {
  rating: number;
  content?: string;
  containsSpoilers: boolean;
}

export interface CreateReviewData extends BaseReviewFields {
  userId: string;
  seriesId: string;
  seasonId?: string | null;
}

export type UpdateReviewData = Partial<BaseReviewFields>;

// ── Reviews (API layer – snake_case) ─────────────────────────────

interface BaseReviewInputFields {
  rating: number;
  content?: string;
  contains_spoilers: boolean;
}

export interface CreateReviewInput extends BaseReviewInputFields {
  series_id: string;
  season_id?: string | null;
}

export type UpdateReviewInput = Partial<BaseReviewInputFields>;
