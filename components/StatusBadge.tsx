import { STATUS_META, type ProjectStatus } from '@/lib/projects';

export default function StatusBadge({ status }: { status: ProjectStatus }) {
  const meta = STATUS_META[status];

  return (
    <span className={`status-pill ${meta.className}`}>
      <span className='status-dot' aria-hidden='true' />
      {meta.label}
    </span>
  );
}
