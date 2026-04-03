interface RefreshButtonProps {
  refreshing: boolean;
  onClick: () => void;
  className?: string;
  label?: string;
  loadingLabel?: string;
}

export default function RefreshButton({
  refreshing,
  onClick,
  className = '',
  label = 'รีเฟรชข้อมูล',
  loadingLabel = 'กำลังรีเฟรช...',
}: RefreshButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn-sm refresh-btn ${refreshing ? 'refreshing' : ''} ${className}`.trim()}
      onClick={onClick}
      disabled={refreshing}
    >
      <span className="refresh-btn-icon-wrap" aria-hidden="true">
        <svg className="refresh-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 2v6h-6" />
          <path d="M3 22v-6h6" />
          <path d="M20.49 9A9 9 0 0 0 5 5.64L3 8" />
          <path d="M3.51 15A9 9 0 0 0 19 18.36L21 16" />
        </svg>
      </span>
      <span>{refreshing ? loadingLabel : label}</span>
    </button>
  );
}
