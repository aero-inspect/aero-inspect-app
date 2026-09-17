type LoadingStateProps = {
  text: string;
  className?: string;
  compact?: boolean;
};

export function LoadingState({ text, className = "", compact = false }: LoadingStateProps) {
  return (
    <div className={`app-loading-state${compact ? " compact" : ""}${className ? ` ${className}` : ""}`} role="status" aria-live="polite">
      <p>{text}</p>
      <span aria-hidden="true" />
    </div>
  );
}
