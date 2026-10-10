import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mockupPreviewPlugin } from "../mockupPreviewPlugin.ts";

test("mockup discovery preserves filtering and rescans additions/removals", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mockup-discovery-"));
  const mockups = path.join(root, "src/components/mockups");
  const generated = path.join(root, "src/.generated/mockup-components.ts");
  const files = [
    "Card.tsx",
    "nested/Row.tsx",
    "nested/Space name.tsx",
    "_private.tsx",
    "_internal/Hidden.tsx",
    "nested/_internal/Hidden.tsx",
    "nested/_helper.tsx",
    ".hidden.tsx",
    "notes.txt",
  ];

  try {
    for (const file of files) {
      await mkdir(path.dirname(path.join(mockups, file)), { recursive: true });
      await writeFile(path.join(mockups, file), "");
    }
    const plugin = mockupPreviewPlugin();
    plugin.configResolved({ root });
    await plugin.buildStart();
    const source = await readFile(generated, "utf8");
    for (const file of files.slice(0, 3)) {
      assert.ok(source.includes(JSON.stringify(`./components/mockups/${file}`)));
      assert.ok(source.includes(JSON.stringify(`../components/mockups/${file}`)));
    }
    for (const file of files.slice(3)) {
      assert.ok(!source.includes(file), `${file} must not be a preview target`);
    }

    await rm(path.join(mockups, "Card.tsx"));
    await writeFile(path.join(mockups, "New.tsx"), "");
    await plugin.buildStart();
    const refreshed = await readFile(generated, "utf8");
    assert.ok(!refreshed.includes("Card.tsx"));
    assert.ok(refreshed.includes("./components/mockups/New.tsx"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
