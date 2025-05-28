
"use server";

import { naturalLanguageToSegment, type NaturalLanguageToSegmentInput, type NaturalLanguageToSegmentOutput } from "@/ai/flows/natural-language-to-segment";

export async function naturalLanguageToSegmentAction(
  input: NaturalLanguageToSegmentInput
): Promise<NaturalLanguageToSegmentOutput> {
  try {
    const result = await naturalLanguageToSegment(input);
    return result;
  } catch (error) {
    console.error("Error in naturalLanguageToSegmentAction:", error);
    // Return a structured error or rethrow, depending on how you want to handle on client
    return { segmentRules: "" }; // Or throw an error to be caught by client
  }
}
