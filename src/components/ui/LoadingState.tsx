interface LoadingStateProps {
  title?: string;
  description?: string;
}

export default function LoadingState({
  title = 'กำลังโหลดข้อมูล',
  description = 'โปรดรอสักครู่ ระบบกำลังดึงข้อมูลจาก Google Sheet',
}: LoadingStateProps) {
  return (
    <div className="loading-state-card">
      <div className="loading-state-spinner" />
      <div className="loading-state-text">
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
      <div className="loading-skeleton-group">
        <div className="loading-skeleton-line wide" />
        <div className="loading-skeleton-line" />
        <div className="loading-skeleton-line short" />
      </div>
    </div>
  );
}
