import { useState } from "react";
import { Settings } from "../types";
import { X, Eye, EyeOff, Key, AppWindow } from "lucide-react";

interface SettingsModalProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [token, setToken] = useState(settings.api_token);
  const [showToken, setShowToken] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...settings, api_token: token });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              <div className="flex items-center gap-2">
                <Key size={16} />
                Bitrise API Token
              </div>
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter your Bitrise personal access token"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-primary pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              >
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="mt-2 text-xs text-text-muted">
              Get your token from{" "}
              <a
                href="https://app.bitrise.io/me/profile#/security"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Bitrise Account Settings
              </a>
            </p>
          </div>

          {settings.selected_app_slug && (
            <div className="p-3 bg-background rounded-lg border border-border">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <AppWindow size={16} />
                <span>Current App: {settings.selected_app_slug}</span>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border hover:bg-surface-hover rounded-lg transition-colors text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!token.trim()}
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}