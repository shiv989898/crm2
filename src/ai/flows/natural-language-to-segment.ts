'use server';

/**
 * @fileOverview Converts natural language text prompts into logical rules for generating audience segments.
 *
 * - naturalLanguageToSegment - A function that takes a natural language description and returns segment rules.
 * - NaturalLanguageToSegmentInput - The input type for the naturalLanguageToSegment function.
 * - NaturalLanguageToSegmentOutput - The return type for the naturalLanguageToSegment function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const NaturalLanguageToSegmentInputSchema = z.object({
  naturalLanguageDescription: z
    .string()
    .describe(
      'A natural language description of the target audience (e.g., \'Customers who have made a purchase in the last month and live in California\').'
    ),
});
export type NaturalLanguageToSegmentInput = z.infer<typeof NaturalLanguageToSegmentInputSchema>;

const NaturalLanguageToSegmentOutputSchema = z.object({
  segmentRules: z
    .string()
    .describe(
      'The corresponding segment rules in a logical format (e.g., a JSON object with filter conditions).'
    ),
});
export type NaturalLanguageToSegmentOutput = z.infer<typeof NaturalLanguageToSegmentOutputSchema>;

export async function naturalLanguageToSegment(
  input: NaturalLanguageToSegmentInput
): Promise<NaturalLanguageToSegmentOutput> {
  return naturalLanguageToSegmentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'naturalLanguageToSegmentPrompt',
  input: {schema: NaturalLanguageToSegmentInputSchema},
  output: {schema: NaturalLanguageToSegmentOutputSchema},
  prompt: `You are an AI assistant that translates natural language descriptions of target audiences into logical segment rules.

  Given the following natural language description:
  {{naturalLanguageDescription}}

  Generate the corresponding segment rules in a JSON format that can be used to filter a customer database.
  The JSON object should contain filter conditions based on customer attributes such as purchase history, location, demographics, etc.
  Ensure that the generated JSON is valid and can be easily parsed by a computer program.
  Example:
  {
    "conditions": [
      {
        "attribute": "last_purchase_date",
        "operator": "greater_than",
        "value": "30 days ago"
      },
      {
        "attribute": "location",
        "operator": "equals",
        "value": "California"
      }
    ]
  }
  `,
});

const naturalLanguageToSegmentFlow = ai.defineFlow(
  {
    name: 'naturalLanguageToSegmentFlow',
    inputSchema: NaturalLanguageToSegmentInputSchema,
    outputSchema: NaturalLanguageToSegmentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
