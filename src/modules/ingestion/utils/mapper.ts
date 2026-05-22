import { TvmazeShow, TvmazeSeason, TvmazeEpisode } from '../types/tvmaze.types.js';

// Strips HTML tags from a string.
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').trim();
}

// Maps a TVmaze show object to a Prisma Series insert object.
export function mapTvmazeShowToPrisma(show: TvmazeShow) {
  return {
    apiSource: 'tvmaze',
    apiId: show.id.toString(),
    title: show.name || 'Unknown Title',
    originalLanguage: show.language ? show.language.substring(0, 10) : null,
    overview: stripHtml(show.summary),
    posterUrl: show.image?.original || show.image?.medium || null,
    backdropUrl: show.image?.original || null, // TVmaze doesn't have reliable backdrops natively without external IDs, fallback to original poster or null
    status: show.status || null,
    firstAirDate: show.premiered ? new Date(show.premiered) : null,
    genres: Array.isArray(show.genres) ? show.genres : [],
  };
}

// Maps a TVmaze season object to a Prisma Season insert object.
export function mapTvmazeSeasonToPrisma(season: TvmazeSeason, seriesId: string) {
  return {
    seriesId,
    seasonNumber: season.number || 0,
    title: season.name || null,
    overview: stripHtml(season.summary),
    posterUrl: season.image?.original || season.image?.medium || null,
    episodeCount: season.episodeOrder || null,
    airDate: season.premiereDate ? new Date(season.premiereDate) : null,
  };
}

// Maps a TVmaze episode object to a Prisma Episode insert object.
export function mapTvmazeEpisodeToPrisma(episode: TvmazeEpisode, seasonId: string) {
  return {
    seasonId,
    episodeNumber: episode.number || 0,
    title: episode.name || `Episode ${episode.number}`,
    overview: stripHtml(episode.summary),
    airDate: episode.airstamp
      ? new Date(episode.airstamp)
      : episode.airdate
        ? new Date(episode.airdate)
        : null,
    runtime: episode.runtime || 0,
  };
}
