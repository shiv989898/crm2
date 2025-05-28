
import type { Campaign, CampaignStatus } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CheckCircle, XCircle, Send, Clock, Loader2, AlertTriangle, MessageSquare, Target } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Progress } from "@/components/ui/progress";

interface CampaignCardProps {
  campaign: Campaign;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const getStatusBadgeVariant = (status: CampaignStatus) => {
    switch (status) {
      case "Sent": return "default"; // Uses primary by default, which is fine
      case "Failed": return "destructive";
      case "Pending": return "secondary";
      case "Processing": return "secondary"; // Or another variant if we want specific color
      case "CompletedWithFailures": return "destructive"; // Or an orange/yellow variant if added to theme
      case "Draft": return "outline";
      default: return "secondary";
    }
  };

  const getStatusIcon = (status: CampaignStatus) => {
    switch (status) {
      case "Sent": return <CheckCircle className="h-4 w-4 text-accent" />; // Use accent (teal) for success
      case "Failed": return <XCircle className="h-4 w-4 text-destructive" />;
      case "Pending": return <Clock className="h-4 w-4 text-yellow-500" />; // Keep specific color for pending/warning
      case "Processing": return <Loader2 className="h-4 w-4 animate-spin text-primary" />; // Primary is good for processing
      case "CompletedWithFailures": return <AlertTriangle className="h-4 w-4 text-orange-500" />; // Keep specific color
      case "Draft": return <Send className="h-4 w-4 text-muted-foreground" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const progressPercentage = campaign.status === 'Processing' && campaign.audienceSize > 0 && campaign.processedCount !== undefined
    ? (campaign.processedCount / campaign.audienceSize) * 100
    : 0;

  const truncateText = (text: string | undefined, maxLength: number) => {
    if (!text) return "N/A";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

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
          {campaign.objective && (
            <div className="flex items-start text-sm text-muted-foreground">
              <Target className="mr-2 h-4 w-4 mt-0.5 shrink-0" />
              <span>Objective: {truncateText(campaign.objective, 70)}</span>
            </div>
          )}
          {campaign.messageTemplate && (
             <div className="flex items-start text-sm text-muted-foreground">
              <MessageSquare className="mr-2 h-4 w-4 mt-0.5 shrink-0" />
              <span>Template: "{truncateText(campaign.messageTemplate, 60)}"</span>
            </div>
          )}
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
                <CheckCircle className="mr-2 h-4 w-4 text-accent" /> 
                <span className="text-foreground">Delivered: {campaign.sentCount.toLocaleString()}</span>
              </div>
              <div className="flex items-center text-sm">
                <XCircle className="mr-2 h-4 w-4 text-destructive" />
                <span className="text-foreground">Failed: {campaign.failedCount.toLocaleString()}</span>
              </div>
            </>
          )}

           {campaign.status === "Failed" && campaign.sentCount === 0 && (
              <p className="text-sm text-destructive">This campaign failed to send to any recipients.</p>
           )}
           {campaign.status === "CompletedWithFailures" && (
             <p className="text-sm text-orange-500">This campaign completed with some delivery failures.</p> // Using orange-500 as theme doesn't have a direct "warning" semantic color
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
