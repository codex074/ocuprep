interface ActionStatusProps {
  text?: string;
}

export default function ActionStatus({ text = 'กำลังบันทึกข้อมูล...' }: ActionStatusProps) {
  return (
    <div className="action-status" role="status" aria-live="polite">
      <span className="status-spinner" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
