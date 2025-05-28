
'use server';
/**
 * @fileOverview Generates campaign message suggestions using AI.
 *
 * - generateCampaignMessages - A function that takes campaign details and returns message suggestions.
 * - GenerateCampaignMessagesInput - The input type.
 * - GenerateCampaignMessagesOutput - The return type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MessageSuggestionSchema = z.object({
  messageText: z.string().describe('The suggested campaign message template. It MUST include `{{customerName}}` for personalization. Example: "Hi {{customerName}}, check out our new offers!"'),
  tone: z.string().describe('The overall tone of the message (e.g., "Friendly & Engaging", "Urgent & Action-Oriented", "Informative").'),
  suggestedImageKeywords: z.string().describe('1-2 keywords for a relevant image (e.g., "sale discount", "new product").'),
});

const GenerateCampaignMessagesInputSchema = z.object({
  campaignObjective: z.string().describe('The primary goal of the campaign (e.g., "Re-engage inactive users", "Promote new product X", "Announce seasonal sale").'),
  audienceDescription: z.string().describe('A brief description of the target audience (e.g., "Customers who haven\'t purchased in 6 months", "VIP members interested in luxury goods").'),
  companyName: z.string().describe('The name of the company sending the message.'),
  productOrService: z.string().describe('The product or service being promoted (e.g., "our CRM platform", "our latest summer collection", "financial advisory services").'),
  numSuggestions: z.number().optional().default(3).describe('The number of message suggestions to generate.'),
});
export type GenerateCampaignMessagesInput = z.infer<typeof GenerateCampaignMessagesInputSchema>;

const GenerateCampaignMessagesOutputSchema = z.array(MessageSuggestionSchema);
export type GenerateCampaignMessagesOutput = z.infer<typeof GenerateCampaignMessagesOutputSchema>;

export async function generateCampaignMessages(
  input: GenerateCampaignMessagesInput
): Promise<GenerateCampaignMessagesOutput> {
  return generateCampaignMessagesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCampaignMessagesPrompt',
  input: {schema: GenerateCampaignMessagesInputSchema},
  output: {schema: GenerateCampaignMessagesOutputSchema},
  prompt: `You are an expert marketing copywriter for {{companyName}}.
Your task is to generate {{numSuggestions}} distinct campaign message suggestions based on the following details:

Campaign Objective: {{{campaignObjective}}}
Target Audience: {{{audienceDescription}}}
Product/Service: {{{productOrService}}}

For each suggestion, provide:
1.  'messageText': A compelling message template.
    - It MUST include the placeholder \`{{customerName}}\` for personalization.
    - The message should be concise and suitable for an SMS or short email.
    - If the objective implies a discount or special offer, incorporate it naturally into the message text (e.g., "a special 10% off just for you" or "exclusive early access"). Avoid using generic placeholders like \`{{offer}}\` unless specifically instructed for advanced templating.
2.  'tone': Describe the tone of the message (e.g., "Friendly & Welcoming", "Urgent & Exciting", "Informative & Helpful").
3.  'suggestedImageKeywords': Provide 1-2 relevant keywords for an accompanying image (e.g., "happy customer product", "discount sale", "new tech gadget").

Generate a JSON array of {{numSuggestions}} message suggestion objects, adhering to the output schema.
Example of a single suggestion object:
{
  "messageText": "Hi {{customerName}}! Great news from {{companyName}} - our {{productOrService}} is now available with a special launch discount. Explore now!",
  "tone": "Exciting & Informative",
  "suggestedImageKeywords": "new product launch"
}
`,
});

const generateCampaignMessagesFlow = ai.defineFlow(
  {
    name: 'generateCampaignMessagesFlow',
    inputSchema: GenerateCampaignMessagesInputSchema,
    outputSchema: GenerateCampaignMessagesOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output || [];
  }
);
