
import { CampaignList } from "@/components/campaigns/CampaignList";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Campaign Dashboard</h1>
          <p className="text-muted-foreground">
            View and manage your marketing campaigns.
          </p>
        </div>
        <Link href="/audience-builder?action=createCampaign" passHref>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <PlusCircle className="mr-2 h-5 w-5" />
            Create New Campaign
          </Button>
        </Link>
      </div>
      
      <CampaignList />
    </div>
  );
}
