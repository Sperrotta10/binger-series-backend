export function optimizeImageUrl(
  url: string | null,
  size: 'medium' | 'original',
  hostUrl: string,
): string {
  if (!url) {
    return `${hostUrl}/assets/images/poster-placeholder.webp`;
  }
  if (size === 'medium') {
    return url.replace('/original_untouched/', '/medium_portrait/');
  } else {
    return url.replace('/medium_portrait/', '/original_untouched/');
  }
}

export function optimizeBackdropUrl(url: string | null, hostUrl: string): string {
  if (!url) {
    return `${hostUrl}/assets/images/backdrop-placeholder.webp`;
  }
  return url;
}
