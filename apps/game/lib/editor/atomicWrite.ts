// Atomic, backed-up JSON file writes (HM-DATA-EDITOR-0.1, Spec S20-S22).
//
// Strategy:
//   1. serialize the already-validated data (2-space indent, no added
//      trailing newline -- matches the existing source files' exact
//      formatting byte-for-byte, Spec S22),
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

export function serializeJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function atomicWriteJsonFile(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
  const backupPath = `${filePath}.bak`;

  fs.writeFileSync(tmpPath, serializeJson(data), "utf8");

  try {
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath);
    }
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    // Best-effort cleanup of the temp file; the original source file is
    // untouched either way since rename is the only step that replaces it.
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
    throw error;
  }
}
