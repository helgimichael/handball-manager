import type { BoardCommand, BoardContext, CommandMetadata, CommandOrigin } from "./BoardCommand.ts";
import { createCommandMetadata } from "./BoardCommand.ts";

export default class CompositeCommand implements BoardCommand {
  readonly metadata: CommandMetadata;
  private readonly commands: readonly BoardCommand[];

  constructor(label: string, commands: readonly BoardCommand[], origin: CommandOrigin = "USER") {
    this.metadata = createCommandMetadata(label, origin);
    this.commands = Object.freeze([...commands]);
  }

  get size(): number {
    return this.commands.length;
  }

  execute(context: BoardContext): void {
    for (const command of this.commands) {
      command.execute(context);
    }
  }

  undo(context: BoardContext): void {
    for (let index = this.commands.length - 1; index >= 0; index -= 1) {
      this.commands[index].undo(context);
    }
  }

  redo(context: BoardContext): void {
    for (const command of this.commands) {
      command.redo(context);
    }
  }
}
