import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";
import { NextResponse } from "next/server.js";

// Exercise the actual route source against controlled provider responses.
// No network requests, email sends, real accounts, or environment keys required.
async function load(relative, supabase) {
  const context = vm.createContext({ URL, Request, Response, console });
  const source = await readFile(
    new URL("../" + relative, import.meta.url),
    "utf8",
  );
  const outputText = stripTypeScriptTypes(source);
  const deps = {
    "next/server": { NextResponse },
    "next/headers": { cookies: async () => ({ delete() {} }) },
    "@/lib/auth": {
      sameOrigin: (r) => r.headers.get("origin") === "https://respawn.test",
      requestOrigin: () => "https://respawn.test",
    },
    "@/lib/supabase/server": { createClient: async () => supabase },
    "@/lib/supabase/config": {
      missingAuthMessage: "Sign-in is not configured yet.",
    },
  };
  const module = new vm.SourceTextModule(outputText, { context });
  await module.link((name) => {
    assert.ok(deps[name], `Unexpected dependency: ${name}`);
    return new vm.SyntheticModule(
      Object.keys(deps[name]),
      function () {
        for (const [key, value] of Object.entries(deps[name]))
          this.setExport(key, value);
      },
      { context },
    );
  });
  await module.evaluate();
  return module.namespace;
}
const route = "app/api/auth/[action]/route.ts";
const input = {
  email: "player@example.test",
  password: "Test-password-42",
  name: "Player One",
};
const req = (body = input, origin = "https://respawn.test") =>
  new Request("https://respawn.test/api/auth/signup", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const call = (module, action, request = req()) =>
  module.POST(request, { params: Promise.resolve({ action }) });

test("missing configuration returns 503 and cross-origin requests are rejected", async () => {
  const module = await load(route, null);
  assert.equal((await call(module, "signup")).status, 503);
  assert.equal(
    (await call(module, "login", req(input, "https://evil.test"))).status,
    403,
  );
  assert.equal((await call(module, "unknown")).status, 404);
});
test("signup passes name and callback, and requires confirmation without a session", async () => {
  let received;
  const module = await load(route, {
    auth: {
      signUp: async (value) => {
        received = value;
        return { data: { session: null }, error: null };
      },
    },
  });
  const response = await call(module, "signup");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).needsConfirmation, true);
  assert.equal(received.options.data.name, "Player One");
  assert.equal(
    received.options.emailRedirectTo,
    "https://respawn.test/auth/callback",
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("login and signup with sessions allow dashboard navigation", async () => {
  const result = async () => ({
    data: { session: { access_token: "test" } },
    error: null,
  });
  const module = await load(route, {
    auth: { signInWithPassword: result, signUp: result },
  });
  for (const action of ["login", "signup"])
    assert.equal(
      (await (await call(module, action)).json()).needsConfirmation,
      false,
    );
});
test("validation rejects invalid fields before contacting Supabase", async () => {
  const module = await load(route, {
    auth: {
      signUp: () => {
        throw Error("Must not be called");
      },
    },
  });
  for (const data of [
    { ...input, name: "x" },
    { ...input, email: "bad" },
    { ...input, password: "short" },
  ])
    assert.equal((await call(module, "signup", req(data))).status, 400);
});
test("provider errors produce safe actionable responses", async () => {
  for (const [error, status, fragment] of [
    [{ status: 429 }, 429, "Too many"],
    [{ code: "email_not_confirmed" }, 401, "confirm your email"],
    [
      { code: "invalid_credentials", message: "provider internals" },
      401,
      "Unable to sign in",
    ],
  ]) {
    const module = await load(route, {
      auth: { signInWithPassword: async () => ({ data: {}, error }) },
    });
    const response = await call(module, "login");
    assert.equal(response.status, status);
    const text = await response.text();
    assert.ok(text.includes(fragment));
    assert.ok(!text.includes("provider internals"));
  }
});
test("logout uses current-device scope and propagates provider failures", async () => {
  let scope;
  const module = await load(route, {
    auth: {
      signOut: async (options) => {
        scope = options.scope;
        return { error: null };
      },
    },
  });
  assert.equal((await call(module, "logout")).status, 200);
  assert.equal(scope, "local");
  const failure = await load(route, {
    auth: { signOut: async () => ({ error: {} }) },
  });
  assert.equal((await call(failure, "logout")).status, 502);
});
test("callback exchanges code and uses a fixed local destination", async () => {
  let code;
  const module = await load("app/auth/callback/route.ts", {
    auth: {
      exchangeCodeForSession: async (value) => {
        code = value;
        return { error: null };
      },
    },
  });
  const response = await module.GET(
    new Request(
      "https://respawn.test/auth/callback?code=abc&next=https://evil.test",
    ),
  );
  assert.equal(code, "abc");
  assert.equal(
    response.headers.get("location"),
    "https://respawn.test/dashboard",
  );
  const missing = await module.GET(
    new Request("https://respawn.test/auth/callback"),
  );
  assert.equal(
    missing.headers.get("location"),
    "https://respawn.test/login?confirmation=failed",
  );
  const bad = await load("app/auth/callback/route.ts", {
    auth: { exchangeCodeForSession: async () => ({ error: {} }) },
  });
  assert.equal(
    (
      await bad.GET(
        new Request("https://respawn.test/auth/callback?code=expired"),
      )
    ).headers.get("location"),
    "https://respawn.test/login?confirmation=failed",
  );
});
