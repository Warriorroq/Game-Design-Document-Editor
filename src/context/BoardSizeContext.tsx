import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  loadBoardSize,
  saveBoardSize,
  type BoardSize,
} from "../lib/boardSettings";

interface BoardSizeContextValue extends BoardSize {
  setBoardSize: (size: BoardSize) => void;
}

const BoardSizeContext = createContext<BoardSizeContextValue | null>(null);

export function BoardSizeProvider({ children }: { children: ReactNode }) {
  const [size, setSize] = useState<BoardSize>(() => loadBoardSize());

  const setBoardSize = useCallback((next: BoardSize) => {
    setSize(saveBoardSize(next));
  }, []);

  const value = useMemo(
    () => ({
      width: size.width,
      height: size.height,
      setBoardSize,
    }),
    [size.width, size.height, setBoardSize]
  );

  return (
    <BoardSizeContext.Provider value={value}>{children}</BoardSizeContext.Provider>
  );
}

export function useBoardSize(): BoardSizeContextValue {
  const ctx = useContext(BoardSizeContext);
  if (!ctx) {
    throw new Error("useBoardSize must be used within BoardSizeProvider");
  }
  return ctx;
}
