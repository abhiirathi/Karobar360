"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const flip = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    try { localStorage.setItem("karobar360.theme", d ? "dark" : "light"); } catch {}
  };
  return (
    <button onClick={flip} className="btn btn-quiet btn-sm !px-2.5" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
