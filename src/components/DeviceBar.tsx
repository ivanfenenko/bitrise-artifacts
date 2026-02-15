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
    <div className="h-12 bg-surface border-t border-border flex items-center px-4">
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

      {expanded && devices.length > 0 && (
        <div className="ml-4 flex items-center gap-4">
          {devices.map((device) => (
            <div
              key={device.id}
              className="flex items-center gap-2 px-3 py-1 bg-background rounded-full border border-border"
            >
              <div className="w-2 h-2 bg-success rounded-full" />
              <span className="text-xs text-text-secondary">{device.model}</span>
              <span className="text-xs text-text-muted">({device.id})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}