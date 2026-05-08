/**
 * Left-most chrome of the topbar — square accent tile + product name.
 * Width is tuned to roughly align with the 280px sidebar below.
 */
export function BrandMark() {
  return (
    <div
      className="flex items-center gap-2.5 shrink-0"
      style={{ minWidth: 248 }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 22,
          height: 22,
          borderRadius: "var(--radius-sm)",
          background: "var(--primary)",
          color: "#fff",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "-0.04em",
        }}
      >
        A
      </div>
      <div
        style={{
          fontSize: 13.5,
          fontWeight: 500,
          letterSpacing: "-0.2px",
          color: "var(--ink)",
        }}
      >
        Agent Tracer
      </div>
    </div>
  );
}
