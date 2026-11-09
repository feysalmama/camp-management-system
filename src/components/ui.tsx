import { useEffect, useRef, type ReactNode } from 'react';
import { X, Inbox, LoaderCircle } from 'lucide-react';
import { label } from '../lib/workflow';

export function Badge({ value }: { value: string }) {
  return <span className={`badge badge-${value}`}>{label(value)}</span>;
}
export function Empty({
  title = 'Nothing here yet',
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={32} />
      <h3>{title}</h3>
      <p>{children || 'New records will appear here.'}</p>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={24} /> Loading your workspace…
    </div>
  );
}
export function Field({
  label: name,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{name}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const handler = (event: Event) => {
      event.preventDefault();
      close();
    };
    dialog.addEventListener('cancel', handler);
    return () => {
      dialog.removeEventListener('cancel', handler);
      dialog.close();
    };
  }, [close]);
  return (
    <dialog ref={ref} className="modal">
      <div className="modal-heading">
        <h2>{title}</h2>
        <button type="button" className="icon-btn" onClick={close} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function PageHeading({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow || 'HOLY SITES OPERATIONS'}</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="heading-actions">{actions}</div>
    </div>
  );
}
