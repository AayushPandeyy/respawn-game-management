"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, BarChart3, Bookmark, Check, Compass, Gamepad2, Library, List, LogOut, NotebookPen, Radio, Star, Trophy, Users } from "lucide-react";
import Brand from "./brand";
import type { Entry, User } from "@/lib/types";

const links = [["/diary", "Gaming diary", NotebookPen], ["/feed", "Activity feed", Radio], ["/players", "Find players", Users], ["/reviews", "Public reviews", Star], ["/lists", "Custom lists", List], ["/stats", "Statistics", BarChart3], ["/achievements", "Achievements", Trophy], ["/", "Discover", Compass], ["/?view=library", "My library", Library], ["/?view=journal", "My journal", NotebookPen]] as const;

export default function AppSidebar({ user = null, entries = [] }: { user?: User | null; entries?: Entry[] }) {
  const pathname = usePathname();
  const count = (status: Entry["status"]) => entries.filter((entry) => entry.status === status).length;
  const isActive = (href: string) => {
    const route = href.split("?")[0];
    if (href.includes("view=")) return false;
    return route === "/" ? pathname === "/" : pathname.startsWith(route);
  };
  return (
    <aside className="sidebar app-sidebar">
      <Brand />
      <div className="sidebar-inner">
        <span className="nav-label">YOUR CORNER OF THE GAME WORLD</span>
        <nav aria-label="Main navigation">
          {links.map(([href, label, Icon]) => (
            <Link className={isActive(href) ? "nav-item active" : "nav-item"} href={href} key={href}>
              <Icon size={19} />
              <span>{label}</span>
              {href === "/?view=library" && <small>{entries.length}</small>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-collection">
          <span className="nav-label">YOUR COLLECTION</span>
          <Link href="/?view=library&shelf=playing"><Gamepad2 size={17} /><span>Playing</span><b>{count("playing")}</b></Link>
          <Link href="/?view=library&shelf=completed"><Check size={17} /><span>Completed</span><b>{count("completed")}</b></Link>
          <Link href="/?view=library&shelf=wishlist"><Bookmark size={17} /><span>Want to play</span><b>{count("wishlist")}</b></Link>
        </div>
        <div className="sidebar-note">
          <div className="tiny-mark">✳</div>
          <h3>
            Good games.
            <br />
            Great memories.
          </h3>
          <p>A little space for your ever-growing backlog.</p>
          {!user && <Link href="/signup">Start your collection <ArrowUpRight size={14} /></Link>}
        </div>
        <div className="sidebar-bottom">
          {user ? <>
            <Link className="avatar" href="/profile" aria-label="My profile">{user.name.slice(0, 1).toUpperCase()}</Link>
            <div><b>{user.name}</b><small>Player one</small></div>
            <button className="icon-button" title="Log out" aria-label="Log out" onClick={async () => {
              const result = await fetch("/api/auth/logout", { method: "POST" });
              if (result.ok) window.location.assign("/");
            }}><LogOut size={17} /></button>
          </> : <>
            <span className="guest-avatar"><Gamepad2 size={21} /></span>
            <div><b>Player one?</b><Link href="/login">Sign in to your account</Link></div>
          </>}
        </div>
      </div>
    </aside>
  );
}

