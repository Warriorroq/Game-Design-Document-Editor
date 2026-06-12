import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

const SAVE_DEBOUNCE_MS = 300;

function applyScrollTop(el: HTMLElement, top: number) {
  el.scrollTop = top;
  requestAnimationFrame(() => {
    el.scrollTop = top;
  });
}

export function useSectionEditorScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
  sectionId: string,
  savedScrollTop: number | undefined,
  onSaveScrollTop: (sectionId: string, scrollTop: number) => void
) {
  const prevSectionIdRef = useRef<string | null>(null);
  const scrollBySectionRef = useRef(new Map<string, number>());
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onSaveScrollTopRef = useRef(onSaveScrollTop);
  onSaveScrollTopRef.current = onSaveScrollTop;

  const flushScrollSave = (id: string) => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = undefined;
    }
    const top = scrollBySectionRef.current.get(id);
    if (top !== undefined) {
      onSaveScrollTopRef.current(id, top);
    }
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const prevId = prevSectionIdRef.current;
    if (prevId !== null && prevId !== sectionId) {
      flushScrollSave(prevId);
    }

    if (prevId !== sectionId) {
      const top =
        scrollBySectionRef.current.get(sectionId) ?? savedScrollTop ?? 0;
      scrollBySectionRef.current.set(sectionId, top);
      applyScrollTop(el, top);
      prevSectionIdRef.current = sectionId;
    }
  }, [sectionId, savedScrollTop, scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !sectionId) return;

    const onScroll = () => {
      scrollBySectionRef.current.set(sectionId, el.scrollTop);
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = setTimeout(() => {
        pendingTimerRef.current = undefined;
        onSaveScrollTopRef.current(sectionId, el.scrollTop);
      }, SAVE_DEBOUNCE_MS);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      flushScrollSave(sectionId);
    };
  }, [sectionId, scrollRef]);
}
