import type { BoardCommand, BoardContext, CommandOrigin } from "./BoardCommand.ts";
import CompositeCommand from "./CompositeCommand.ts";

type HistoryListener = () => void;

type Transaction = {
  label: string;
  origin: CommandOrigin;
  commands: BoardCommand[];
};

export default class HistoryManager {
  private readonly maxEntries: number;
  private undoStack: BoardCommand[] = [];
  private redoStack: BoardCommand[] = [];
  private listeners = new Set<HistoryListener>();
  private transaction: Transaction | null = null;

  constructor(maxEntries = 100) {
    this.maxEntries = maxEntries;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  subscribe(listener: HistoryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispatch(command: BoardCommand, context: BoardContext): void {
    command.execute(context);
    if (this.transaction) {
      this.transaction.commands.push(command);
      return;
    }
    this.pushUndo(command);
    this.redoStack = [];
    this.emit();
  }

  undo(context: BoardContext): void {
    const command = this.undoStack.pop();
    if (!command) {
      return;
    }
    command.undo(context);
    this.redoStack.push(command);
    this.emit();
  }

  redo(context: BoardContext): void {
    const command = this.redoStack.pop();
    if (!command) {
      return;
    }
    command.redo(context);
    this.pushUndo(command);
    this.emit();
  }

  beginTransaction(label: string, origin: CommandOrigin = "USER"): void {
    if (this.transaction) {
      throw new Error("A board command transaction is already active.");
    }
    this.transaction = { label, origin, commands: [] };
  }

  commitTransaction(): void {
    const transaction = this.transaction;
    if (!transaction) {
      return;
    }
    this.transaction = null;
    if (transaction.commands.length === 0) {
      return;
    }
    const command = new CompositeCommand(transaction.label, transaction.commands, transaction.origin);
    this.pushUndo(command);
    this.redoStack = [];
    this.emit();
  }

  cancelTransaction(context: BoardContext): void {
    const transaction = this.transaction;
    if (!transaction) {
      return;
    }
    this.transaction = null;
    for (let index = transaction.commands.length - 1; index >= 0; index -= 1) {
      transaction.commands[index].undo(context);
    }
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.transaction = null;
    this.emit();
  }

  private pushUndo(command: BoardCommand): void {
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxEntries) {
      this.undoStack.splice(0, this.undoStack.length - this.maxEntries);
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
