export default function Footer() {
  return (
    <footer
      className="border-t border-border bg-card/60 backdrop-blur mt-auto"
      data-testid="app-footer"
    >
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4 text-center text-xs text-muted-foreground">
        <span
          className="font-display font-extrabold tracking-tight"
          style={{ color: "#e11d48" }}
        >
          SUPER MILER
        </span>
        <span className="mx-1.5">©</span>
        <span>2026</span>
        <span className="mx-2 text-border">|</span>
        <span>Designed &amp; Developed by </span>
        <span
          className="font-display font-semibold text-foreground"
          data-testid="footer-credits"
        >
          Don Cherian &amp; Arjun T S
        </span>
      </div>
    </footer>
  );
}
