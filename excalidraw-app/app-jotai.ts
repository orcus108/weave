// eslint-disable-next-line no-restricted-imports
import {
  atom,
  Provider,
  useAtom,
  useAtomValue,
  useSetAtom,
  createStore,
  type PrimitiveAtom,
} from "jotai";
import { useLayoutEffect } from "react";

import type { Board, Checkpoint } from "./boards/types";

export const appJotaiStore = createStore();

export { atom, Provider, useAtom, useAtomValue, useSetAtom };

// Weave multi-board atoms
export const boardsAtom = atom<Board[]>([]);
export const activeBoardIdAtom = atom<string>("");
export const checkpointsAtom = atom<Checkpoint[]>([]);
export const renamingBoardIdAtom = atom<string | null>(null);

export const useAtomWithInitialValue = <
  T extends unknown,
  A extends PrimitiveAtom<T>,
>(
  atom: A,
  initialValue: T | (() => T),
) => {
  const [value, setValue] = useAtom(atom);

  useLayoutEffect(() => {
    if (typeof initialValue === "function") {
      // @ts-ignore
      setValue(initialValue());
    } else {
      setValue(initialValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [value, setValue] as const;
};
