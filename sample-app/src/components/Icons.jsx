import {
  LayoutDashboard, Grid2x2, Camera, Video, Menu, X,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Trash2, Play, Square, Maximize, Minimize, VideoOff,
  Plus, Monitor, Activity, Wifi, Cpu, Cctv,
  Circle, Radio, BookOpen, CheckCircle, Smartphone, ArrowRight,
} from 'lucide-react';

const MAP = {
  dashboard:    LayoutDashboard,
  grid:         Grid2x2,
  camera:       Camera,
  video:        Video,
  menu:         Menu,
  close:        X,
  chevLeft:     ChevronLeft,
  chevRight:    ChevronRight,
  chevDown:     ChevronDown,
  chevUp:       ChevronUp,
  trash:        Trash2,
  play:         Play,
  stop:         Square,
  fullscreen:   Maximize,
  exitFs:       Minimize,
  videoOff:     VideoOff,
  plus:         Plus,
  monitor:      Monitor,
  activity:     Activity,
  wifi:         Wifi,
  cpu:          Cpu,
  cctv:         Cctv,
  guide:        BookOpen,
  check:        CheckCircle,
  phone:        Smartphone,
  arrowRight:   ArrowRight,
};

export function Icon({ name, size = 20, color = 'currentColor', style }) {
  const Comp = MAP[name];
  if (!Comp) return null;
  return <Comp size={size} color={color} strokeWidth={1.8} style={{ flexShrink: 0, display: 'block', ...style }} />;
}
