import { exportToCanvas } from "@excalidraw/excalidraw";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getNonDeletedElements } from "@excalidraw/element";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import { formatRelativeTime } from "../boards/checkpointManager";
import { importBoardFromLocalStorage } from "../data/localStorage";

import "./BoardGallery.scss";

import type { Board } from "../boards/types";

interface BoardGalleryProps {
  boards: Board[];
  activeBoardId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

const generateThumbnail = async (boardId: string): Promise<string | null> => {
  try {
    const data = importBoardFromLocalStorage(boardId);
    const elements = restoreElements(data.elements ?? [], null, {
      repairBindings: true,
      deleteInvisibleElements: true,
    });
    const visible = getNonDeletedElements(elements);
    if (!visible.length) {
      return null;
    }
    const canvas = await exportToCanvas({
      elements: visible,
      appState: {
        exportBackground: true,
        viewBackgroundColor:
          (data.appState as { viewBackgroundColor?: string } | null)
            ?.viewBackgroundColor ?? "#ffffff",
      },
      files: {},
      maxWidthOrHeight: 480,
      exportPadding: 20,
    });
    return canvas.toDataURL();
  } catch {
    return null;
  }
};

const BoardCard = ({
  board,
  isActive,
  onSelect,
  onRename,
  onDelete,
  onDuplicate,
}: {
  board: Board;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(board.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRenameValue(board.name);
  }, [board.name]);

  useEffect(() => {
    let cancelled = false;
    generateThumbnail(board.id).then((url) => {
      if (!cancelled) {
        setThumbnail(url);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [board.id]);

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenaming(true);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      onRename(trimmed);
    } else {
      setRenameValue(board.name);
    }
    setRenaming(false);
  };

  return (
    <div
      className={clsx("board-gallery__card", {
        "board-gallery__card--active": isActive,
      })}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-label={`Open board: ${board.name}`}
    >
      <div className="board-gallery__card-preview">
        {loading ? (
          <div className="board-gallery__card-skeleton" />
        ) : thumbnail ? (
          <img src={thumbnail} alt="" draggable={false} />
        ) : (
          <span className="board-gallery__card-empty-label">Empty board</span>
        )}
      </div>

      <div className="board-gallery__card-footer">
        <div className="board-gallery__card-info">
          {renaming ? (
            <input
              ref={renameInputRef}
              className="board-gallery__card-rename-input"
              value={renameValue}
              autoFocus
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitRename();
                } else if (e.key === "Escape") {
                  setRenameValue(board.name);
                  setRenaming(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="board-gallery__card-name">{board.name}</span>
          )}
          <span className="board-gallery__card-date">
            {formatRelativeTime(board.updatedAt)}
          </span>
        </div>

        <div
          className="board-gallery__card-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="board-gallery__card-action"
            title="Rename"
            onClick={startRename}
          >
            ✎
          </button>
          <button
            className="board-gallery__card-action"
            title="Duplicate"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
          >
            ⎘
          </button>
          <button
            className="board-gallery__card-action board-gallery__card-action--danger"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};

export const BoardGallery = ({
  boards,
  activeBoardId,
  onSelect,
  onClose,
  onAdd,
  onRename,
  onDelete,
  onDuplicate,
}: BoardGalleryProps) => {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const filtered = query.trim()
    ? boards.filter((b) =>
        b.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : boards;

  return (
    <div className="board-gallery__overlay" onClick={onClose}>
      <div
        className="board-gallery"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="All boards"
      >
        <div className="board-gallery__header">
          <h2 className="board-gallery__title">All boards</h2>
          <input
            ref={searchRef}
            className="board-gallery__search"
            type="search"
            placeholder="Search boards…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="board-gallery__new-btn"
            onClick={() => {
              onAdd();
              onClose();
            }}
          >
            + New board
          </button>
          <button
            className="board-gallery__close-btn"
            onClick={onClose}
            aria-label="Close gallery"
          >
            ×
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="board-gallery__empty">
            No boards match &ldquo;{query}&rdquo;
          </div>
        ) : (
          <div className="board-gallery__grid">
            {filtered.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                isActive={board.id === activeBoardId}
                onSelect={() => {
                  onSelect(board.id);
                  onClose();
                }}
                onRename={(name) => onRename(board.id, name)}
                onDelete={() => {
                  onClose();
                  onDelete(board.id);
                }}
                onDuplicate={() => {
                  onDuplicate(board.id);
                  onClose();
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
