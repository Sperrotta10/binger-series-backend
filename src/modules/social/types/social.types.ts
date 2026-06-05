export interface ToggleResponse {
  action: 'followed' | 'unfollowed' | 'liked' | 'unliked';
  target_user_id?: string;
  review_id?: string;
}

export interface FeedPagination {
  page: number;
  limit: number;
}
