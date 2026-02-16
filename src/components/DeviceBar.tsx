import { useState, useEffect } from "react";
import { Device } from "../types";
import { api } from "../api";
import { Smartphone, RefreshCw, Loader2 } from "lucide-react";

export function DeviceBar() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDevices = async () => {
    try {
      const deviceList = await api.getConnectedDevices();
      setDevices(deviceList);
    } catch (err) {
      console.error("Failed to fetch devices", err);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await fetchDevices();
    setLoading(false);
  };

  return (
    <div className="h-12 bg-surface border-t border-border flex items-center px-4 relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <Smartphone size={18} />
        <span>
          {devices.length === 0 
            ? "No devices connected" 
            : `${devices.length} device${devices.length > 1 ? 's' : ''} connected`
          }
        </span>
      </button>

      <button
        onClick={handleRefresh}
        disabled={loading}
        className="ml-4 p-1.5 hover:bg-surface-hover rounded-lg transition-colors"
        title="Refresh devices"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin text-text-muted" />
        ) : (
          <RefreshCw size={16} className="text-text-muted" />
        )}
      </button>

      {expanded && (
        <div className="absolute bottom-full left-4 mb-2 w-[420px] bg-surface border border-border rounded-lg shadow-xl z-50">
          {devices.length === 0 ? (
            <div className="p-3 text-xs text-text-muted">No devices connected</div>
          ) : (
            <div className="p-2 space-y-2">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 bg-background rounded-md border border-border"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 bg-success rounded-full shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs text-text-secondary truncate">
                        {device.manufacturer ? `${device.manufacturer} ` : ""}{device.model}
                      </div>
                      <div className="text-[10px] text-text-muted truncate">{device.id}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {device.is_emulator != null && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover text-text-muted">
                        {device.is_emulator ? "Emulator" : "Device"}
                      </span>
                    )}
                    {device.api_level && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover text-text-muted">
                        API {device.api_level}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
