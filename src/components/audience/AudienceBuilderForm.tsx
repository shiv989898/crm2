
"use client";

import type { SegmentRule, Audience } from "@/types";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RuleRow } from "./RuleRow";
import { NlpSegmentTool } from "./NlpSegmentTool";
import { PlusCircle, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CreateCampaignDialog } from "@/components/campaigns/CreateCampaignDialog"; // We'll create this

const AVAILABLE_FIELDS = [
  { label: "Last Purchase Date", value: "last_purchase_date", type: 'date' as const },
  { label: "Total Spend ($)", value: "total_spend", type: 'number' as const },
  { label: "Location (City)", value: "location_city", type: 'text' as const },
  { label: "Signup Date", value: "signup_date", type: 'date' as const },
  { label: "Email Engagement (Opened last email)", value: "email_engagement_opened_last", type: 'boolean' as const },
  { label: "Number of Purchases", value: "number_of_purchases", type: 'number' as const },
];

const getAvailableOperators = (fieldType: string): { label: string; value: string }[] => {
  const commonOperators = [
    { label: "Is Exactly", value: "equals" },
    { label: "Is Not", value: "not_equals" },
  ];
  const textOperators = [
    ...commonOperators,
    { label: "Contains", value: "contains" },
    { label: "Does Not Contain", value: "does_not_contain" },
    { label: "Starts With", value: "starts_with"},
    { label: "Ends With", value: "ends_with"},
  ];
  const numericDateOperators = [
    ...commonOperators,
    { label: "Is Greater Than", value: "greater_than" },
    { label: "Is Less Than", value: "less_than" },
    { label: "Is Greater Than or Equal To", value: "greater_than_or_equal_to" },
    { label: "Is Less Than or Equal To", value: "less_than_or_equal_to" },
  ];
   const dateSpecificOperators = [ // For date type fields
    { label: "Is Before", value: "before" },
    { label: "Is After", value: "after" },
    { label: "Is On", value: "on_date" }, // 'equals' can work too
  ];
  const booleanOperators = [
    { label: "Is True", value: "is_true" },
    { label: "Is False", value: "is_false" },
  ];

  switch (fieldType) {
    case 'text': return textOperators;
    case 'number': return numericDateOperators;
    case 'date': return [...numericDateOperators, ...dateSpecificOperators];
    case 'boolean': return booleanOperators;
    default: return commonOperators;
  }
};


