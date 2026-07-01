import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const SWATCHES = [
  ["--bg-canvas", "canvas"], ["--card", "card"], ["--paper", "paper"],
  ["--section-alt", "section-alt"], ["--primary", "primary"], ["--accent", "accent"],
  ["--accent-2", "accent-2"], ["--foreground", "foreground"], ["--muted-foreground", "muted"],
  ["--color-success", "success"], ["--color-warning", "warning"], ["--destructive", "danger"],
] as const;

export default function DesignPreviewPage() {
  return (
    <div style={{ padding: 40, maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 40 }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 48, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
          Orithon
        </h1>
        <p style={{ color: "var(--muted-foreground)", marginTop: 4 }}>
          Design system preview — Commissioner body, Cormorant display.
        </p>
      </div>

      <section>
        <Badge variant="kicker">Colors</Badge>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginTop: 12 }}>
          {SWATCHES.map(([v, label]) => (
            <div key={v}>
              <div style={{ height: 56, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: `var(${v})` }} />
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <Button>Default</Button>
        <Button variant="accent">Accent</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
      </section>

      <section style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <Badge dot>Live</Badge>
        <Badge variant="accent">Accent</Badge>
        <Badge variant="success">Paid</Badge>
        <Badge variant="warning">Pending</Badge>
        <Badge variant="danger">Overdue</Badge>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <CardHeader><CardTitle>Sample card</CardTitle></CardHeader>
          <CardContent style={{ color: "var(--muted-foreground)" }}>
            White surface, warm border, soft elevation.
          </CardContent>
        </Card>
        <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <Label htmlFor="d-in">Input</Label>
            <div style={{ marginTop: 6 }}><Input id="d-in" placeholder="Type here…" /></div>
          </div>
          <div>
            <Label htmlFor="d-ta">Textarea</Label>
            <div style={{ marginTop: 6 }}><Textarea id="d-ta" placeholder="Notes…" /></div>
          </div>
        </Card>
      </section>
    </div>
  );
}
