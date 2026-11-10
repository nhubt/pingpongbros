import type { ReactNode } from 'react';

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="ov" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="pg-h"><h3>{title}</h3><button className="btn sm ghost" type="button" aria-label="Đóng" onClick={onClose}>Đóng</button></div>
        <div>{children}</div>
      </section>
    </div>
  );
}
