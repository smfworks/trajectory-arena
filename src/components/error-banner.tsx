import { AlertCircle, RefreshCw } from "lucide-react";

export function ErrorBanner({
  message,
  onRetry,
  retryLabel = "Retry",
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-100"
    >
      <span className="flex items-start gap-2">
        <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
        <span>{message}</span>
      </span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-md bg-red-500/20 px-3 py-1.5 text-sm hover:bg-red-500/30"
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
