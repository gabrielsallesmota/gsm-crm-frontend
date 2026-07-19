const PATHS = {
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z",
  pipeline: "M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z",
  leads: "M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 21c0-3.3 2.7-6 6-6s6 2.7 6 6M17 10.5a2.5 2.5 0 1 0 0-5M15.5 21c.2-2.6 1.7-4.4 3.7-4.8",
  tasks: "M9 11l2.5 2.5L17 8M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0z",
  agenda: "M4 7h16M8 3v4M16 3v4M4 7v13h16V7H4z",
  reports: "M4 20V11M11 20V4M18 20v-8",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .3 1.2l-2 1.5 2 3.4 2.3-.9c.6.5 1.3.9 2 1.2L10 21h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.3.9 2-3.4-2-1.5c.2-.4.3-.8.3-1.2z",
  users: "M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2 21c0-3.3 3.1-6 7-6s7 2.7 7 6M14.5 15.2c2.9.5 5.5 2.4 5.5 5.8",
};

export function NavIcon({ name, size = 17 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}
