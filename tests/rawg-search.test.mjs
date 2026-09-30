import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";

test("RAWG searches ignore prior genre filters and rank an exact game title first", async () => {
  const source = stripTypeScriptTypes(
    await readFile(new URL("../lib/rawg.ts", import.meta.url), "utf8"),
  );
  const context = vm.createContext({
    process: { env: { RAWG_API_KEY: "test-key" } },
    URLSearchParams,
    AbortSignal,
    fetch: async (url) => {
      const parsed = new URL(url);
      assert.equal(parsed.searchParams.get("search"), "Bloody Roar 2");
      assert.equal(parsed.searchParams.get("genres"), null);
      assert.equal(parsed.searchParams.get("ordering"), null);
      return Response.json({
        results: [
          { id: 9, name: "Bloody Roar", rating: 3, genres: [] },
          { id: 4981, name: "Bloody Roar 2", rating: 4, genres: [] },
          { id: 10, name: "A different title", rating: 5, genres: [] },
        ],
      });
    },
  });
  const fallback = new vm.SyntheticModule(
    ["default"],
    function () {
      this.setExport("default", []);
    },
    { context },
  );
  const react = new vm.SyntheticModule(
    ["cache"],
    function () {
      this.setExport("cache", (fn) => fn);
    },
    { context },
  );
  const module = new vm.SourceTextModule(source, { context });
  await module.link((name) => (name === "react" ? react : fallback));
  await module.evaluate();
  const result = await module.namespace.games("  Bloody Roar 2  ", "action");
  assert.equal(result.offline, false);
  assert.equal(result.games[0].id, 4981);
});
