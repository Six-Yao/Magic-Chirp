import { X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const DRAWER_EXIT_MS = 260;
const DRAWER_MARGIN_PX = 12;

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
  const [drawerHeight, setDrawerHeight] = useState<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const resizeFrameRef = useRef<number | null>(null);

  const updateDrawerHeight = useCallback(() => {
    const layer = layerRef.current;
    const header = headerRef.current;
    const body = bodyRef.current;
    if (!layer || !header || !body) return;

    const availableHeight = Math.max(260, layer.clientHeight - DRAWER_MARGIN_PX);
    const naturalHeight = header.offsetHeight + body.scrollHeight;
    const targetHeight = expanded ? availableHeight : Math.min(naturalHeight, availableHeight);

    setDrawerHeight(Math.ceil(targetHeight));
  }, [expanded]);

  const scheduleDrawerHeightUpdate = useCallback(() => {
    if (resizeFrameRef.current) {
      window.cancelAnimationFrame(resizeFrameRef.current);
    }

    resizeFrameRef.current = window.requestAnimationFrame(() => {
      updateDrawerHeight();
      resizeFrameRef.current = window.requestAnimationFrame(() => {
        updateDrawerHeight();
        resizeFrameRef.current = null;
      });
    });
  }, [updateDrawerHeight]);

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
      setDrawerHeight(null);
    }, DRAWER_EXIT_MS);

    return () => window.clearTimeout(timer);
  }, [mounted, open]);

  useLayoutEffect(() => {
    if (!mounted) return;
    scheduleDrawerHeightUpdate();
  }, [children, mounted, scheduleDrawerHeightUpdate]);

  useEffect(() => {
    if (!mounted) return;

    const observer = new ResizeObserver(scheduleDrawerHeightUpdate);
    if (layerRef.current) observer.observe(layerRef.current);
    if (headerRef.current) observer.observe(headerRef.current);
    if (bodyRef.current) observer.observe(bodyRef.current);

    window.addEventListener('resize', scheduleDrawerHeightUpdate);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scheduleDrawerHeightUpdate);
      if (resizeFrameRef.current) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, [mounted, scheduleDrawerHeightUpdate]);

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
    <div ref={layerRef} className={`drawer-layer ${closing ? 'closing' : ''}`}>
      <button className="drawer-scrim" type="button" aria-label="关闭弹窗" onClick={handleClose} />
      <section
        className={`bottom-drawer ${expanded ? 'expanded' : ''}`}
        style={
          {
            '--drawer-height': drawerHeight ? `${drawerHeight}px` : undefined,
          } as CSSProperties
        }
      >
        <div ref={headerRef} className="drawer-sticky-top">
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
        <div ref={bodyRef} className="drawer-body" onLoadCapture={scheduleDrawerHeightUpdate}>
          {children}
        </div>
      </section>
    </div>
  );
}

export default DrawerShell;
