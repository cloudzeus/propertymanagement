/** Empty-state for a COLLABORATOR login that is not linked to any Supplier row. */
export function UnlinkedNotice() {
  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "40px 48px", textAlign: "center", maxWidth: 480 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--foreground)" }}>Ο λογαριασμός σας δεν έχει συνδεθεί με συνεργάτη.</div>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
          Επικοινωνήστε με την εταιρεία διαχείρισης για να συνδεθεί ο λογαριασμός σας με την επιχείρησή σας.
        </p>
      </div>
    </div>
  );
}
