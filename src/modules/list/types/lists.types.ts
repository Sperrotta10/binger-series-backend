export interface CreateListPayload {
  name: string;
  description?: string;
  is_private?: boolean;
}

export interface UpdateListPayload {
  name?: string;
  description?: string;
  is_private?: boolean;
}

export interface ListItemPayload {
  series_id: string;
  position: number;
}

export interface PaginationQuery {
  page: number;
  limit: number;
}
