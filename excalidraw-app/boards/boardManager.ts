import type { Board } from "./types";

const generateId = () =>
  `board-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const createBoard = (name: string): Board => ({
  id: generateId(),
  name,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const renameBoard = (
  boards: Board[],
  id: string,
  name: string,
): Board[] =>
  boards.map((b) =>
    b.id === id
      ? { ...b, name: name.trim() || b.name, updatedAt: Date.now() }
      : b,
  );

/** Prevents deleting the last board. Returns updated list and new active id. */
export const deleteBoard = (
  boards: Board[],
  id: string,
): { boards: Board[]; newActiveId: string | null } => {
  if (boards.length <= 1) {
    return { boards, newActiveId: null };
  }
  const idx = boards.findIndex((b) => b.id === id);
  const next = boards.filter((b) => b.id !== id);
  const newActiveId = next[Math.max(0, idx - 1)].id;
  return { boards: next, newActiveId };
};

export const duplicateBoard = (
  boards: Board[],
  id: string,
  newName?: string,
): Board => {
  const source = boards.find((b) => b.id === id);
  return {
    id: generateId(),
    name: newName ?? `${source?.name ?? "Board"} (copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

export const touchBoard = (boards: Board[], id: string): Board[] =>
  boards.map((b) => (b.id === id ? { ...b, updatedAt: Date.now() } : b));
