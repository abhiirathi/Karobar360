import {
  BadgeCheck, Boxes, Car, ClipboardList, Factory, Flame, Droplets, FileText, Gauge, Hammer, Handshake, Inbox, Landmark, Layers,
  LayoutDashboard, LayoutGrid, Leaf, MapPin, Mountain, Package, Recycle, Route, Scale, Ship, ShieldCheck, Sparkles, Store, Timer,
  TrendingUp, Truck, Users, Wallet, Wrench, Zap, Bot, Workflow, Settings, type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  BadgeCheck, Boxes, Car, ClipboardList, Factory, Flame, Droplets, FileText, Gauge, Hammer, Handshake, Inbox, Landmark, Layers,
  LayoutDashboard, LayoutGrid, Leaf, MapPin, Mountain, Package, Recycle, Route, Scale, Ship, ShieldCheck, Sparkles, Store, Timer,
  TrendingUp, Truck, Users, Wallet, Wrench, Zap, Bot, Workflow, Settings,
};

export default function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const C = MAP[name] ?? LayoutGrid;
  return <C size={size} className={className} strokeWidth={1.8} aria-hidden="true" />;
}
