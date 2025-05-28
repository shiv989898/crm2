
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button"; // Keep if you plan to use it soon
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/providers/ThemeProvider";
import { useState } from "react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggleTheme, setTheme } = useTheme(); // setTheme might be useful for more complex scenarios
  
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);

  // Ensure theme is not undefined before rendering Switch (can happen briefly on initial load)
  const currentTheme = theme || 'light';


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          Manage your application preferences and account settings.
        </p>
      </div>

      <Card className="shadow-md rounded-lg">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Your personal details. Profile editing is not available yet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input id="displayName" placeholder="Your Name" value={user?.displayName || "N/A"} disabled className="bg-muted/50 cursor-not-allowed" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" placeholder="your@email.com" value={user?.email || "N/A"} disabled className="bg-muted/50 cursor-not-allowed" />
          </div>
          {/* <Button disabled>Update Profile (Placeholder)</Button> */}
        </CardContent>
      </Card>

      <Card className="shadow-md rounded-lg">
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Choose how you receive notifications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between space-x-2 p-3 border rounded-md hover:bg-accent/10">
            <Label htmlFor="emailNotifications" className="flex flex-col space-y-1 cursor-pointer">
              <span>Email Notifications</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Receive updates and alerts via email.
              </span>
            </Label>
            <Switch 
              id="emailNotifications" 
              checked={emailNotifications} 
              onCheckedChange={setEmailNotifications}
              aria-label="Toggle Email Notifications"
            />
          </div>
          <div className="flex items-center justify-between space-x-2 p-3 border rounded-md hover:bg-accent/10">
            <Label htmlFor="pushNotifications" className="flex flex-col space-y-1 cursor-pointer">
              <span>Push Notifications</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Get real-time alerts on your device.
              </span>
            </Label>
            <Switch 
              id="pushNotifications"
              checked={pushNotifications}
              onCheckedChange={setPushNotifications}
              aria-label="Toggle Push Notifications"
            />
          </div>
        </CardContent>
      </Card>

       <Card className="shadow-md rounded-lg">
        <CardHeader>
          <CardTitle>Theme Settings</CardTitle>
          <CardDescription>Customize the look and feel of the application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="flex items-center justify-between space-x-2 p-3 border rounded-md hover:bg-accent/10">
            <Label htmlFor="darkMode" className="flex flex-col space-y-1 cursor-pointer">
              <span>Dark Mode</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Enable dark theme for the application.
              </span>
            </Label>
            <Switch 
              id="darkMode"
              checked={currentTheme === 'dark'}
              onCheckedChange={toggleTheme}
              aria-label="Toggle Dark Mode"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
