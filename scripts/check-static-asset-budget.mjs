import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const publicDirectory = resolve(process.cwd(), "public");
const budgetBytes = 200 * 1024 * 1024;

async function measure(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  let total = 0;

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      total += await measure(path);
    } else if (entry.isFile()) {
      total += (await stat(path)).size;
    }
  }

  return total;
}

const totalBytes = await measure(publicDirectory);
const totalMiB = (totalBytes / (1024 * 1024)).toFixed(1);
const budgetMiB = (budgetBytes / (1024 * 1024)).toFixed(0);

console.log("Public assets: " + totalMiB + " MiB / " + budgetMiB + " MiB budget");

if (totalBytes > budgetBytes) {
  console.error("Public asset budget exceeded. Compress images or move large media to managed object storage.");
  process.exitCode = 1;
}
