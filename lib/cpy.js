import { copyFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

export default async function cpy(src, dest) {
  await mkdir(dest, { recursive: true });

  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      await cpy(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}
