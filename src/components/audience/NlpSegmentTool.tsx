
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
  onRulesGenerated: (
    rules: SegmentRule[], 
    originalPrompt: string,
    suggestedName: string,
    suggestedDescription: string
  ) => void;
}

// Helper to map AI response to SegmentRule[]
const mapAiResponseToRules = (aiJsonString: string): SegmentRule[] => {
  try {
    const parsed = JSON.parse(aiJsonString); // This should be the stringified JSON from segmentRules
    if (parsed.conditions && Array.isArray(parsed.conditions)) {
      const conditions = parsed.conditions as Array<any>; // Type assertion for clarity
      return conditions.map((cond, index) => {
        let finalLogicalOperator: 'AND' | 'OR' | undefined = undefined;
        // A logicalOperator connects the current rule to the PREVIOUS one.
        // It's only applicable if this is not the first rule.
        if (index > 0) { 
          if (cond.logicalOperator === 'AND' || cond.logicalOperator === 'OR') {
            finalLogicalOperator = cond.logicalOperator;
          } else {
            // Default to AND if AI omits it for a non-first rule.
            // The AI is instructed to provide it for non-first rules.
            finalLogicalOperator = 'AND'; 
          }
        }

        // Handle value: boolean and number must be preserved. Default to string or empty string.
        let valueToSet: string | number | boolean | Date = ''; // Date type is for internal SegmentRule, AI usually provides string for dates.
        if (typeof cond.value === 'boolean') {
          valueToSet = cond.value;
        } else if (typeof cond.value === 'number') {
          valueToSet = cond.value;
        } else if (cond.value !== undefined && cond.value !== null) {
          valueToSet = String(cond.value); // Covers dates (e.g., "YYYY-MM-DD", "30 days ago") and other text values
        }
        // If cond.value is explicitly an empty string, it will be preserved here.

        return {
          id: `ai-${Date.now()}-${index}`,
          field: cond.attribute || '',
          operator: cond.operator || '',
          value: valueToSet,
          logicalOperator: finalLogicalOperator,
        };
      });
    }
  } catch (error) {
    console.error("Error parsing AI segmentRules string in NlpSegmentTool. mapAiResponseToRules. Input string:", aiJsonString, "Error:", error);
    // The calling function will show a toast if this returns an empty array.
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
    console.log('[NlpSegmentTool] handleSubmit - Calling naturalLanguageToSegmentAction with prompt:', prompt);
    try {
      const result = await naturalLanguageToSegmentAction({ naturalLanguageDescription: prompt });
      console.log('[NlpSegmentTool] handleSubmit - Received result from AI action:', JSON.stringify(result));
      
      let generatedRules: SegmentRule[] = [];
      if (result.segmentRules && typeof result.segmentRules === 'string' && result.segmentRules.trim() !== "") {
        generatedRules = mapAiResponseToRules(result.segmentRules);
      } else if (result.segmentRules) {
        console.warn('[NlpSegmentTool] handleSubmit - segmentRules received from AI was not a non-empty string:', result.segmentRules);
      }


      if (generatedRules.length > 0) {
        onRulesGenerated(generatedRules, prompt, result.suggestedAudienceName || "", result.suggestedAudienceDescription || "");
        toast({ title: "Success!", description: "Segment rules and suggestions generated from your description." });
      } else if (result.segmentRules && generatedRules.length === 0) {
        // This means segmentRules string was present but parsing failed or resulted in no conditions
        toast({ title: "AI Response Issue", description: "Could not effectively parse rules from AI response. The rules might be empty or malformed. Please try a different prompt or refine rules manually.", variant: "destructive" });
        console.error('[NlpSegmentTool] handleSubmit - Parsing AI segmentRules resulted in empty rules. Original segmentRules string:', result.segmentRules);
      }
       else {
        // AI returned no segment rule data at all, or suggested name/description might be empty
        toast({ title: "AI Error", description: "Failed to generate rules or suggestions. The AI returned incomplete data. Please check Vercel logs for flow errors.", variant: "destructive" });
        console.error('[NlpSegmentTool] handleSubmit - AI returned no segmentRules or they were invalid. Full result:', JSON.stringify(result));
      }
    } catch (error) {
      console.error("[NlpSegmentTool] handleSubmit - Error calling AI action:", error);
      toast({ title: "Error", description: `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`, variant: "destructive" });
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
          Describe your target audience in plain English (e.g., "Users who signed up last month and live in New York"). The AI will also suggest a name and description.
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
        <Button onClick={handleSubmit} disabled={isLoading || !prompt.trim()} className="w-full sm:w-auto">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          Generate Rules & Suggestions
        </Button>
      </CardContent>
    </Card>
  );
}
