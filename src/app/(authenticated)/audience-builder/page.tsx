
import { AudienceBuilderForm } from "@/components/audience/AudienceBuilderForm";

export default function AudienceBuilderPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Audience Segment Builder</h1>
        <p className="text-muted-foreground">
          Create and manage your audience segments using powerful rule logic or AI.
        </p>
      </div>
      <AudienceBuilderForm />
    </div>
  );
}
