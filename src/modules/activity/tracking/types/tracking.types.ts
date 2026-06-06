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
