import { useRef, useState } from "react";
import clsx from "clsx";

import "./BoardTabs.scss";

import type { Board } from "../boards/types";

interface BoardTabsProps {
  boards: Board[];
  activeBoardId: string;
  renamingBoardId: string | null;
  collapsed: boolean;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onClose: (id: string) => void;
  onSetRenaming: (id: string | null) => void;
  onToggleCollapse: () => void;
  onOpenGallery: () => void;
}

const GridIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 13 13"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect x="0.5" y="0.5" width="5" height="5" rx="1" fill="currentColor" />
    <rect x="7.5" y="0.5" width="5" height="5" rx="1" fill="currentColor" />
    <rect x="0.5" y="7.5" width="5" height="5" rx="1" fill="currentColor" />
    <rect x="7.5" y="7.5" width="5" height="5" rx="1" fill="currentColor" />
  </svg>
);

export const BoardTabs = ({
  boards,
  activeBoardId,
  renamingBoardId,
  collapsed,
  onSwitch,
  onAdd,
  onRename,
  onDuplicate,
  onClose,
  onSetRenaming,
  onToggleCollapse,
  onOpenGallery,
}: BoardTabsProps) => {
  const [contextMenu, setContextMenu] = useState<{
    boardId: string;
    x: number;
    y: number;
  } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const handleDoubleClick = (id: string) => {
    onSetRenaming(id);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const commitRename = (id: string, value: string) => {
    onRename(id, value);
    onSetRenaming(null);
  };

  const handleContextMenu = (e: React.MouseEvent, boardId: string) => {
    e.preventDefault();
    setContextMenu({ boardId, x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  if (collapsed) {
    return (
      <div
        className="board-tabs__peek"
        onClick={onToggleCollapse}
        title="Show board tabs"
        role="button"
        aria-label="Show board tabs"
      />
    );
  }

  return (
    <>
      <div className="board-tabs" role="tablist" aria-label="Boards">
        {boards.map((board) => (
          <div
            key={board.id}
            role="tab"
            aria-selected={board.id === activeBoardId}
            className={clsx("board-tab", {
              "board-tab--active": board.id === activeBoardId,
            })}
            onClick={() => {
              if (renamingBoardId !== board.id) {
                onSwitch(board.id);
              }
            }}
            onDoubleClick={() => handleDoubleClick(board.id)}
            onContextMenu={(e) => handleContextMenu(e, board.id)}
          >
            {renamingBoardId === board.id ? (
              <input
                ref={renameInputRef}
                className="board-tab__rename-input"
                defaultValue={board.name}
                autoFocus
                onBlur={(e) => commitRename(board.id, e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitRename(board.id, e.currentTarget.value);
                  } else if (e.key === "Escape") {
                    onSetRenaming(null);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="board-tab__name">{board.name}</span>
            )}
          </div>
        ))}
        <button
          className="board-tab board-tab--add"
          aria-label="New board"
          title="New board"
          onClick={onAdd}
        >
          +
        </button>
        <button
          className="board-tabs__toggle"
          onClick={onOpenGallery}
          title="All boards"
          aria-label="All boards"
        >
          <GridIcon />
        </button>
        <button
          className="board-tabs__toggle"
          onClick={onToggleCollapse}
          title="Collapse board tabs"
          aria-label="Collapse board tabs"
        >
          ⌃
        </button>
      </div>

      {contextMenu && (
        <>
          <div
            className="board-tabs__context-overlay"
            onClick={closeContextMenu}
          />
          <ul
            className="board-tabs__context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <li
              onClick={() => {
                onSetRenaming(contextMenu.boardId);
                closeContextMenu();
              }}
            >
              Rename
            </li>
            <li
              onClick={() => {
                onDuplicate(contextMenu.boardId);
                closeContextMenu();
              }}
            >
              Duplicate
            </li>
            <li
              className="board-tabs__context-menu-item--close"
              onClick={() => {
                onClose(contextMenu.boardId);
                closeContextMenu();
              }}
            >
              Close
            </li>
          </ul>
        </>
      )}
    </>
  );
};
