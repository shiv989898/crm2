
import type { Campaign, CampaignStatus } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CheckCircle, XCircle, Send, Clock, Loader2, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Progress } from "@/components/ui/progress"; // For processing status

interface CampaignCardProps {
  campaign: Campaign;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const getStatusBadgeVariant = (status: CampaignStatus) => {
    switch (status) {
      case "Sent": return "default"; 
      case "Failed": return "destructive";
      case "Pending": return "secondary";
      case "Processing": return "secondary";
      case "CompletedWithFailures": return "destructive"; // Or a new "warning" variant
      case "Draft": return "outline";
      default: return "secondary";
    }
  };

  const getStatusIcon = (status: CampaignStatus) => {
    switch (status) {
      case "Sent": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "Failed": return <XCircle className="h-4 w-4 text-red-500" />;
      case "Pending": return <Clock className="h-4 w-4 text-yellow-500" />;
      case "Processing": return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "CompletedWithFailures": return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "Draft": return <Send className="h-4 w-4 text-muted-foreground" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };
  
  const progressPercentage = campaign.status === 'Processing' && campaign.audienceSize > 0 && campaign.processedCount !== undefined
    ? (campaign.processedCount / campaign.audienceSize) * 100
    : 0;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col justify-between">
      <div>
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="text-xl text-primary">{campaign.name}</CardTitle>
            <Badge variant={getStatusBadgeVariant(campaign.status)} className="flex items-center gap-1 whitespace-nowrap">
              {getStatusIcon(campaign.status)}
              {campaign.status === 'CompletedWithFailures' ? 'Partial Success' : campaign.status}
            </Badge>
          </div>
          <CardDescription>
            Audience: {campaign.audienceName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center text-sm text-muted-foreground">
            <Users className="mr-2 h-4 w-4" />
            <span>Target Audience: {campaign.audienceSize.toLocaleString()}</span>
          </div>

          {campaign.status === "Processing" && campaign.processedCount !== undefined && (
            <div>
              <Progress value={progressPercentage} className="w-full h-2 my-1" />
              <p className="text-xs text-muted-foreground text-right">
                {campaign.processedCount.toLocaleString()} / {campaign.audienceSize.toLocaleString()} processed
              </p>
            </div>
          )}
          
          {(campaign.status === "Sent" || campaign.status === "CompletedWithFailures" || campaign.status === "Failed") && (
            <>
              <div className="flex items-center text-sm ">
                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                <span className="text-foreground">Delivered: {campaign.sentCount.toLocaleString()}</span>
              </div>
              <div className="flex items-center text-sm">
                <XCircle className="mr-2 h-4 w-4 text-red-500" />
                <span className="text-foreground">Failed: {campaign.failedCount.toLocaleString()}</span>
              </div>
            </>
          )}
          
           {campaign.status === "Failed" && campaign.sentCount === 0 && (
              <p className="text-sm text-red-600">This campaign failed to send to any recipients.</p>
           )}
           {campaign.status === "CompletedWithFailures" && (
             <p className="text-sm text-orange-600">This campaign completed with some delivery failures.</p>
           )}
        </CardContent>
      </div>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Created: {format(parseISO(campaign.createdAt), "MMM d, yyyy HH:mm")}
        </p>
      </CardFooter>
    </Card>
  );
}
