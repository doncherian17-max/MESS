import { Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer
      className="border-t border-border bg-card/60 backdrop-blur mt-auto"
      data-testid="app-footer"
    >
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="overline tracking-wider">Made with</span>
        <Heart className="h-3 w-3 text-primary fill-primary" />
        <span className="overline tracking-wider">by</span>
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
