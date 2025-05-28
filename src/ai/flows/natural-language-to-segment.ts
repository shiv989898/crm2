
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
      'The corresponding segment rules in a logical JSON format (e.g., a JSON object with filter conditions).'
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
  prompt: `You are an AI assistant that translates natural language descriptions of target audiences into a structured JSON format representing segment rules.

Your goal is to convert a user's description like "{{naturalLanguageDescription}}" into a JSON object.
This JSON object must have a single key "conditions", which is an array of rule objects.
Each rule object in the "conditions" array can have the following properties:
- "attribute": A string representing the customer attribute to filter on (e.g., "last_purchase_date", "total_spend", "location_city", "email_engagement_opened_last").
- "operator": A string representing the comparison operator (e.g., "equals", "greater_than", "less_than", "contains", "is_true", "is_false", "before", "after").
- "value": The value to compare against. The type of this value should be appropriate for the attribute.
- "logicalOperator" (optional for the first rule, typically required for subsequent rules): A string, either "AND" or "OR". This defines how the *current rule connects to the previous rule*. This field MUST be omitted for the first rule in the "conditions" array. For all other rules (second, third, etc.), it should generally be present, defaulting to "AND" if ambiguous.

Consider these common attribute types and tailor your operators and values accordingly:
- Text attributes (e.g., location_city, user_segment): use operators like "equals", "not_equals", "contains", "starts_with". Values are strings.
- Numeric attributes (e.g., total_spend, number_of_purchases, age): use operators like "equals", "not_equals", "greater_than", "less_than", "greater_than_or_equal_to", "less_than_or_equal_to". Values are numbers.
- Date attributes (e.g., last_purchase_date, signup_date): use operators like "before", "after", "on_date", "equals" (for specific dates), "greater_than_or_equal_to" (for "within last X days" type queries). The value should be an ISO 8601 date string (YYYY-MM-DD) or a relative date description if appropriate (e.g., "30 days ago", "last month", "next week").
- Boolean attributes (e.g., email_engagement_opened_last, is_subscribed): use operators like "is_true", "is_false". The value should be the boolean \`true\` or \`false\`, not a string "true" or "false".

Example 1:
Input: "Customers who have made a purchase in the last month AND live in California"
Output:
{
  "conditions": [
    {
      "attribute": "last_purchase_date",
      "operator": "after",
      "value": "30 days ago"
    },
    {
      "logicalOperator": "AND",
      "attribute": "location_city",
      "operator": "equals",
      "value": "California"
    }
  ]
}

Example 2:
Input: "Users who signed up before 2023-01-01 OR opened the last email"
Output:
{
  "conditions": [
    {
      "attribute": "signup_date",
      "operator": "before",
      "value": "2023-01-01"
    },
    {
      "logicalOperator": "OR",
      "attribute": "email_engagement_opened_last",
      "operator": "is_true",
      "value": true
    }
  ]
}

Example 3:
Input: "High-value customers who spent more than $500"
Output:
{
  "conditions": [
    {
      "attribute": "total_spend",
      "operator": "greater_than",
      "value": 500
    }
  ]
}

Example 4:
Input: "Users who are not subscribed to the newsletter"
Output:
{
  "conditions": [
    {
      "attribute": "is_subscribed_to_newsletter",
      "operator": "is_false",
      "value": false
    }
  ]
}

Based on the description: "{{naturalLanguageDescription}}", generate the JSON segment rules.
Ensure the generated JSON is valid and strictly follows the specified structure, including correct value types (number, boolean, string).
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

