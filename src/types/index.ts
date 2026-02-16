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
  triggered_by?: string;
  commit_message?: string;
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
}

export interface GroupedBuilds {
  [branch: string]: Build[];
}