import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const DRAWER_EXIT_MS = 260;

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
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const dragStartY = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }

    if (!mounted) return;

    setClosing(true);
    setExpanded(false);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, DRAWER_EXIT_MS);

    return () => window.clearTimeout(timer);
  }, [mounted, open]);

  if (!mounted) return null;

  function handleClose() {
    setExpanded(false);
    onClose();
  }

  function handleDragEnd(clientY: number) {
    if (dragStartY.current === null) return;
    const deltaY = clientY - dragStartY.current;
    if (deltaY < -24) setExpanded(true);
    if (deltaY > 24) setExpanded(false);
    dragStartY.current = null;
  }

  return (
    <div className={`drawer-layer ${closing ? 'closing' : ''}`}>
      <button className="drawer-scrim" type="button" aria-label="关闭弹窗" onClick={handleClose} />
      <section className={`bottom-drawer ${expanded ? 'expanded' : ''}`}>
        <div className="drawer-sticky-top">
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
            <button className="drawer-close" type="button" aria-label="关闭" onClick={handleClose}>
              <X size={20} />
            </button>
          </header>
        </div>
        {children}
      </section>
    </div>
  );
}

export default DrawerShell;
