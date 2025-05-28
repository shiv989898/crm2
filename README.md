
# Nexus CRM - AI-Powered Customer Relationship Management Platform

Nexus CRM is a modern, AI-enhanced Customer Relationship Management (CRM) application built with Next.js, Firebase, and Genkit. It provides tools for audience segmentation, campaign creation with AI-driven message suggestions, and simulated campaign delivery tracking.

## Features

### 1. User Authentication
- **Google Sign-In**: Secure and easy authentication using Firebase Authentication with Google Provider.
- **Authenticated Routes**: Protected routes ensure that only logged-in users can access the main application features.

### 2. Dashboard
- Displays an overview of marketing campaigns.
- Allows quick navigation to create new campaigns.
- Campaign cards show key information: name, audience, status (Draft, Pending, Processing, Sent, Failed, CompletedWithFailures), creation date, objective, message template, and delivery statistics (sent/failed/processed counts).
- Real-time (simulated) progress bar for campaigns currently in "Processing" status.

### 3. Audience Segment Builder
- **Manual Rule Creation**:
    - Users can define audience segments by adding multiple rules.
    - Each rule consists of a customer attribute (e.g., "Last Purchase Date", "Total Spend"), an operator (e.g., "Is Exactly", "Is Greater Than"), and a value.
    - Supports various value types: text, number, date (with a date picker), and boolean.
    - Logical operators (`AND`/`OR`) can be used to combine multiple rules.
- **AI-Powered Segment Generation**:
    - Users can describe their target audience in natural language (e.g., "Customers who live in California and purchased in the last month").
    - The AI (powered by Genkit and Google AI) converts this description into structured segment rules.
    - The AI also suggests a concise `Audience Name` and a `Segment Description` based on the prompt.

### 4. Campaign Management
- **Create New Campaigns**:
    - Campaigns are created based on a saved audience segment.
    - Users can define a `Campaign Name` and a `Campaign Objective`.
- **AI-Driven Message Suggestions**:
    - Based on the campaign objective, target audience description, company name, and product/service, the AI generates 2-3 distinct message template suggestions.
    - Each suggestion includes:
        - `messageText`: A compelling message template, including the `{{customerName}}` placeholder for personalization.
        - `tone`: The overall tone of the message (e.g., "Friendly & Engaging").
        - `suggestedImageKeywords`: 1-2 keywords for a relevant image.
    - Users can choose one of the AI suggestions or write their own.
- **Final Message Template**:
    - Users set a final message template for the campaign. This template **must** include `{{customerName}}` for personalization.
- **Simulated Campaign Processing & Logging**:
    - When a campaign is launched, its status changes from `Pending` to `Processing`.
    - A mock backend process simulates sending messages to each customer in the audience.
    - **Communication Log**: Each simulated message attempt is logged with a `customerId`, `customerName`, the personalized `message`, `status` (`Pending`, `Sent`, or `Failed`), and a `timestamp`. (Note: This log is currently in-memory mock data).
    - **Dummy Vendor API Simulation**:
        - A "vendor API" is simulated internally.
        - It processes messages with a 90% success rate (`Sent`) and 10% failure rate (`Failed`).
        - **Delivery Receipt API**: The simulated vendor hits a `deliveryReceiptAction` (acting as a Delivery Receipt API endpoint on the backend). This action updates the communication log entry's status and aggregates `sentCount`, `failedCount`, and `processedCount` for the campaign.
    - **Campaign Status Updates**: Based on the delivery receipts, the campaign's overall status is updated to `Sent` (all successful), `Failed` (all failed), or `CompletedWithFailures` (partial success).

### 5. User Profile Page
- Accessible from the user dropdown in the navigation bar.
- Displays the logged-in user's:
    - Avatar (from Google profile)
    - Display Name
    - Email Address
    - User ID (UID)
- Profile information is currently read-only.

### 6. Settings Page
- **Profile Information**: Displays the user's display name and email (read-only).
- **Notification Preferences**:
    - Toggle switches for "Email Notifications" and "Push Notifications".
    - These settings are currently UI-only and save their state locally within the component (not backend integrated).
- **Theme Settings**:
    - **Dark Mode Toggle**: Allows users to switch between light and dark themes.
    - The theme preference is saved in `localStorage` and persists across sessions.

### 7. Responsive Design
- The application layout is responsive, featuring a collapsible sidebar.
- On mobile devices, the sidebar transitions to a sheet/drawer.

## Tech Stack

- **Frontend**:
    - Next.js 15 (App Router)
    - React 18
    - TypeScript
- **UI & Styling**:
    - ShadCN UI Components
    - Tailwind CSS
    - Lucide React (Icons)
    - Geist Sans & Geist Mono (Fonts)
- **State Management**:
    - React Context API (for Auth and Theme)
    - `useState` for local component state
- **AI Integration**:
    - Genkit
    - Google AI (via `@genkit-ai/googleai`)