export function AudienceBuilderForm() {
  const [audienceName, setAudienceName] = useState("");
  const [audienceDescription, setAudienceDescription] = useState("");
  const [rules, setRules] = useState<SegmentRule[]>([]);
  const { toast } = useToast();
  const [isCreateCampaignDialogOpen, setIsCreateCampaignDialogOpen] = useState(false);
  const [currentAudience, setCurrentAudience] = useState<Audience | null>(null);

  const addRule = () => {
    setRules([
      ...rules,
      {
        id: Date.now().toString(),
        field: "",
        operator: "",
        value: "",
        logicalOperator: rules.length > 0 ? "AND" : undefined,
      },
    ]);
  };

  const updateRule = (id: string, updates: Partial<SegmentRule>) => {
    setRules(rules.map((rule) => (rule.id === id ? { ...rule, ...updates } : rule)));
  };

  const removeRule = (id: string) => {
    setRules(rules.filter((rule) => rule.id !== id));
  };

  const handleNlpRulesGenerated = (generatedRules: SegmentRule[], description: string) => {
    setRules(generatedRules);
    // Optionally pre-fill audience name or description from NLP prompt
    if (!audienceName && description) {
        setAudienceName(`Audience from: "${description.substring(0,30)}${description.length > 30 ? '...' : ''}"`)
    }
    if (!audienceDescription && description) {
        setAudienceDescription(description);
    }
  };

  const handleSaveAudience = () => {
    if (!audienceName.trim()) {
      toast({ title: "Audience Name Required", description: "Please provide a name for your audience.", variant: "destructive" });
      return;
    }
    if (rules.length === 0) {
      toast({ title: "No Rules Defined", description: "Please add at least one rule to define your audience.", variant: "destructive" });
      return;
    }
    
    // Validate rules (basic validation)
    for (const rule of rules) {
        if (!rule.field || !rule.operator || (rule.value === '' && AVAILABLE_FIELDS.find(f => f.value === rule.field)?.type !== 'boolean')) {
            toast({ title: "Incomplete Rule", description: `Rule for field "${rule.field || 'Unnamed'}" is incomplete. Please fill all parts.`, variant: "destructive" });
            return;
        }
        if (rules.indexOf(rule) > 0 && !rule.logicalOperator) {
             toast({ title: "Logical Operator Missing", description: `Please select AND/OR for rule connecting to "${rule.field || 'Unnamed'}".`, variant: "destructive" });
            return;
        }
    }

    const newAudience: Audience = {
      id: `aud-${Date.now()}`,
      name: audienceName,
      rules: rules,
      createdAt: new Date().toISOString(),
      description: audienceDescription,
    };
    
    // In a real app, save this to a backend
    console.log("Saving audience:", newAudience);
    setCurrentAudience(newAudience); // Store for campaign creation
    
    toast({
      title: "Audience Saved!",
      description: `Audience "${newAudience.name}" has been saved. You can now create a campaign.`,
    });
    
    // Trigger campaign creation dialog
    setIsCreateCampaignDialogOpen(true);
  };

  return (
    <div className="space-y-8">
      <NlpSegmentTool onRulesGenerated={handleNlpRulesGenerated} />

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Define Audience Rules Manually</CardTitle>
          <CardDescription>
            Add or edit rules to precisely define your target audience.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="audienceName" className="block text-sm font-medium text-foreground">Audience Name</label>
            <Input
              id="audienceName"
              placeholder="e.g., High Value Customers Q3"
              value={audienceName}
              onChange={(e) => setAudienceName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="audienceDescription" className="block text-sm font-medium text-foreground">Audience Description (Optional)</label>
            <Input
              id="audienceDescription"
              placeholder="e.g., Customers who spent over $500 in the last quarter."
              value={audienceDescription}
              onChange={(e) => setAudienceDescription(e.target.value)}
            />
          </div>
          
          <div className="space-y-3">
            {rules.map((rule, index) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                onUpdateRule={updateRule}
                onRemoveRule={removeRule}
                isFirstRule={index === 0}
                availableFields={AVAILABLE_FIELDS}
                availableOperators={getAvailableOperators}
              />
            ))}
          </div>

          <Button onClick={addRule} variant="outline">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Rule
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSaveAudience} size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Save className="mr-2 h-5 w-5" />
          Save Audience & Create Campaign
        </Button>
      </div>

      {currentAudience && (
        <CreateCampaignDialog
          isOpen={isCreateCampaignDialogOpen}
          onOpenChange={setIsCreateCampaignDialogOpen}
          audience={currentAudience}
          onCampaignCreated={(campaignName) => {
            // This is where you would add the new campaign to your MOCK_CAMPAIGNS or real DB
            // For now, just logging and showing a toast. The CampaignList will show MOCK_CAMPAIGNS.
            console.log(`Campaign "${campaignName}" created for audience "${currentAudience.name}"`);
            toast({
              title: "Campaign Initiated!",
              description: `Campaign "${campaignName}" based on audience "${currentAudience.name}" is being processed.`,
            });
            // Potentially add to MOCK_CAMPAIGNS here if you want it to reflect immediately without page reload
            // This would require MOCK_CAMPAIGNS to be in a shared state or passed down/lifted up.
            // For now, we assume user navigates to dashboard to see it (if it were a real backend save).
          }}
        />
      )}
    </div>
  );
}
