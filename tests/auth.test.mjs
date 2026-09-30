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
    "@/lib/auth-destination": relative === "lib/auth-destination.ts" ? {} : await load("lib/auth-destination.ts", null),
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
test("Google OAuth starts a PKCE flow with a safe destination", async () => {
  let options;
  const module = await load(route, { auth: {
    signInWithOAuth: async (value) => {
      options = value;
      return { data: { url: "https://example.supabase.co/auth/v1/authorize?provider=google" }, error: null };
    },
  } });
  const response = await call(module, "google", req({ next: "/achievements" }));
  assert.equal(response.status, 200);
  assert.equal(options.provider, "google");
  assert.equal(options.options.skipBrowserRedirect, true);
  const callback = new URL(options.options.redirectTo);
  assert.equal(callback.origin, "https://respawn.test");
  assert.equal(callback.searchParams.get("flow"), "google");
  assert.equal(callback.searchParams.get("next"), "/achievements");
  assert.ok((await response.json()).url.includes("provider=google"));
  await call(module, "google", req({ next: "//evil.test" }));
  assert.equal(new URL(options.options.redirectTo).searchParams.get("next"), "/dashboard");
  assert.equal((await call(module, "google", req({}, "https://evil.test"))).status, 403);
});
test("Google provider errors are safe and missing config is handled", async () => {
  const module = await load(route, { auth: {
    signInWithOAuth: async () => ({ data: { url: null }, error: { message: "internal secret" } }),
  } });
  const response = await call(module, "google", req({}));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("internal secret"));
  const unconfigured = await load(route, null);
  assert.equal((await call(unconfigured, "google", req({}))).status, 503);
});
test("Google callback returns to intended page and handles cancelled sign-in", async () => {
  const module = await load("app/auth/callback/route.ts", { auth: {
    exchangeCodeForSession: async () => ({ error: null }),
  } });
  const success = await module.GET(new Request("https://respawn.test/auth/callback?flow=google&code=abc&next=/achievements"));
  assert.equal(success.headers.get("location"), "https://respawn.test/achievements");
  const cancelled = await module.GET(new Request("https://respawn.test/auth/callback?flow=google&error=access_denied&next=/lists"));
  const location = new URL(cancelled.headers.get("location"));
  assert.equal(location.pathname, "/login");
  assert.equal(location.searchParams.get("oauth"), "failed");
  assert.equal(location.searchParams.get("next"), "/lists");
});
test("recovery email uses PKCE callback and hides account existence", async () => {
  let received;
  const module = await load(route, { auth: { resetPasswordForEmail: async (...args) => {
    received = args; return { error: null };
  } } });
  const response = await call(module, "forgot-password", req({ email: " Player@example.test " }));
  assert.equal(response.status, 200);
  assert.equal(received[0], "player@example.test");
  assert.equal(received[1].redirectTo, "https://respawn.test/auth/callback?flow=recovery");
  const missing = await load(route, { auth: { resetPasswordForEmail: async () => ({ error: { code: "user_not_found", status: 400 } }) } });
  assert.deepEqual(await (await call(missing, "forgot-password", req({ email: "absent@example.test" }))).json(), { ok: true });
  assert.equal((await call(module, "forgot-password", req({ email: "bad" }))).status, 400);
  assert.equal((await call(module, "forgot-password", req({ email: "a@b.test" }, "https://evil.test"))).status, 403);
});
test("recovery email handles provider throttling and outages", async () => {
  for (const status of [429, 503]) {
    const module = await load(route, { auth: { resetPasswordForEmail: async () => ({ error: { status } }) } });
    assert.equal((await call(module, "forgot-password", req({ email: "a@b.test" }))).status, status);
  }
});
test("password update requires a verified session and matching valid passwords", async () => {
  let updated = false;
  const provider = { auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    updateUser: async () => { updated = true; return { error: null }; },
  } };
  const module = await load(route, provider);
  const body = { password: "a-new-password", confirmPassword: "a-new-password" };
  assert.equal((await call(module, "reset-password", req(body))).status, 401);
  assert.equal(updated, false);
  provider.auth.getUser = async () => ({ data: { user: { id: "verified" } }, error: null });
  for (const changes of [{ password: "short" }, { confirmPassword: "different" }, { password: "x".repeat(129) }]) {
    assert.equal((await call(module, "reset-password", req({ ...body, ...changes }))).status, 400);
  }
  assert.equal(updated, false);
  assert.equal((await call(module, "reset-password", req(body))).status, 200);
  assert.equal(updated, true);
});
test("password update reports weak and reused passwords without exposing provider messages", async () => {
  for (const [code, status] of [["weak_password", 400], ["same_password", 400], ["other", 400]]) {
    const module = await load(route, { auth: {
      getUser: async () => ({ data: { user: { id: "verified" } }, error: null }),
      updateUser: async () => ({ error: { code, message: "private provider detail" } }),
    } });
    const response = await call(module, "reset-password", req({ password: "a-new-password", confirmPassword: "a-new-password" }));
    assert.equal(response.status, status);
    assert.ok(!(await response.text()).includes("private provider detail"));
  }
});
test("recovery callback routes success to password form and expired links to retry", async () => {
  for (const success of [true, false]) {
    const module = await load("app/auth/callback/route.ts", { auth: {
      exchangeCodeForSession: async () => ({ error: success ? null : {} }),
    } });
    const response = await module.GET(new Request("https://respawn.test/auth/callback?flow=recovery&code=test&next=https://evil.test"));
    assert.equal(response.headers.get("location"), "https://respawn.test" + (success ? "/reset-password" : "/forgot-password?expired=1"));
  }
  const module = await load("app/auth/callback/route.ts", null);
  assert.equal((await module.GET(new Request("https://respawn.test/auth/callback?flow=recovery"))).headers.get("location"), "https://respawn.test/forgot-password?expired=1");
});
test("existing shorter passwords can log in but cannot be used at signup", async () => {
  const module = await load(route, { auth: {
    signInWithPassword: async () => ({ data: { session: {} }, error: null }),
  } });
  assert.equal((await call(module, "login", req({ ...input, password: "short" }))).status, 200);
  assert.equal((await call(module, "signup", req({ ...input, password: "short" }))).status, 400);
});
test("return destinations reject external URLs, encoded paths, and traversal", async () => {
  const { authDestination } = await load("lib/auth-destination.ts", null);
  for (const value of ["https://evil.test", "//evil.test", "/%2f%2fevil.test", "/games/../../login", "/login", "/api/auth/logout", null])
    assert.equal(authDestination(value), "/dashboard");
  for (const value of ["/achievements", "/lists/123", "/?view=library", "/diary", "/import/steam"])
    assert.equal(authDestination(value), value);
});
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
