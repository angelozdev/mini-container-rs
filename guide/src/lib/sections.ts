export interface SidebarEntry {
  type: string;
  label: string;
  isCurrent?: boolean;
  entries?: SidebarEntry[];
}

export interface SectionPosition {
  position: number;
  total: number;
}

function linksIn(entries: SidebarEntry[]): SidebarEntry[] {
  return entries.flatMap((entry) => (entry.type === "group" ? linksIn(entry.entries ?? []) : [entry]));
}

export function groupsAbove(entries: SidebarEntry[]): string[] | undefined {
  for (const entry of entries) {
    if (entry.type === "link" && entry.isCurrent) return [];
    if (entry.type === "group") {
      const inside = groupsAbove(entry.entries ?? []);
      if (inside) return [entry.label, ...inside];
    }
  }
  return undefined;
}

export function findSectionPosition(sidebar: SidebarEntry[]): SectionPosition | undefined {
  const sections = sidebar.flatMap((entry) => (entry.type === "group" ? linksIn(entry.entries ?? []) : []));
  const index = sections.findIndex((entry) => entry.isCurrent);
  return index === -1 ? undefined : { position: index + 1, total: sections.length };
}
