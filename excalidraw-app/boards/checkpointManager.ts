import { createStore, get, set, del } from "idb-keyval";

import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { Checkpoint } from "./types";

const checkpointsStore = createStore(
  "weave-checkpoints-db",
  "checkpoints-store",
);

const MAX_CHECKPOINTS_PER_BOARD = 15;

const boardKey = (boardId: string) => `board:${boardId}`;

const generateId = () =>
  `cp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const saveCheckpoint = async (
  boardId: string,
  elements: readonly ExcalidrawElement[],
): Promise<void> => {
  try {
    const key = boardKey(boardId);
    const existing: Checkpoint[] = (await get(key, checkpointsStore)) || [];

    const checkpoint: Checkpoint = {
      id: generateId(),
      boardId,
      timestamp: Date.now(),
      elements: JSON.stringify(elements),
    };

    const updated = [checkpoint, ...existing].slice(
      0,
      MAX_CHECKPOINTS_PER_BOARD,
    );
    await set(key, updated, checkpointsStore);
  } catch (error) {
    console.error("[Weave] Failed to save checkpoint:", error);
  }
};

export const loadCheckpoints = async (
  boardId: string,
): Promise<Checkpoint[]> => {
  try {
    return (await get(boardKey(boardId), checkpointsStore)) || [];
  } catch (error) {
    console.error("[Weave] Failed to load checkpoints:", error);
    return [];
  }
};

export const restoreCheckpoint = async (
  checkpointId: string,
  boardId: string,
  excalidrawAPI: ExcalidrawImperativeAPI,
): Promise<void> => {
  try {
    const checkpoints = await loadCheckpoints(boardId);
    const checkpoint = checkpoints.find((c) => c.id === checkpointId);
    if (!checkpoint) {
      return;
    }
    const elements = restoreElements(JSON.parse(checkpoint.elements), null, {
      repairBindings: true,
    });
    excalidrawAPI.updateScene({
      elements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  } catch (error) {
    console.error("[Weave] Failed to restore checkpoint:", error);
  }
};

export const deleteCheckpointsForBoard = async (
  boardId: string,
): Promise<void> => {
  try {
    await del(boardKey(boardId), checkpointsStore);
  } catch (error) {
    console.error("[Weave] Failed to delete checkpoints:", error);
  }
};

export const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) {
    return "just now";
  }
  if (mins < 60) {
    return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  }
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  return `${days} day${days === 1 ? "" : "s"} ago`;
};
