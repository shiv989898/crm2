
'use server';

/**
 * @fileOverview Converts natural language text prompts into logical rules and suggests a name/description for generating audience segments.
 *
 * - naturalLanguageToSegment - A function that takes a natural language description and returns segment rules, suggested name, and description.
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
      'A JSON STRING. This string, when parsed, MUST result in an object like: `{"conditions": [{"attribute": "...", "operator": "...", "value": "..."}, ...]}`. The value property inside each condition must be a string, number, or boolean (not a string representation of a boolean like "true"). See examples in the main prompt for exact formatting and data types.'
    ),
  suggestedAudienceName: z
    .string()
    .describe('A concise, descriptive name suggested for this audience segment, suitable for display lists.'),
  suggestedAudienceDescription: z
    .string()
    .describe('A brief description summarizing the audience segment, suggested by the AI.'),
});
export type NaturalLanguageToSegmentOutput = z.infer<typeof NaturalLanguageToSegmentOutputSchema>;

export async function naturalLanguageToSegment(
  input: NaturalLanguageToSegmentInput
): Promise<NaturalLanguageToSegmentOutput> {
  console.log('[naturalLanguageToSegmentFlow] Received input:', JSON.stringify(input));
  try {
    const result = await naturalLanguageToSegmentFlow(input);
    console.log('[naturalLanguageToSegmentFlow] Successfully returned result:', JSON.stringify(result));
    return result;
  } catch (error) {
    console.error('[naturalLanguageToSegmentFlow] Error executing flow:', error);
    // Return a default structure in case of a top-level error to avoid breaking client expectations further
    return {
      segmentRules: '{"conditions":[]}', // Ensure this default is valid JSON parseable by client
      suggestedAudienceName: '',
      suggestedAudienceDescription: 'Error generating suggestions. Please check server logs for details.',
    };
  }
}

const prompt = ai.definePrompt({
  name: 'naturalLanguageToSegmentPrompt',
  input: {schema: NaturalLanguageToSegmentInputSchema},
  output: {schema: NaturalLanguageToSegmentOutputSchema},
  prompt: `You are an AI assistant that translates natural language descriptions of target audiences into a structured JSON format representing segment rules. You also suggest a suitable name and description for the audience.

Your goal is to convert a user's description like "{{naturalLanguageDescription}}" into a JSON object.
This JSON object must have the following top-level keys:
- "segmentRules": A JSON STRING representing the filter conditions. This string, when parsed by \`JSON.parse()\`, MUST result in an object with a single key "conditions", which is an array of rule objects.
- "suggestedAudienceName": A concise and descriptive name for this audience. For example, if the input is "Customers who have made a purchase in the last month and live in California", a good name might be "Recent CA Purchasers".
- "suggestedAudienceDescription": A brief summary of the audience. For the same example, a description could be "Customers in California who purchased in the last 30 days."

The "conditions" array within the parsed "segmentRules" JSON string should contain rule objects. Each rule object can have the following properties:
- "attribute": A string representing the customer attribute to filter on (e.g., "last_purchase_date", "total_spend", "location_city", "email_engagement_opened_last").
- "operator": A string representing the comparison operator (e.g., "equals", "greater_than", "less_than", "contains", "is_true", "is_false", "before", "after").
- "value": The value to compare against. The type of this value should be appropriate for the attribute: string for text attributes, number for numeric attributes, boolean (\`true\` or \`false\`, NOT the string "true" or "false") for boolean attributes, and string (YYYY-MM-DD or relative like "30 days ago") for date attributes.
- "logicalOperator" (optional for the first rule, typically required for subsequent rules): A string, either "AND" or "OR". This defines how the *current rule connects to the previous rule*. This field MUST be omitted for the first rule in the "conditions" array. For all other rules (second, third, etc.), it should generally be present, defaulting to "AND" if ambiguous.

Consider these common attribute types and tailor your operators and values accordingly:
- Text attributes (e.g., location_city, user_segment): use operators like "equals", "not_equals", "contains", "starts_with". Values are strings.
- Numeric attributes (e.g., total_spend, number_of_purchases, age): use operators like "equals", "not_equals", "greater_than", "less_than", "greater_than_or_equal_to", "less_than_or_equal_to". Values are numbers.
- Date attributes (e.g., last_purchase_date, signup_date): use operators like "before", "after", "on_date", "equals" (for specific dates), "greater_than_or_equal_to" (for "within last X days" type queries). The value should be an ISO 8601 date string (YYYY-MM-DD) or a relative date description if appropriate (e.g., "30 days ago", "last month", "next week"). All date values should be strings.
- Boolean attributes (e.g., email_engagement_opened_last, is_subscribed_to_newsletter): use operators like "is_true", "is_false". The value for boolean attributes MUST be the actual boolean \`true\` or \`false\`, not the string "true" or "false".

Example 1 (Text and Date with relative date):
Input: "Customers who have made a purchase in the last month AND live in California"
Output:
{
  "segmentRules": "{\\\"conditions\\\":[{\\\"attribute\\\":\\\"last_purchase_date\\\",\\\"operator\\\":\\\"after\\\",\\\"value\\\":\\\"30 days ago\\\"},{\\\"logicalOperator\\\":\\\"AND\\\",\\\"attribute\\\":\\\"location_city\\\",\\\"operator\\\":\\\"equals\\\",\\\"value\\\":\\\"California\\\"}]}",
  "suggestedAudienceName": "Recent CA Purchasers",
  "suggestedAudienceDescription": "Customers in California who made a purchase in the last 30 days."
}

Example 2 (Date with specific date and Boolean):
Input: "Users who signed up before 2023-01-01 OR opened the last email"
Output:
{
  "segmentRules": "{\\\"conditions\\\":[{\\\"attribute\\\":\\\"signup_date\\\",\\\"operator\\\":\\\"before\\\",\\\"value\\\":\\\"2023-01-01\\\"},{\\\"logicalOperator\\\":\\\"OR\\\",\\\"attribute\\\":\\\"email_engagement_opened_last\\\",\\\"operator\\\":\\\"is_true\\\",\\\"value\\\":true}]}",
  "suggestedAudienceName": "Early Signups or Engaged Users",
  "suggestedAudienceDescription": "Users who signed up before January 1, 2023, or opened the last email."
}

Example 3 (Numeric):
Input: "High-value customers who spent more than $500"
Output:
{
  "segmentRules": "{\\\"conditions\\\":[{\\\"attribute\\\":\\\"total_spend\\\",\\\"operator\\\":\\\"greater_than\\\",\\\"value\\\":500}]}",
  "suggestedAudienceName": "High-Value Customers (>$500)",
  "suggestedAudienceDescription": "Customers who have spent over $500 in total."
}

Based on the description: "{{naturalLanguageDescription}}", generate the JSON output including segmentRules (as a JSON string), suggestedAudienceName, and suggestedAudienceDescription.
Ensure the generated JSON is valid and strictly follows the specified structure, including correct value types (number, boolean, string) within the "conditions" array of the parsed "segmentRules" string.
The value for "segmentRules" in the output JSON MUST be a stringified JSON representation of the rules object (i.e., JSON within JSON).
Pay close attention to the examples provided, as they demonstrate the exact output format and data types required for each field. Strive for accuracy in translating the user's intent into logical rules.
The "value" field for boolean attributes must be a true boolean (\`true\` or \`false\`), not a string like "true".
`,
});

const naturalLanguageToSegmentFlow = ai.defineFlow(
  {
    name: 'naturalLanguageToSegmentFlow',
    inputSchema: NaturalLanguageToSegmentInputSchema,
    outputSchema: NaturalLanguageToSegmentOutputSchema,
  },
  async input => {
    console.log('[naturalLanguageToSegmentFlow defineFlow] Processing input:', JSON.stringify(input));
    let outputFromPrompt: NaturalLanguageToSegmentOutput | undefined;
    try {
      const { output } = await prompt(input);
      outputFromPrompt = output;
      console.log('[naturalLanguageToSegmentFlow defineFlow] Raw output from prompt:', JSON.stringify(outputFromPrompt));

      if (!outputFromPrompt) {
        console.error('[naturalLanguageToSegmentFlow defineFlow] Prompt returned undefined output.');
        throw new Error('Prompt returned undefined output.');
      }
      if (!outputFromPrompt.segmentRules || outputFromPrompt.segmentRules.trim() === "") {
        console.warn('[naturalLanguageToSegmentFlow defineFlow] Prompt output is missing segmentRules or it is an empty string. Output:', JSON.stringify(outputFromPrompt));
         // Attempt to return a default valid structure
        return {
          segmentRules: '{"conditions":[]}',
          suggestedAudienceName: outputFromPrompt.suggestedAudienceName || '',
          suggestedAudienceDescription: outputFromPrompt.suggestedAudienceDescription || 'AI did not provide rules.',
        };
      }
      // Further validation of segmentRules string before returning
      try {
        JSON.parse(outputFromPrompt.segmentRules);
      } catch (parseError) {
        console.error('[naturalLanguageToSegmentFlow defineFlow] segmentRules from AI is not valid JSON. String:', outputFromPrompt.segmentRules, 'Error:', parseError);
        // Fallback if AI returns malformed JSON for segmentRules
        return {
          segmentRules: '{"conditions":[]}',
          suggestedAudienceName: outputFromPrompt.suggestedAudienceName || '',
          suggestedAudienceDescription: outputFromPrompt.suggestedAudienceDescription || 'AI returned malformed rules.',
        };
      }

    } catch (error) {
      console.error('[naturalLanguageToSegmentFlow defineFlow] Error calling prompt or processing its output:', error);
      // Return a default structure if prompt fails or output is severely malformed
      return {
        segmentRules: '{"conditions":[]}',
        suggestedAudienceName: '',
        suggestedAudienceDescription: 'AI prompt failed or returned invalid data. Check server logs.',
      };
    }
    
    // Ensure output is not null and adheres to the schema.
    // If the AI fails to generate some parts, provide defaults.
    const finalOutput = {
        segmentRules: outputFromPrompt.segmentRules, // Already validated or defaulted
        suggestedAudienceName: outputFromPrompt.suggestedAudienceName || '',
        suggestedAudienceDescription: outputFromPrompt.suggestedAudienceDescription || '',
    };
    console.log('[naturalLanguageToSegmentFlow defineFlow] Final constructed output:', JSON.stringify(finalOutput));
    return finalOutput;
  }
);

