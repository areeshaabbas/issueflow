export const statuses = ['Todo', 'In Progress', 'Done'];
export const priorities = ['Low', 'Medium', 'High', 'Critical'];
export const cx = (...s: (string | false | undefined)[]) => s.filter(Boolean).join(' ');
export function initials(s: string) {
  return s
    .split(' ')
    .map((x) => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
export function date(s: string) {
  return new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
