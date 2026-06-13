import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Forked — idea" };

export default function ForkedPage() {
  return (
    <ComingSoon
      title="My forks"
      description="Workflows you've forked — each keeping its 'Forked from' lineage — land here in a later release."
    />
  );
}
