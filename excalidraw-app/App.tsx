import {
  Excalidraw,
  LiveCollaborationTrigger,
  TTDDialogTrigger,
  CaptureUpdateAction,
  reconcileElements,
  useEditorInterface,
  ExcalidrawAPIProvider,
  useExcalidrawAPI,
} from "@excalidraw/excalidraw";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import {
  CommandPalette,
  DEFAULT_CATEGORIES,
} from "@excalidraw/excalidraw/components/CommandPalette/CommandPalette";
import { ErrorDialog } from "@excalidraw/excalidraw/components/ErrorDialog";
import { OverwriteConfirmDialog } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirm";
import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import { ShareableLinkDialog } from "@excalidraw/excalidraw/components/ShareableLinkDialog";
import Trans from "@excalidraw/excalidraw/components/Trans";
import {
  APP_NAME,
  EVENT,
  THEME,
  VERSION_TIMEOUT,
  debounce,
  getVersion,
  getFrame,
  isTestEnv,
  preventUnload,
  resolvablePromise,
  isRunningInIframe,
  isDevEnv,
} from "@excalidraw/common";
import polyfill from "@excalidraw/excalidraw/polyfill";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { t } from "@excalidraw/excalidraw/i18n";

import { usersIcon, share } from "@excalidraw/excalidraw/components/icons";
import { isElementLink } from "@excalidraw/element";
import {
  bumpElementVersions,
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";
import { newElementWith } from "@excalidraw/element";
import { isInitializedImageElement } from "@excalidraw/element";
import clsx from "clsx";
import {
  parseLibraryTokensFromUrl,
  useHandleLibrary,
} from "@excalidraw/excalidraw/data/library";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";
import type {
  FileId,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  BinaryFiles,
  ExcalidrawInitialDataState,
  UIAppState,
  ExcalidrawProps,
} from "@excalidraw/excalidraw/types";
import type { ResolutionType } from "@excalidraw/common/utility-types";
import type { ResolvablePromise } from "@excalidraw/common/utils";

import CustomStats from "./CustomStats";
import {
  Provider,
  useAtom,
  useAtomValue,
  useAtomWithInitialValue,
  appJotaiStore,
  boardsAtom,
  activeBoardIdAtom,
  checkpointsAtom,
  renamingBoardIdAtom,
  closedBoardIdsAtom,
} from "./app-jotai";
import {
  FIREBASE_STORAGE_PREFIXES,
  STORAGE_KEYS,
  SYNC_BROWSER_TABS_TIMEOUT,
} from "./app_constants";
import {
  createBoard,
  renameBoard,
  deleteBoard,
  duplicateBoard,
  touchBoard,
} from "./boards/boardManager";
import { BoardGallery } from "./components/BoardGallery";
import { BoardTabs } from "./components/BoardTabs";
import {
  saveCheckpoint,
  loadCheckpoints,
  restoreCheckpoint,
  formatRelativeTime,
} from "./boards/checkpointManager";
import Collab, {
  collabAPIAtom,
  isCollaboratingAtom,
  isOfflineAtom,
} from "./collab/Collab";
import { AppFooter } from "./components/AppFooter";
import { AppMainMenu } from "./components/AppMainMenu";
import { AppWelcomeScreen } from "./components/AppWelcomeScreen";
import { TopErrorBoundary } from "./components/TopErrorBoundary";

import {
  exportToBackend,
  getCollaborationLinkData,
  importFromBackend,
  isCollaborationLink,
} from "./data";

import { updateStaleImageStatuses } from "./data/FileManager";
import { FileStatusStore } from "./data/fileStatusStore";
import {
  importFromLocalStorage,
  importUsernameFromLocalStorage,
  importBoardFromLocalStorage,
  saveBoardList,
  saveActiveBoardId,
  loadBoardList,
  loadActiveBoardId,
  migrateLegacyToBoard,
  saveBoardToLocalStorage,
  loadClosedBoardIds,
  saveClosedBoardIds,
} from "./data/localStorage";

import { loadFilesFromFirebase } from "./data/firebase";
import {
  LibraryIndexedDBAdapter,
  LibraryLocalStorageMigrationAdapter,
  LocalData,
  localStorageQuotaExceededAtom,
} from "./data/LocalData";
import { isBrowserStorageStateNewer } from "./data/tabSync";
import { ShareDialog, shareDialogStateAtom } from "./share/ShareDialog";
import CollabError, { collabErrorIndicatorAtom } from "./collab/CollabError";
import { useHandleAppTheme } from "./useHandleAppTheme";
import { getPreferredLanguage } from "./app-language/language-detector";
import { useAppLangCode } from "./app-language/language-state";
import DebugCanvas, {
  debugRenderer,
  isVisualDebuggerEnabled,
  loadSavedDebugState,
} from "./components/DebugCanvas";
import { AIComponents } from "./components/AI";
import { ExcalidrawPlusIframeExport } from "./ExcalidrawPlusIframeExport";

import "./index.scss";
import { Analytics } from "@vercel/analytics/react";

import { AppSidebar } from "./components/AppSidebar";

import type { CollabAPI } from "./collab/Collab";

polyfill();

window.EXCALIDRAW_THROTTLE_RENDER = true;

declare global {
  interface BeforeInstallPromptEventChoiceResult {
    outcome: "accepted" | "dismissed";
  }

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<BeforeInstallPromptEventChoiceResult>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let pwaEvent: BeforeInstallPromptEvent | null = null;

// Adding a listener outside of the component as it may (?) need to be
// subscribed early to catch the event.
//
// Also note that it will fire only if certain heuristics are met (user has
// used the app for some time, etc.)
window.addEventListener(
  "beforeinstallprompt",
  (event: BeforeInstallPromptEvent) => {
    // prevent Chrome <= 67 from automatically showing the prompt
    event.preventDefault();
    // cache for later use
    pwaEvent = event;
  },
);

let isSelfEmbedding = false;

if (window.self !== window.top) {
  try {
    const parentUrl = new URL(document.referrer);
    const currentUrl = new URL(window.location.href);
    if (parentUrl.origin === currentUrl.origin) {
      isSelfEmbedding = true;
    }
  } catch (error) {
    // ignore
  }
}

const shareableLinkConfirmDialog = {
  title: t("overwriteConfirm.modal.shareableLink.title"),
  description: (
    <Trans
      i18nKey="overwriteConfirm.modal.shareableLink.description"
      bold={(text) => <strong>{text}</strong>}
      br={() => <br />}
    />
  ),
  actionLabel: t("overwriteConfirm.modal.shareableLink.button"),
  color: "danger",
} as const;

const initializeScene = async (opts: {
  collabAPI: CollabAPI | null;
  excalidrawAPI: ExcalidrawImperativeAPI;
  boardId?: string;
}): Promise<
  { scene: ExcalidrawInitialDataState | null } & (
    | { isExternalScene: true; id: string; key: string }
    | { isExternalScene: false; id?: null; key?: null }
  )
> => {
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get("id");
  const jsonBackendMatch = window.location.hash.match(
    /^#json=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/,
  );
  const externalUrlMatch = window.location.hash.match(/^#url=(.*)$/);

  const localDataState = opts.boardId
    ? importBoardFromLocalStorage(opts.boardId)
    : importFromLocalStorage();

  let scene: Omit<
    RestoredDataState,
    // we're not storing files in the scene database/localStorage, and instead
    // fetch them async from a different store
    "files"
  > & {
    scrollToContent?: boolean;
  } = {
    elements: restoreElements(localDataState?.elements, null, {
      repairBindings: true,
      deleteInvisibleElements: true,
    }),
    appState: restoreAppState(localDataState?.appState, null),
  };

  if (opts.boardId) {
    const boardList = loadBoardList();
    const board = boardList.find((b) => b.id === opts.boardId);
    if (board) {
      scene.appState = { ...scene.appState, name: board.name };
    }
  }

  let roomLinkData = getCollaborationLinkData(window.location.href);
  const isExternalScene = !!(id || jsonBackendMatch || roomLinkData);
  if (isExternalScene) {
    if (
      // don't prompt if scene is empty
      !scene.elements.length ||
      // don't prompt for collab scenes because we don't override local storage
      roomLinkData ||
      // otherwise, prompt whether user wants to override current scene
      (await openConfirmModal(shareableLinkConfirmDialog))
    ) {
      if (jsonBackendMatch) {
        const imported = await importFromBackend(
          jsonBackendMatch[1],
          jsonBackendMatch[2],
        );

        scene = {
          elements: bumpElementVersions(
            restoreElements(imported.elements, null, {
              repairBindings: true,
              deleteInvisibleElements: true,
            }),
            localDataState?.elements,
          ),
          appState: restoreAppState(
            imported.appState,
            // local appState when importing from backend to ensure we restore
            // localStorage user settings which we do not persist on server.
            localDataState?.appState,
          ),
        };
      }
      scene.scrollToContent = true;
      if (!roomLinkData) {
        window.history.replaceState({}, APP_NAME, window.location.origin);
      }
    } else {
      // https://github.com/excalidraw/excalidraw/issues/1919
      if (document.hidden) {
        return new Promise((resolve, reject) => {
          window.addEventListener(
            "focus",
            () => initializeScene(opts).then(resolve).catch(reject),
            {
              once: true,
            },
          );
        });
      }

      roomLinkData = null;
      window.history.replaceState({}, APP_NAME, window.location.origin);
    }
  } else if (externalUrlMatch) {
    window.history.replaceState({}, APP_NAME, window.location.origin);

    const url = externalUrlMatch[1];
    try {
      const request = await fetch(window.decodeURIComponent(url));
      const data = await loadFromBlob(await request.blob(), null, null);
      if (
        !scene.elements.length ||
        (await openConfirmModal(shareableLinkConfirmDialog))
      ) {
        return { scene: data, isExternalScene };
      }
    } catch (error: any) {
      return {
        scene: {
          appState: {
            errorMessage: t("alerts.invalidSceneUrl"),
          },
        },
        isExternalScene,
      };
    }
  }

  if (roomLinkData && opts.collabAPI) {
    const { excalidrawAPI } = opts;

    const scene = await opts.collabAPI.startCollaboration(roomLinkData);

    return {
      // when collaborating, the state may have already been updated at this
      // point (we may have received updates from other clients), so reconcile
      // elements and appState with existing state
      scene: {
        ...scene,
        appState: {
          ...restoreAppState(
            {
              ...scene?.appState,
              theme: localDataState?.appState?.theme || scene?.appState?.theme,
            },
            excalidrawAPI.getAppState(),
          ),
          // necessary if we're invoking from a hashchange handler which doesn't
          // go through App.initializeScene() that resets this flag
          isLoading: false,
        },
        elements: reconcileElements(
          scene?.elements || [],
          excalidrawAPI.getSceneElementsIncludingDeleted() as RemoteExcalidrawElement[],
          excalidrawAPI.getAppState(),
        ),
      },
      isExternalScene: true,
      id: roomLinkData.roomId,
      key: roomLinkData.roomKey,
    };
  } else if (scene) {
    return isExternalScene && jsonBackendMatch
      ? {
          scene,
          isExternalScene,
          id: jsonBackendMatch[1],
          key: jsonBackendMatch[2],
        }
      : { scene, isExternalScene: false };
  }
  return { scene: null, isExternalScene: false };
};

const ExcalidrawWrapper = () => {
  const excalidrawAPI = useExcalidrawAPI();

  const [errorMessage, setErrorMessage] = useState("");
  const isCollabDisabled = isRunningInIframe();

  const { editorTheme, appTheme, setAppTheme } = useHandleAppTheme();

  const [langCode, setLangCode] = useAppLangCode();

  const editorInterface = useEditorInterface();

  // initial state
  // ---------------------------------------------------------------------------

  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: null! });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise =
      resolvablePromise<ExcalidrawInitialDataState | null>();
  }

  const debugCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    trackEvent("load", "frame", getFrame());
    // Delayed so that the app has a time to load the latest SW
    setTimeout(() => {
      trackEvent("load", "version", getVersion());
    }, VERSION_TIMEOUT);
  }, []);

  const [, setShareDialogState] = useAtom(shareDialogStateAtom);
  const [collabAPI] = useAtom(collabAPIAtom);
  const [isCollaborating] = useAtomWithInitialValue(isCollaboratingAtom, () => {
    return isCollaborationLink(window.location.href);
  });
  const collabError = useAtomValue(collabErrorIndicatorAtom);

  const [boards, setBoards] = useAtom(boardsAtom);
  const [activeBoardId, setActiveBoardId] = useAtom(activeBoardIdAtom);
  const [renamingBoardId, setRenamingBoardId] = useAtom(renamingBoardIdAtom);
  const [checkpoints, setCheckpoints] = useAtom(checkpointsAtom);
  const [closedBoardIds, setClosedBoardIds] = useAtom(closedBoardIdsAtom);
  const [tabBarCollapsed, setTabBarCollapsed] = useState(
    () => localStorage.getItem(STORAGE_KEYS.TAB_BAR_COLLAPSED) === "true",
  );
  const [galleryOpen, setGalleryOpen] = useState(false);

  const handleToggleTabBar = useCallback(() => {
    setTabBarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEYS.TAB_BAR_COLLAPSED, String(next));
      return next;
    });
  }, []);

  const changeCountRef = useRef(0);
  const lastCheckpointTimeRef = useRef(Date.now());

  useHandleLibrary({
    excalidrawAPI,
    adapter: LibraryIndexedDBAdapter,
    // TODO maybe remove this in several months (shipped: 24-03-11)
    migrationAdapter: LibraryLocalStorageMigrationAdapter,
  });

  const [, forceRefresh] = useState(false);

  useEffect(() => {
    if (isDevEnv()) {
      const debugState = loadSavedDebugState();

      if (debugState.enabled && !window.visualDebug) {
        window.visualDebug = {
          data: [],
        };
      } else {
        delete window.visualDebug;
      }
      forceRefresh((prev) => !prev);
    }
  }, [excalidrawAPI]);

  // ---------------------------------------------------------------------------
  // Hoisted loadImages
  // ---------------------------------------------------------------------------
  const loadImages = useCallback(
    (data: ResolutionType<typeof initializeScene>, isInitialLoad = false) => {
      if (!data.scene || !excalidrawAPI) {
        return;
      }

      if (collabAPI?.isCollaborating()) {
        if (data.scene.elements) {
          collabAPI
            .fetchImageFilesFromFirebase({
              elements: data.scene.elements,
              forceFetchFiles: true,
            })
            .then(({ loadedFiles, erroredFiles }) => {
              excalidrawAPI.addFiles(loadedFiles);
              updateStaleImageStatuses({
                excalidrawAPI,
                erroredFiles,
                elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
              });
            });
        }
      } else {
        const fileIds =
          data.scene.elements?.reduce((acc, element) => {
            if (isInitializedImageElement(element)) {
              return acc.concat(element.fileId);
            }
            return acc;
          }, [] as FileId[]) || [];

        if (data.isExternalScene) {
          if (fileIds.length) {
            // Direct Firebase call (not through FileManager), so track manually
            FileStatusStore.updateStatuses(
              fileIds.map((id) => [id, "loading"]),
            );
          }
          loadFilesFromFirebase(
            `${FIREBASE_STORAGE_PREFIXES.shareLinkFiles}/${data.id}`,
            data.key,
            fileIds,
          ).then(({ loadedFiles, erroredFiles }) => {
            excalidrawAPI.addFiles(loadedFiles);
            updateStaleImageStatuses({
              excalidrawAPI,
              erroredFiles,
              elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
            });
            FileStatusStore.updateStatuses([
              ...loadedFiles.map((f) => [f.id, "loaded"] as [FileId, "loaded"]),
              ...[...erroredFiles.keys()].map(
                (id) => [id, "error"] as [FileId, "error"],
              ),
            ]);
          });
        } else if (isInitialLoad) {
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(async ({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
          // on fresh load, clear unused files from IDB (from previous
          // session)
          LocalData.fileStorage.clearObsoleteFiles({
            currentFileIds: fileIds,
          });
        }
      }
    },
    [collabAPI, excalidrawAPI],
  );

  useEffect(() => {
    if (!excalidrawAPI || (!isCollabDisabled && !collabAPI)) {
      return;
    }

    // Initialize multi-board state before loading the scene
    let boardId: string;
    if (!localStorage.getItem(STORAGE_KEYS.BOARD_LIST)) {
      boardId = migrateLegacyToBoard();
    } else {
      const storedBoards = loadBoardList();
      boardId = loadActiveBoardId() || storedBoards[0]?.id || "";
      if (!boardId && storedBoards.length === 0) {
        boardId = migrateLegacyToBoard();
      }
    }
    const initialBoards = loadBoardList();
    setBoards(initialBoards);
    setActiveBoardId(boardId);
    setClosedBoardIds(loadClosedBoardIds());

    initializeScene({ collabAPI, excalidrawAPI, boardId }).then(
      async (data) => {
        loadImages(data, /* isInitialLoad */ true);
        initialStatePromiseRef.current.promise.resolve(data.scene);
      },
    );

    // Load checkpoints for the initial board
    loadCheckpoints(boardId).then(setCheckpoints);

    const onHashChange = async (event: HashChangeEvent) => {
      event.preventDefault();
      const libraryUrlTokens = parseLibraryTokensFromUrl();
      if (!libraryUrlTokens) {
        if (
          collabAPI?.isCollaborating() &&
          !isCollaborationLink(window.location.href)
        ) {
          collabAPI.stopCollaboration(false);
        }
        excalidrawAPI.updateScene({ appState: { isLoading: true } });

        initializeScene({ collabAPI, excalidrawAPI }).then((data) => {
          loadImages(data);
          if (data.scene) {
            excalidrawAPI.updateScene({
              elements: restoreElements(data.scene.elements, null, {
                repairBindings: true,
              }),
              appState: restoreAppState(data.scene.appState, null),
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
          }
        });
      }
    };

    const syncData = debounce(() => {
      if (isTestEnv()) {
        return;
      }
      if (
        !document.hidden &&
        ((collabAPI && !collabAPI.isCollaborating()) || isCollabDisabled)
      ) {
        // don't sync if local state is newer or identical to browser state
        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)) {
          const localDataState = importFromLocalStorage();
          const username = importUsernameFromLocalStorage();
          setLangCode(getPreferredLanguage());
          excalidrawAPI.updateScene({
            ...localDataState,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          LibraryIndexedDBAdapter.load().then((data) => {
            if (data) {
              excalidrawAPI.updateLibrary({
                libraryItems: data.libraryItems,
              });
            }
          });
          collabAPI?.setUsername(username || "");
        }

        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_FILES)) {
          const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
          const currFiles = excalidrawAPI.getFiles();
          const fileIds =
            elements?.reduce((acc, element) => {
              if (
                isInitializedImageElement(element) &&
                // only load and update images that aren't already loaded
                !currFiles[element.fileId]
              ) {
                return acc.concat(element.fileId);
              }
              return acc;
            }, [] as FileId[]) || [];
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
        }
      }
    }, SYNC_BROWSER_TABS_TIMEOUT);

    const onUnload = () => {
      LocalData.flushSave();
    };

    const visibilityChange = (event: FocusEvent | Event) => {
      if (event.type === EVENT.BLUR || document.hidden) {
        LocalData.flushSave();
      }
      if (
        event.type === EVENT.VISIBILITY_CHANGE ||
        event.type === EVENT.FOCUS
      ) {
        syncData();
      }
    };

    window.addEventListener(EVENT.HASHCHANGE, onHashChange, false);
    window.addEventListener(EVENT.UNLOAD, onUnload, false);
    window.addEventListener(EVENT.BLUR, visibilityChange, false);
    document.addEventListener(EVENT.VISIBILITY_CHANGE, visibilityChange, false);
    window.addEventListener(EVENT.FOCUS, visibilityChange, false);
    return () => {
      window.removeEventListener(EVENT.HASHCHANGE, onHashChange, false);
      window.removeEventListener(EVENT.UNLOAD, onUnload, false);
      window.removeEventListener(EVENT.BLUR, visibilityChange, false);
      window.removeEventListener(EVENT.FOCUS, visibilityChange, false);
      document.removeEventListener(
        EVENT.VISIBILITY_CHANGE,
        visibilityChange,
        false,
      );
    };
  }, [
    isCollabDisabled,
    collabAPI,
    excalidrawAPI,
    setLangCode,
    loadImages,
    setActiveBoardId,
    setBoards,
    setCheckpoints,
  ]);

  useEffect(() => {
    const unloadHandler = (event: BeforeUnloadEvent) => {
      LocalData.flushSave();

      if (
        excalidrawAPI &&
        LocalData.fileStorage.shouldPreventUnload(
          excalidrawAPI.getSceneElements(),
        )
      ) {
        if (import.meta.env.VITE_APP_DISABLE_PREVENT_UNLOAD !== "true") {
          preventUnload(event);
        } else {
          console.warn(
            "preventing unload disabled (VITE_APP_DISABLE_PREVENT_UNLOAD)",
          );
        }
      }
    };
    window.addEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    return () => {
      window.removeEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    };
  }, [excalidrawAPI]);

  const switchBoard = useCallback(
    async (newBoardId: string) => {
      if (
        !excalidrawAPI ||
        newBoardId === appJotaiStore.get(activeBoardIdAtom)
      ) {
        return;
      }
      LocalData.flushSave();

      // Save a checkpoint and touch updatedAt for the board we're leaving
      const leavingId = appJotaiStore.get(activeBoardIdAtom);
      if (leavingId) {
        const currentElements = excalidrawAPI.getSceneElements();
        saveCheckpoint(leavingId, currentElements);
        const currentBoards = appJotaiStore.get(boardsAtom);
        const touched = touchBoard(currentBoards, leavingId);
        appJotaiStore.set(boardsAtom, touched);
        saveBoardList(touched);
      }

      const currentTheme = excalidrawAPI.getAppState().theme;
      const data = importBoardFromLocalStorage(newBoardId);
      const newBoardName = loadBoardList().find(
        (b) => b.id === newBoardId,
      )?.name;
      excalidrawAPI.updateScene({
        elements: restoreElements(data.elements, null, {
          repairBindings: true,
          deleteInvisibleElements: true,
        }),
        appState: {
          ...restoreAppState(data.appState, null),
          collaborators: new Map(),
          theme: currentTheme,
          ...(newBoardName ? { name: newBoardName } : {}),
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      excalidrawAPI.history.clear();
      setActiveBoardId(newBoardId);
      saveActiveBoardId(newBoardId);
      changeCountRef.current = 0;
      lastCheckpointTimeRef.current = Date.now();

      // Load checkpoints for the new board
      loadCheckpoints(newBoardId).then(setCheckpoints);
    },
    [excalidrawAPI, setActiveBoardId, setCheckpoints],
  );

  const handleAddBoard = useCallback(() => {
    const newBoard = createBoard(`Board ${boards.length + 1}`);
    const updated = [...boards, newBoard];
    setBoards(updated);
    saveBoardList(updated);
    switchBoard(newBoard.id);
  }, [boards, setBoards, switchBoard]);

  const handleRenameBoard = useCallback(
    (id: string, name: string) => {
      const updated = renameBoard(boards, id, name);
      setBoards(updated);
      saveBoardList(updated);
      if (id === activeBoardId && excalidrawAPI) {
        excalidrawAPI.updateScene({
          appState: { name },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      }
    },
    [boards, setBoards, activeBoardId, excalidrawAPI],
  );

  const handleDeleteBoard = useCallback(
    (id: string) => {
      const { boards: updated, newActiveId } = deleteBoard(boards, id);
      if (!newActiveId) {
        return; // last board, can't delete
      }
      setBoards(updated);
      saveBoardList(updated);
      // clean up closed state if the deleted board was hidden
      const currentClosed = appJotaiStore.get(closedBoardIdsAtom);
      if (currentClosed.includes(id)) {
        const updatedClosed = currentClosed.filter((cid) => cid !== id);
        setClosedBoardIds(updatedClosed);
        saveClosedBoardIds(updatedClosed);
      }
      switchBoard(newActiveId);
    },
    [boards, setBoards, setClosedBoardIds, switchBoard],
  );

  const handleDuplicateBoard = useCallback(
    (id: string) => {
      const sourceData = importBoardFromLocalStorage(id);
      const newBoard = duplicateBoard(boards, id);
      const updated = [...boards, newBoard];
      setBoards(updated);
      saveBoardList(updated);
      if (sourceData.elements.length && sourceData.appState) {
        saveBoardToLocalStorage(
          newBoard.id,
          sourceData.elements,
          sourceData.appState as AppState,
        );
      }
      switchBoard(newBoard.id);
    },
    [boards, setBoards, switchBoard],
  );

  const handleCloseBoard = useCallback(
    (id: string) => {
      const openBoards = boards.filter((b) => !closedBoardIds.includes(b.id));
      if (openBoards.length <= 1) {
        return; // can't close the last visible tab
      }
      const updated = [...closedBoardIds, id];
      setClosedBoardIds(updated);
      saveClosedBoardIds(updated);
      if (id === activeBoardId) {
        const next = openBoards.find((b) => b.id !== id);
        if (next) {
          switchBoard(next.id);
        }
      }
    },
    [boards, closedBoardIds, activeBoardId, setClosedBoardIds, switchBoard],
  );

  const handleReopenBoard = useCallback(
    (id: string) => {
      const updated = closedBoardIds.filter((cid) => cid !== id);
      setClosedBoardIds(updated);
      saveClosedBoardIds(updated);
    },
    [closedBoardIds, setClosedBoardIds],
  );

  // Board keyboard shortcuts (Option/Alt)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) {
        return;
      }
      const allBoards = appJotaiStore.get(boardsAtom);
      const closed = appJotaiStore.get(closedBoardIdsAtom);
      const open = allBoards.filter((b) => !closed.includes(b.id));
      const currentId = appJotaiStore.get(activeBoardIdAtom);
      const idx = open.findIndex((b) => b.id === currentId);

      if (e.code === "KeyT") {
        // new board
        e.preventDefault();
        handleAddBoard();
      } else if (e.code === "Tab" && !e.shiftKey) {
        // next board
        e.preventDefault();
        const next = open[(idx + 1) % open.length];
        if (next && next.id !== currentId) {
          switchBoard(next.id);
        }
      } else if (e.code === "Tab" && e.shiftKey) {
        // previous board
        e.preventDefault();
        const prev = open[(idx - 1 + open.length) % open.length];
        if (prev && prev.id !== currentId) {
          switchBoard(prev.id);
        }
      } else if (e.code === "KeyK") {
        // toggle gallery
        e.preventDefault();
        setGalleryOpen((prev) => !prev);
      } else if (e.code === "KeyW") {
        // close current board
        e.preventDefault();
        handleCloseBoard(currentId);
      } else if (e.code === "KeyR") {
        // rename current board
        e.preventDefault();
        setRenamingBoardId(currentId);
      } else if (e.code === "KeyD") {
        // duplicate current board
        e.preventDefault();
        handleDuplicateBoard(currentId);
      } else {
        // Option+1–9: jump to board by index
        const digit = e.code.match(/^Digit([1-9])$/)?.[1];
        if (digit) {
          const target = open[parseInt(digit, 10) - 1];
          if (target && target.id !== currentId) {
            e.preventDefault();
            switchBoard(target.id);
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    handleAddBoard,
    switchBoard,
    handleCloseBoard,
    handleDuplicateBoard,
    setRenamingBoardId,
  ]);

  const handleDeleteBoardWithConfirm = useCallback(
    async (id: string) => {
      const board = boards.find((b) => b.id === id);
      const confirmed = await openConfirmModal({
        title: "Delete board",
        description: `"${
          board?.name ?? "This board"
        }" will be permanently deleted.`,
        actionLabel: "Delete",
        color: "danger",
      });
      if (confirmed) {
        handleDeleteBoard(id);
      }
    },
    [boards, handleDeleteBoard],
  );

  const onChange = (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    if (collabAPI?.isCollaborating()) {
      collabAPI.syncElements(elements);
    }

    // this check is redundant, but since this is a hot path, it's best
    // not to evaludate the nested expression every time
    if (!LocalData.isSavePaused()) {
      const currentBoardId = appJotaiStore.get(activeBoardIdAtom) || undefined;
      LocalData.save(
        elements,
        appState,
        files,
        () => {
          if (excalidrawAPI) {
            let didChange = false;

            const elements = excalidrawAPI
              .getSceneElementsIncludingDeleted()
              .map((element) => {
                if (
                  LocalData.fileStorage.shouldUpdateImageElementStatus(element)
                ) {
                  const newElement = newElementWith(element, {
                    status: "saved",
                  });
                  if (newElement !== element) {
                    didChange = true;
                  }
                  return newElement;
                }
                return element;
              });

            if (didChange) {
              excalidrawAPI.updateScene({
                elements,
                captureUpdate: CaptureUpdateAction.NEVER,
              });
            }
          }
        },
        currentBoardId,
      );
    }

    // Checkpoint history: save every 50 changes or every 60 seconds
    changeCountRef.current += 1;
    const now = Date.now();
    if (
      changeCountRef.current >= 50 ||
      now - lastCheckpointTimeRef.current >= 60000
    ) {
      const cpBoardId = appJotaiStore.get(activeBoardIdAtom);
      if (cpBoardId) {
        saveCheckpoint(cpBoardId, elements).then(() => {
          loadCheckpoints(cpBoardId).then(setCheckpoints);
        });
      }
      changeCountRef.current = 0;
      lastCheckpointTimeRef.current = now;
    }

    // Render the debug scene if the debug canvas is available
    if (debugCanvasRef.current && excalidrawAPI) {
      debugRenderer(
        debugCanvasRef.current,
        appState,
        elements,
        window.devicePixelRatio,
      );
    }
  };

  const [latestShareableLink, setLatestShareableLink] = useState<string | null>(
    null,
  );

  const onExportToBackend = async (
    exportedElements: readonly NonDeletedExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles,
  ) => {
    if (exportedElements.length === 0) {
      throw new Error(t("alerts.cannotExportEmptyCanvas"));
    }
    try {
      const { url, errorMessage } = await exportToBackend(
        exportedElements,
        {
          ...appState,
          viewBackgroundColor: appState.exportBackground
            ? appState.viewBackgroundColor
            : getDefaultAppState().viewBackgroundColor,
        },
        files,
      );

      if (errorMessage) {
        throw new Error(errorMessage);
      }

      if (url) {
        setLatestShareableLink(url);
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        const { width, height } = appState;
        console.error(error, {
          width,
          height,
          devicePixelRatio: window.devicePixelRatio,
        });
        throw new Error(error.message);
      }
    }
  };

  const renderCustomStats = (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: UIAppState,
  ) => {
    return (
      <CustomStats
        setToast={(message) => excalidrawAPI!.setToast({ message })}
        appState={appState}
        elements={elements}
      />
    );
  };

  const isOffline = useAtomValue(isOfflineAtom);

  const localStorageQuotaExceeded = useAtomValue(localStorageQuotaExceededAtom);

  const onCollabDialogOpen = useCallback(
    () => setShareDialogState({ isOpen: true, type: "collaborationOnly" }),
    [setShareDialogState],
  );

  // ---------------------------------------------------------------------------
  // onExport — intercepts file save to wait for pending image loads
  // ---------------------------------------------------------------------------
  const onExport: Required<ExcalidrawProps>["onExport"] = useCallback(
    async function* () {
      let snapshot = FileStatusStore.getSnapshot();
      const { pending, total } = FileStatusStore.getPendingCount(
        snapshot.value,
      );
      if (pending === 0) {
        return;
      }

      // Yield initial progress
      yield {
        type: "progress",
        progress: (total - pending) / total,
        message: `Loading images (${total - pending}/${total})...`,
      };

      // Wait for all pending images to finish
      while (true) {
        snapshot = await FileStatusStore.pull(snapshot.version);
        const { pending: nowPending, total: nowTotal } =
          FileStatusStore.getPendingCount(snapshot.value);

        yield {
          type: "progress",
          progress: (nowTotal - nowPending) / nowTotal,
          message: `Loading images (${nowTotal - nowPending}/${nowTotal})...`,
        };

        if (nowPending === 0) {
          await new Promise((r) => setTimeout(r, 500));
          yield {
            type: "progress",
            message: `Preparing export...`,
          };
          return;
        }
      }
    },
    [],
  );

  // const onExport = () => {
  //   return new Promise((r) => setTimeout(r, 2500));
  //   // console.log("onExport");
  // };

  // browsers generally prevent infinite self-embedding, there are
  // cases where it still happens, and while we disallow self-embedding
  // by not whitelisting our own origin, this serves as an additional guard
  if (isSelfEmbedding) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          height: "100%",
        }}
      >
        <h1>I'm not a pretzel!</h1>
      </div>
    );
  }

  return (
    <div
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
      className={clsx("excalidraw-app", {
        "is-collaborating": isCollaborating,
        "theme--dark": editorTheme === THEME.DARK,
      })}
    >
      <BoardTabs
        boards={boards.filter((b) => !closedBoardIds.includes(b.id))}
        activeBoardId={activeBoardId}
        renamingBoardId={renamingBoardId}
        collapsed={tabBarCollapsed}
        onSwitch={switchBoard}
        onAdd={handleAddBoard}
        onRename={handleRenameBoard}
        onDuplicate={handleDuplicateBoard}
        onClose={handleCloseBoard}
        onSetRenaming={setRenamingBoardId}
        onToggleCollapse={handleToggleTabBar}
        onOpenGallery={() => setGalleryOpen(true)}
      />
      {galleryOpen && (
        <BoardGallery
          boards={boards}
          activeBoardId={activeBoardId}
          closedBoardIds={closedBoardIds}
          onSelect={(id) => {
            if (closedBoardIds.includes(id)) {
              handleReopenBoard(id);
            }
            switchBoard(id);
          }}
          onClose={() => setGalleryOpen(false)}
          onAdd={handleAddBoard}
          onRename={handleRenameBoard}
          onDelete={handleDeleteBoardWithConfirm}
          onDuplicate={handleDuplicateBoard}
          onReopen={handleReopenBoard}
        />
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Excalidraw
          onChange={onChange}
          onExport={onExport}
          initialData={initialStatePromiseRef.current.promise}
          isCollaborating={isCollaborating}
          onPointerUpdate={collabAPI?.onPointerUpdate}
          UIOptions={{
            canvasActions: {
              toggleTheme: true,
              export: {
                onExportToBackend,
              },
            },
          }}
          langCode={langCode}
          renderCustomStats={renderCustomStats}
          detectScroll={false}
          handleKeyboardGlobally={true}
          autoFocus={true}
          theme={editorTheme}
          renderTopRightUI={(isMobile) => {
            if (isMobile || !collabAPI || isCollabDisabled) {
              return null;
            }

            return (
              <div className="excalidraw-ui-top-right">
                {collabError.message && (
                  <CollabError collabError={collabError} />
                )}
                <LiveCollaborationTrigger
                  isCollaborating={isCollaborating}
                  onSelect={() =>
                    setShareDialogState({ isOpen: true, type: "share" })
                  }
                  editorInterface={editorInterface}
                />
              </div>
            );
          }}
          onLinkOpen={(element, event) => {
            if (element.link && isElementLink(element.link)) {
              event.preventDefault();
              excalidrawAPI?.scrollToContent(element.link, { animate: true });
            }
          }}
        >
          <AppMainMenu
            onCollabDialogOpen={onCollabDialogOpen}
            isCollaborating={isCollaborating}
            isCollabEnabled={!isCollabDisabled}
            theme={appTheme}
            setTheme={(theme) => setAppTheme(theme)}
            refresh={() => forceRefresh((prev) => !prev)}
          />
          <AppWelcomeScreen
            onCollabDialogOpen={onCollabDialogOpen}
            isCollabEnabled={!isCollabDisabled}
          />
          <OverwriteConfirmDialog>
            <OverwriteConfirmDialog.Actions.ExportToImage />
            <OverwriteConfirmDialog.Actions.SaveToDisk />
          </OverwriteConfirmDialog>
          <AppFooter onChange={() => excalidrawAPI?.refresh()} />
          {excalidrawAPI && <AIComponents excalidrawAPI={excalidrawAPI} />}

          <TTDDialogTrigger />
          {isCollaborating && isOffline && (
            <div className="alertalert--warning">
              {t("alerts.collabOfflineWarning")}
            </div>
          )}
          {localStorageQuotaExceeded && (
            <div className="alert alert--danger">
              {t("alerts.localStorageQuotaExceeded")}
            </div>
          )}
          {latestShareableLink && (
            <ShareableLinkDialog
              link={latestShareableLink}
              onCloseRequest={() => setLatestShareableLink(null)}
              setErrorMessage={setErrorMessage}
            />
          )}
          {excalidrawAPI && !isCollabDisabled && (
            <Collab excalidrawAPI={excalidrawAPI} />
          )}

          <ShareDialog
            collabAPI={collabAPI}
            onExportToBackend={async () => {
              if (excalidrawAPI) {
                try {
                  await onExportToBackend(
                    excalidrawAPI.getSceneElements(),
                    excalidrawAPI.getAppState(),
                    excalidrawAPI.getFiles(),
                  );
                } catch (error: any) {
                  setErrorMessage(error.message);
                }
              }
            }}
          />

          <AppSidebar />

          {errorMessage && (
            <ErrorDialog onClose={() => setErrorMessage("")}>
              {errorMessage}
            </ErrorDialog>
          )}

          <CommandPalette
            customCommandPaletteItems={[
              {
                label: t("labels.liveCollaboration"),
                category: DEFAULT_CATEGORIES.app,
                keywords: [
                  "team",
                  "multiplayer",
                  "share",
                  "public",
                  "session",
                  "invite",
                ],
                icon: usersIcon,
                perform: () => {
                  setShareDialogState({
                    isOpen: true,
                    type: "collaborationOnly",
                  });
                },
              },
              {
                label: t("roomDialog.button_stopSession"),
                category: DEFAULT_CATEGORIES.app,
                predicate: () => !!collabAPI?.isCollaborating(),
                keywords: [
                  "stop",
                  "session",
                  "end",
                  "leave",
                  "close",
                  "exit",
                  "collaboration",
                ],
                perform: () => {
                  if (collabAPI) {
                    collabAPI.stopCollaboration();
                    if (!collabAPI.isCollaborating()) {
                      setShareDialogState({ isOpen: false });
                    }
                  }
                },
              },
              {
                label: t("labels.share"),
                category: DEFAULT_CATEGORIES.app,
                predicate: true,
                icon: share,
                keywords: [
                  "link",
                  "shareable",
                  "readonly",
                  "export",
                  "publish",
                  "snapshot",
                  "url",
                  "collaborate",
                  "invite",
                ],
                perform: async () => {
                  setShareDialogState({ isOpen: true, type: "share" });
                },
              },
              {
                ...CommandPalette.defaultItems.toggleTheme,
                perform: () => {
                  setAppTheme(
                    editorTheme === THEME.DARK ? THEME.LIGHT : THEME.DARK,
                  );
                },
              },
              {
                label: t("labels.installPWA"),
                category: DEFAULT_CATEGORIES.app,
                predicate: () => !!pwaEvent,
                perform: () => {
                  if (pwaEvent) {
                    pwaEvent.prompt();
                    pwaEvent.userChoice.then(() => {
                      // event cannot be reused, but we'll hopefully
                      // grab new one as the event should be fired again
                      pwaEvent = null;
                    });
                  }
                },
              },

              // ---- Weave: Board actions ----
              {
                label: tabBarCollapsed ? "Show board tabs" : "Hide board tabs",
                category: "Boards",
                keywords: ["tab", "bar", "hide", "show", "collapse", "boards"],
                predicate: true as const,
                perform: () => handleToggleTabBar(),
              },
              {
                label: "New board",
                category: "Boards",
                keywords: ["create", "add", "canvas", "tab", "board"],
                predicate: true,
                perform: () => handleAddBoard(),
              },
              {
                label: "Rename current board",
                category: "Boards",
                keywords: ["rename", "title", "board"],
                predicate: true,
                perform: () => setRenamingBoardId(activeBoardId),
              },
              {
                label: "Duplicate current board",
                category: "Boards",
                keywords: ["copy", "clone", "duplicate", "board"],
                predicate: true,
                perform: () => handleDuplicateBoard(activeBoardId),
              },
              // Dynamic: one entry per other open board for quick switching
              ...boards
                .filter(
                  (b) =>
                    b.id !== activeBoardId && !closedBoardIds.includes(b.id),
                )
                .map((b) => ({
                  label: `Switch to: ${b.name}`,
                  category: "Boards",
                  keywords: ["board", "tab", "canvas", "switch", b.name],
                  predicate: true as const,
                  perform: () => switchBoard(b.id),
                })),

              // ---- Weave: Checkpoint restore ----
              ...checkpoints.slice(0, 5).map((cp) => ({
                label: `Restore checkpoint: ${formatRelativeTime(
                  cp.timestamp,
                )}`,
                category: "History",
                keywords: [
                  "undo",
                  "restore",
                  "checkpoint",
                  "revert",
                  "history",
                ],
                predicate: true as const,
                perform: () => {
                  if (excalidrawAPI) {
                    restoreCheckpoint(cp.id, activeBoardId, excalidrawAPI);
                  }
                },
              })),
            ]}
          />
          {isVisualDebuggerEnabled() && excalidrawAPI && (
            <DebugCanvas
              appState={excalidrawAPI.getAppState()}
              scale={window.devicePixelRatio}
              ref={debugCanvasRef}
            />
          )}
        </Excalidraw>
      </div>
    </div>
  );
};

const ExcalidrawApp = () => {
  const isCloudExportWindow =
    window.location.pathname === "/excalidraw-plus-export";
  if (isCloudExportWindow) {
    return <ExcalidrawPlusIframeExport />;
  }

  return (
    <TopErrorBoundary>
      <Provider store={appJotaiStore}>
        <ExcalidrawAPIProvider>
          <ExcalidrawWrapper />
        </ExcalidrawAPIProvider>
      </Provider>
      <Analytics />
    </TopErrorBoundary>
  );
};

export default ExcalidrawApp;
