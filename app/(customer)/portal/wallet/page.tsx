import WalletClient from "./WalletClient";

export default function PortalWalletPage() {
  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <WalletClient />
    </div>
  );
}
