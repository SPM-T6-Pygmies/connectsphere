export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

export function InitialsAvatar({ name, className = "size-6" }: { name: string; className?: string }) {
  return (
    <span
      className={`bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${className}`}
    >
      {initials(name)}
    </span>
  );
}
