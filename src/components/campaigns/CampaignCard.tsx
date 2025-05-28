
import type { Campaign } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CheckCircle, XCircle, Send, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

interface CampaignCardProps {
  campaign: Campaign;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const getStatusBadgeVariant = (status: Campaign['status']) => {
    switch (status) {
      case "Sent": return "default"; // Default is primary
      case "Failed": return "destructive";
      case "Pending": return "secondary";
      case "Draft": return "outline";
      default: return "secondary";
    }
  };

  const getStatusIcon = (status: Campaign['status']) => {
    switch (status) {
      case "Sent": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "Failed": return <XCircle className="h-4 w-4 text-red-500" />;
      case "Pending": return <Clock className="h-4 w-4 text-yellow-500" />;
      case "Draft": return <Send className="h-4 w-4 text-muted-foreground" />; // Using Send for Draft for now
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  }

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl text-primary">{campaign.name}</CardTitle>
          <Badge variant={getStatusBadgeVariant(campaign.status)} className="flex items-center gap-1">
            {getStatusIcon(campaign.status)}
            {campaign.status}
          </Badge>
        </div>
        <CardDescription>
          Audience: {campaign.audienceName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center text-sm text-muted-foreground">
          <Users className="mr-2 h-4 w-4" />
          <span>Audience Size: {campaign.audienceSize.toLocaleString()}</span>
        </div>
        {campaign.status === "Sent" && (
          <>
            <div className="flex items-center text-sm text-muted-foreground">
              <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
              <span>Sent: {campaign.sentCount.toLocaleString()}</span>
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <XCircle className="mr-2 h-4 w-4 text-red-500" />
              <span>Failed: {campaign.failedCount.toLocaleString()}</span>
            </div>
          </>
        )}
         {campaign.status === "Failed" && (
            <div className="flex items-center text-sm text-muted-foreground">
              <XCircle className="mr-2 h-4 w-4 text-red-500" />
              <span>Failed to send to {campaign.audienceSize.toLocaleString()} recipients.</span>
            </div>
         )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Created: {format(parseISO(campaign.createdAt), "MMM d, yyyy HH:mm")}
        </p>
      </CardFooter>
    </Card>
  );
}
