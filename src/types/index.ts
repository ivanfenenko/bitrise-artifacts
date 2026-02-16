export interface App {
  slug: string;
  title: string;
  repo_slug?: string;
}

export interface Build {
  slug?: string;
  build_number?: number;
  branch?: string;
  status_text?: string;
  triggered_at?: string;
  finished_at?: string;
  triggered_by?: string;
  commit_message?: string;
  commit_hash?: string;
  pull_request_id?: number;
  pull_request_target_branch?: string;
  pipeline_id?: string;
  workflow?: string;
}

export interface Artifact {
  slug?: string;
  title?: string;
  artifact_type?: string;
  file_size?: number;
  is_public_page_enabled?: boolean;
  public_install_page_url?: string;
}

export interface Device {
  id: string;
  model: string;
  status: string;
}

export interface Settings {
  api_token: string;
  selected_app_slug?: string;
  watchlist_apps?: App[];
  watchlist_branches?: Record<string, string[]>;
}

export interface GroupedBuilds {
  [branch: string]: Build[];
}