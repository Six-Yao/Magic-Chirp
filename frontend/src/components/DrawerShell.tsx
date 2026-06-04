import { X } from 'lucide-react';
import { useRef, useState } from 'react';

function DrawerShell({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const dragStartY = useRef<number | null>(null);

  if (!open) return null;

  function handleDragEnd(clientY: number) {
    if (dragStartY.current === null) return;
    const deltaY = clientY - dragStartY.current;
    if (deltaY < -24) setExpanded(true);
    if (deltaY > 24) setExpanded(false);
    dragStartY.current = null;
  }

  return (
    <div className="drawer-layer">
      <button className="drawer-scrim" type="button" aria-label="关闭弹窗" onClick={onClose} />
      <section className={`bottom-drawer ${expanded ? 'expanded' : ''}`}>
        <button
          className="drawer-handle"
          type="button"
          aria-label={expanded ? '收起抽屉' : '展开抽屉'}
          onClick={() => setExpanded((value) => !value)}
          onPointerDown={(event) => {
            dragStartY.current = event.clientY;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => handleDragEnd(event.clientY)}
          onPointerCancel={() => {
            dragStartY.current = null;
          }}
        >
          <span />
        </button>
        <header className="drawer-header">
          <h2>{title}</h2>
          <button className="drawer-close" type="button" aria-label="关闭" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default DrawerShell;
