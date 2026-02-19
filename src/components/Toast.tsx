import { useEffect } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

interface ToastProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border min-w-[300px] max-w-md ${
          type === "success"
            ? "bg-surface border-success/50"
            : "bg-surface border-error/50"
        }`}
      >
        {type === "success" ? (
          <CheckCircle size={20} className="text-success shrink-0" />
        ) : (
          <XCircle size={20} className="text-error shrink-0" />
        )}
        <p className="flex-1 text-sm text-text-primary">{message}</p>
        <button
          onClick={onClose}
          className="p-1 hover:bg-surface-hover rounded transition-colors shrink-0"
        >
          <X size={16} className="text-text-muted" />
        </button>
      </div>
    </div>
  );
}
