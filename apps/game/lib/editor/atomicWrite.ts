// Atomic, backed-up JSON file writes (HM-DATA-EDITOR-0.1, Spec S20-S22).
//
// Strategy:
//   1. serialize the already-validated data (2-space indent), then
//      re-apply the TARGET FILE'S OWN newline-at-EOF style so the write
//      is byte-for-byte minimal (Spec S22). The canonical data set is
//      not uniform on this -- see endsWithNewline below.
//   2. write it to a temp file in the SAME directory (same filesystem
//      volume, required for the rename below to be atomic),
//   3. back up the current on-disk file to `<file>.bak` (one backup per
//      file, overwritten on each save -- the smallest safe approach,
//      Spec S21; never spam timestamped copies),
//   4. fs.renameSync from temp to the real path -- on both POSIX and
//      NTFS this replaces the destination as a single filesystem
//      operation, so a reader/crash never observes a partially-written
//      file.
// The backup happens AFTER the temp file is fully written and BEFORE
// the rename, so a failure while writing the temp file leaves the
// original completely untouched (Spec S36).
import fs from "node:fs";
import path from "node:path";
import { clearDefaultCatalogCache } from "./catalog";

export function serializeJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Whether the file already on disk ends with a newline. The canonical
 * data set is NOT uniform -- 508 files end with one and 319 do not -- so
 * serializing without it turned every save into a whole-file byte change
 * on the majority of files. Each file's own existing style is preserved
 * instead; the repository is never normalized. A file that does not yet
 * exist gets no trailing newline, matching serializeJson's own output.
 */
function endsWithNewline(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const fd = fs.openSync(filePath, "r");
  try {
    const size = fs.fstatSync(fd).size;
    if (size === 0) return false;
    const last = Buffer.alloc(1);
    fs.readSync(fd, last, 0, 1, size - 1);
    return last[0] === 0x0a; // "\n"
  } finally {
    fs.closeSync(fd);
  }
}

export function atomicWriteJsonFile(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
  const backupPath = `${filePath}.bak`;
  const trailingNewline = endsWithNewline(filePath) ? "\n" : "";

  fs.writeFileSync(tmpPath, serializeJson(data) + trailingNewline, "utf8");

  try {
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath);
    }
    fs.renameSync(tmpPath, filePath);
    clearDefaultCatalogCache();
  } catch (error) {
    // Best-effort cleanup of the temp file; the original source file is
    // untouched either way since rename is the only step that replaces it.
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
    throw error;
  }
}
