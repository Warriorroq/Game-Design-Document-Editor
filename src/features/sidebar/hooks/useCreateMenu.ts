import { useCallback, useEffect, useRef, useState } from "react";

export type CreateMenuState = { parentId: string | null } | null;

export function useCreateMenu() {
  const menuRef = useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<CreateMenuState>(null);

  const toggleCreateMenu = useCallback((parentFolderId: string | null) => {
    setOpenMenu((current) =>
      current === null
        ? { parentId: parentFolderId }
        : current.parentId === parentFolderId
          ? null
          : { parentId: parentFolderId }
    );
  }, []);

  const closeCreateMenu = useCallback(() => {
    setOpenMenu(null);
  }, []);

  const isCreateMenuOpen = useCallback(
    (parentFolderId: string | null) => openMenu !== null && openMenu.parentId === parentFolderId,
    [openMenu]
  );

  useEffect(() => {
    if (openMenu === null) return;

    const onPointer = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpenMenu(null);
    };

    window.addEventListener("pointerdown", onPointer, true);
    return () => window.removeEventListener("pointerdown", onPointer, true);
  }, [openMenu]);

  return {
    menuRef,
    openMenu,
    toggleCreateMenu,
    closeCreateMenu,
    isCreateMenuOpen
  };
}
