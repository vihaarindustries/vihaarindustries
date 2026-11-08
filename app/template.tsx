// A template (unlike a layout) is re-created on every page change, so this wrapper replays its entrance animation each time.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
