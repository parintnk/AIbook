/** Placeholder for settings sections not yet built (Account/Notifications/…). */
export function SettingsSectionStub({ title }: { title: string }) {
  return (
    <div>
      <h2 className="font-heading text-xl font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-muted-foreground">This section is coming soon.</p>
    </div>
  );
}
