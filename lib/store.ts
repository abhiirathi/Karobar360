"use client";
import type { Blueprint } from "./types";
import { PRESETS } from "./presets";
import { rulesBlueprint } from "./rules";

const KEY = "karobar360.v1.workspaces";

function read(): Record<string, Blueprint> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function write(all: Record<string, Blueprint>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked — keep in memory */
  }
}

const memory: Record<string, Blueprint> = {};

export function demoBlueprint(id: string): Blueprint | null {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return null;
  const bp = rulesBlueprint(p.intake);
  return { ...bp, id: p.id, createdAt: Date.UTC(2026, 9, 1) };
}

export function listWorkspaces(): Blueprint[] {
  const all = { ...read(), ...memory };
  return Object.values(all).sort((a, b) => b.createdAt - a.createdAt);
}

export function getWorkspace(id: string): Blueprint | null {
  const all = { ...read(), ...memory };
  return all[id] ?? demoBlueprint(id);
}

export function saveWorkspace(bp: Blueprint) {
  memory[bp.id] = bp;
  const all = read();
  all[bp.id] = bp;
  write(all);
}

export function deleteWorkspace(id: string) {
  delete memory[id];
  const all = read();
  delete all[id];
  write(all);
}
