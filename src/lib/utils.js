// Simple class name utility (replaces clsx/cn pattern)
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
