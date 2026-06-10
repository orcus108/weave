import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "@excalidraw/excalidraw/appState";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import {
  STORAGE_KEYS,
  boardElementsKey,
  boardAppStateKey,
} from "../app_constants";

import type { Board } from "../boards/types";

export const saveUsernameToLocalStorage = (username: string) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_COLLAB,
      JSON.stringify({ username }),
    );
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

export const importUsernameFromLocalStorage = (): string | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);
    if (data) {
      return JSON.parse(data).username;
    }
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  return null;
};

export const importFromLocalStorage = () => {
  let savedElements = null;
  let savedState = null;

  try {
    savedElements = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
    savedState = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE);
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  let elements: ExcalidrawElement[] = [];
  if (savedElements) {
    try {
      elements = JSON.parse(savedElements);
    } catch (error: any) {
      console.error(error);
      // Do nothing because elements array is already empty
    }
  }

  let appState = null;
  if (savedState) {
    try {
      appState = {
        ...getDefaultAppState(),
        ...clearAppStateForLocalStorage(
          JSON.parse(savedState) as Partial<AppState>,
        ),
      };
    } catch (error: any) {
      console.error(error);
      // Do nothing because appState is already null
    }
  }
  return { elements, appState };
};

export const getElementsStorageSize = () => {
  try {
    const elements = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
    const elementsSize = elements?.length || 0;
    return elementsSize;
  } catch (error: any) {
    console.error(error);
    return 0;
  }
};

export const getTotalStorageSize = () => {
  try {
    const appState = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE);
    const collab = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);

    const appStateSize = appState?.length || 0;
    const collabSize = collab?.length || 0;

    return appStateSize + collabSize + getElementsStorageSize();
  } catch (error: any) {
    console.error(error);
    return 0;
  }
};

// ---------------------------------------------------------------------------
// Weave multi-board persistence

export const loadBoardList = (): Board[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOARD_LIST);
    if (raw) {
      return JSON.parse(raw) as Board[];
    }
  } catch (error: any) {
    console.error(error);
  }
  return [];
};

export const saveBoardList = (boards: Board[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.BOARD_LIST, JSON.stringify(boards));
  } catch (error: any) {
    console.error(error);
  }
};

export const loadActiveBoardId = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_BOARD_ID);
  } catch (error: any) {
    console.error(error);
    return null;
  }
};

export const saveActiveBoardId = (id: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_BOARD_ID, id);
  } catch (error: any) {
    console.error(error);
  }
};

export const importBoardFromLocalStorage = (boardId: string) => {
  let savedElements = null;
  let savedState = null;

  try {
    savedElements = localStorage.getItem(boardElementsKey(boardId));
    savedState = localStorage.getItem(boardAppStateKey(boardId));
  } catch (error: any) {
    console.error(error);
  }

  let elements: ExcalidrawElement[] = [];
  if (savedElements) {
    try {
      elements = JSON.parse(savedElements);
    } catch (error: any) {
      console.error(error);
    }
  }

  let appState = null;
  if (savedState) {
    try {
      appState = {
        ...getDefaultAppState(),
        ...clearAppStateForLocalStorage(
          JSON.parse(savedState) as Partial<AppState>,
        ),
      };
    } catch (error: any) {
      console.error(error);
    }
  }

  return { elements, appState };
};

export const saveBoardToLocalStorage = (
  boardId: string,
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): void => {
  try {
    const _appState = clearAppStateForLocalStorage(appState);
    localStorage.setItem(boardElementsKey(boardId), JSON.stringify(elements));
    localStorage.setItem(boardAppStateKey(boardId), JSON.stringify(_appState));
  } catch (error: any) {
    console.error(error);
  }
};

export const loadClosedBoardIds = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLOSED_BOARD_IDS);
    if (raw) {
      return JSON.parse(raw) as string[];
    }
  } catch (error: any) {
    console.error(error);
  }
  return [];
};

export const saveClosedBoardIds = (ids: string[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.CLOSED_BOARD_IDS, JSON.stringify(ids));
  } catch (error: any) {
    console.error(error);
  }
};

/**
 * One-time migration: moves existing excalidraw/excalidraw-state keys into a
 * board-namespaced slot and seeds the board list. Returns the new board id.
 */
export const migrateLegacyToBoard = (): string => {
  const boardId = "board-default";
  const elements = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
  const appState = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE);

  if (elements) {
    localStorage.setItem(boardElementsKey(boardId), elements);
  }
  if (appState) {
    localStorage.setItem(boardAppStateKey(boardId), appState);
  }

  const board: Board = {
    id: boardId,
    name: "Board 1",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  saveBoardList([board]);
  saveActiveBoardId(boardId);

  return boardId;
};
