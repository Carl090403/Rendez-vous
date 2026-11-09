export function Spinner({ size = "md", label }: { size?: "sm" | "md"; label?: string }) {
  const dimension = size === "sm" ? "size-4" : "size-6";
  return (
    <span role={label ? "status" : undefined} className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`${dimension} animate-spin rounded-full border-2 border-current border-t-transparent`}
      />
      {label && <span className="text-sm text-neutral-600">{label}</span>}
    </span>
  );
}