- **Backend (Simulated & Firebase)**:
    - Next.js Server Actions (for backend logic like campaign processing)
    - Firebase Authentication (for Google Sign-In)
- **Data Handling & Validation**:
    - Zod (for schema definition in AI flows)
    - `date-fns` (for date formatting)
- **Development Tools**:
    - ESLint & Prettier (Implicitly via Next.js setup)
    - `dotenv` for environment variable management

## Environment Setup

To run this project locally, you need to set up your environment variables.

1.  **Create a `.env` file** in the root directory of the project.
2.  **Populate `.env` with your credentials:**

    ```env
    # Firebase Configuration (obtain from your Firebase project settings)
    NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXX
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
    NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890abcdef

    # Google AI API Key (for Genkit AI features)
    # Obtain from Google AI Studio (https://aistudio.google.com/app/apikey)
    GOOGLE_API_KEY=AIzaSyYYYYYYYYYYYYYYYYYYYYYYY
    ```
    - Replace the placeholder values with your **actual** credentials.
    - `NEXT_PUBLIC_` prefixed variables are exposed to the browser by Next.js.
    - `GOOGLE_API_KEY` is used by Genkit on the server-side for AI flow execution.

## Getting Started / Running Locally

Follow these steps to get the application running on your local machine:

1.  **Clone the repository (if you haven't already):**
    ```bash
    git clone <your-repository-url>
    cd <project-directory>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    ```

3.  **Set up your Environment Variables:**
    Ensure you have created and populated the `.env` file as described in the "Environment Setup" section above.

4.  **Run the Next.js Development Server:**
    This server handles the main application and server actions.
    ```bash
    npm run dev
    # or
    # yarn dev
    ```
    The application will typically be available at `http://localhost:9002`.

5.  **Run the Genkit Development Server (for AI features):**
    For the AI features (Natural Language to Segment, AI Message Suggestions) to work, you need to run the Genkit development server in a **separate terminal window**.
    ```bash
    npm run genkit:dev
    # or
    # yarn genkit:dev
    ```
    The Genkit development UI will typically be available at `http://localhost:4000`, where you can inspect and test your Genkit flows.

6.  **Access the Application:**
    Open your web browser and navigate to `http://localhost:9002`.

## Firebase Setup Requirements

For the authentication features to work correctly:

1.  **Create a Firebase Project:** If you don't have one, create a project at [Firebase Console](https://console.firebase.google.com/).
2.  **Register a Web App:** In your Firebase Project settings, add a Web app (`</>`) to get the `firebaseConfig` values for your `.env` file.
3.  **Enable Google Sign-In Provider:**
    - Go to "Authentication" in your Firebase project.
    - Select the "Sign-in method" tab.
    - Enable the "Google" provider.
4.  **Add Authorized Domains:**
    - Still in the "Sign-in method" tab under Authentication settings.
    - Scroll to the "Authorized domains" section.
    - Add `localhost` to the list of authorized domains. This is necessary for Google Sign-In to work during local development.

## Folder Structure Overview

```
.
├── public/                  # Static assets
├── src/
│   ├── app/                 # Next.js App Router: Pages and layouts
│   │   ├── (auth)/          # Routes for authentication (sign-in)
│   │   ├── (authenticated)/ # Protected routes (dashboard, audience-builder, etc.)
│   │   ├── globals.css      # Global styles
│   │   └── layout.tsx       # Root layout
│   │   └── page.tsx         # Root page (handles redirection)
│   ├── ai/                  # Genkit AI flows and configuration
│   │   ├── flows/           # Specific AI flows
│   │   ├── dev.ts           # Genkit development server entry point
│   │   └── genkit.ts        # Genkit global configuration
│   ├── components/          # React components
│   │   ├── audience/        # Components for audience building
│   │   ├── auth/            # Authentication components
│   │   ├── campaigns/       # Campaign related components
│   │   ├── layout/          # Layout components (AppShell, Nav)
│   │   └── ui/              # ShadCN UI primitives
│   ├── config/              # Configuration files (e.g., Firebase)
│   ├── hooks/               # Custom React hooks (useAuth, useTheme, useMobile)
│   ├── lib/                 # Utility functions and mock data
│   ├── providers/           # React Context providers (Auth, Theme, App)
│   └── types/               # TypeScript type definitions
├── .env                     # Environment variables (MUST BE CREATED MANUALLY)
├── next.config.ts           # Next.js configuration
├── package.json             # Project dependencies and scripts
└── tsconfig.json            # TypeScript configuration
```

## Notes

-   The campaign processing and communication log are currently using in-memory mock data (`MOCK_CAMPAIGNS`, `MOCK_COMMUNICATION_LOGS`). In a production application, this data would be stored in a persistent database (e.g., Firestore).
-   The "Brownie Points" for batch updating the DB from individual API hits in `deliveryReceiptAction` is partially addressed conceptually by having a single server action update the in-memory mock data. A true batching system would involve queuing mechanisms and database batch write operations.
-   Notification preferences in Settings are UI-only and do not trigger actual notifications.
```