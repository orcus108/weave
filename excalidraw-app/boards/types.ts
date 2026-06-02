export type Board = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type Checkpoint = {
  id: string;
  boardId: string;
  timestamp: number;
  elements: string;
};
