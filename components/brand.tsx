import { Gamepad2 } from "lucide-react";
import Link from "next/link";
export default function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Respawn home">
      <span className="brand-icon">
        <Gamepad2 size={24} strokeWidth={2.5} />
      </span>
      respawn<span className="brand-dot">.</span>
    </Link>
  );
}
