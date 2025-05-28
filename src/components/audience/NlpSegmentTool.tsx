
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Wand2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SegmentRule } from "@/types";
import { naturalLanguageToSegmentAction } from "@/app/(authenticated)/audience-builder/actions"; // Server Action
import { useToast } from "@/hooks/use-toast";

interface NlpSegmentToolProps {
  onRulesGenerated: (rules: SegmentRule[], description: string) => void;
}

// Helper to map AI response to SegmentRule[]
// This is a simplified mapper and might need to be more robust
const mapAiResponseToRules = (aiJsonString: string): SegmentRule[] => {
  try {
    const parsed = JSON.parse(aiJsonString);
    if (parsed.conditions && Array.isArray(parsed.conditions)) {
      return parsed.conditions.map((cond: any, index: number) => ({
        id: `ai-${Date.now()}-${index}`,
        field: cond.attribute || '',
        operator: cond.operator || '',
        value: cond.value || '',
        // Default to AND for AI generated rules for simplicity initially
        logicalOperator: index > 0 ? 'AND' : undefined, 
      }));
    }
  } catch (error) {
    console.error("Error parsing AI response:", error);
  }
  return [];
};


export function NlpSegmentTool({ onRulesGenerated }: NlpSegmentToolProps) {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast({ title: "Prompt is empty", description: "Please enter a description for your audience.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const result = await naturalLanguageToSegmentAction({ naturalLanguageDescription: prompt });
      if (result.segmentRules) {
        const generatedRules = mapAiResponseToRules(result.segmentRules);
        if (generatedRules.length > 0) {
          onRulesGenerated(generatedRules, prompt);
          toast({ title: "Success!", description: "Segment rules generated from your description." });
        } else {
          toast({ title: "Parsing Error", description: "Could not parse rules from AI response. Please try a different prompt or refine manually.", variant: "destructive" });
        }
      } else {
        toast({ title: "AI Error", description: "Failed to generate rules. Please try again.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error calling AI:", error);
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wand2 className="h-6 w-6 text-primary" />
          AI-Powered Segment Builder
        </CardTitle>
        <CardDescription>
          Describe your target audience in plain English (e.g., "Users who signed up last month and live in New York").
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="e.g., Customers who made a purchase over $100 in the last 30 days and are subscribed to the newsletter."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          disabled={isLoading}
        />
        <Button onClick={handleSubmit} disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          Generate Rules
        </Button>
      </CardContent>
    </Card>
  );
}
