import { ThemeSelector } from "@/components/settings/theme-selector";

export const metadata = { title: "Appearance — idea" };

export default function AppearanceSettingsPage() {
  return (
    <div>
      <h2 className="font-heading text-xl font-bold tracking-tight">
        Appearance
      </h2>
      <p className="mt-1 text-muted-foreground">
        Theme follows your system by default — pick a fixed theme below.
      </p>
      <div className="mt-6">
        <ThemeSelector />
      </div>
    </div>
  );
}
