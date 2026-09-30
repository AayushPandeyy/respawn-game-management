export function authDestination(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\s%]/.test(value))
    return "/dashboard";
  const path = value.split(/[?#]/)[0];
  if (path.split("/").some((part) => part === "." || part === "..")) return "/dashboard";
  if (path === "/import/steam") return value;
  if (!/^\/(dashboard|achievements|diary|feed|players|profile|reviews|lists|stats|games|notifications|u)(\/|$)/.test(path) && path !== "/")
    return "/dashboard";
  return value;
}
