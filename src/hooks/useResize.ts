import { useCallback, useRef } from 'react';

/**
 * Returns a mousedown handler for a drag-divider between two panels.
 * onResize(delta) is called with pixel delta as the user drags.
 * direction: 'horizontal' (dragging left/right) | 'vertical' (dragging up/down)
 */
export function useDragResize(
  direction: 'horizontal' | 'vertical',
  onResize: (delta: number) => void
) {
  const startPos = useRef(0);

  const onMouseMove = useCallback((e: MouseEvent) => {
    const current = direction === 'horizontal' ? e.clientX : e.clientY;
    const delta = current - startPos.current;
    startPos.current = current;
    onResize(delta);
  }, [direction, onResize]);

  const onMouseUp = useCallback(() => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [onMouseMove]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [direction, onMouseMove, onMouseUp]);

  return onMouseDown;
}
