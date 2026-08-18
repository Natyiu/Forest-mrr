"use client";

import { Rocket, Github, Server, Terminal, Globe, Wrench } from "lucide-react";

const steps = [
  {
    number: 1,
    title: "Build locally and verify no errors",
    description: "Run a production build before pushing. If it fails locally, it will fail on Vercel too.",
    icon: Wrench,
    details: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>From the project root, run:</p>
        <code className="block bg-muted px-3 py-2 rounded text-xs font-mono overflow-x-auto">
          pnpm install<br />
          pnpm run build
        </code>
        <p>Fix any errors before continuing. A successful build means your deployment is more likely to succeed.</p>
      </div>
    ),
  },
  {
    number: 2,
    title: "Push the project to GitHub",
    description: "Create a new repository on GitHub and push your code.",
    icon: Github,
    details: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Initialize git (if needed), add your remote, and push:</p>
        <code className="block bg-muted px-3 py-2 rounded text-xs font-mono overflow-x-auto">
          git init<br />
          git add .<br />
          git commit -m &quot;Initial commit&quot;<br />
          git branch -M main<br />
          git remote add origin https://github.com/your-username/your-repo.git<br />
          git push -u origin main
        </code>
      </div>
    ),
  },
  {
    number: 3,
    title: "Import environment variables on Vercel",
    description: "Add all variables from your .env file to the Vercel project.",
    icon: Server,
    details: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>In Vercel → Project → Settings → Environment Variables, add each variable from your local <code className="bg-muted px-1 rounded">.env</code> file. Include at minimum:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>BETTER_AUTH_SECRET</li>
          <li>BETTER_AUTH_URL</li>
          <li>CORS_ORIGIN</li>
          <li>DATABASE_URL</li>
          <li>DIRECT_URL</li>
        </ul>
        <p>Plus any others you use (RESEND_API_KEY, GOOGLE_CLIENT_*, SUPABASE_*, etc.).</p>
      </div>
    ),
  },
  {
    number: 4,
    title: "Edit the build command",
    description: "Change the build command from turbo to pnpm.",
    icon: Terminal,
    details: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>In Vercel → Project → Settings → General → Build & Development Settings:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Set <strong>Build Command</strong> to: <code className="bg-muted px-1 rounded">pnpm run build</code></li>
          <li>Set <strong>Install Command</strong> to: <code className="bg-muted px-1 rounded">pnpm install</code></li>
        </ul>
        <p>If deploying only the web app from a monorepo, you may need <code className="bg-muted px-1 rounded">pnpm run build --filter=web</code> or set Root Directory to <code className="bg-muted px-1 rounded">apps/web</code>.</p>
      </div>
    ),
  },
  {
    number: 5,
    title: "Deploy",
    description: "Trigger a deployment from the Vercel dashboard or by pushing to your connected branch.",
    icon: Rocket,
    details: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Connect your GitHub repo to Vercel, then deploy. Vercel will build and deploy automatically on each push.</p>
      </div>
    ),
  },
  {
    number: 6,
    title: "Update CORS URL and Better Auth URL",
    description: "Set your production domain in environment variables.",
    icon: Globe,
    details: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>After your first deploy, Vercel will give you a URL (e.g. <code className="bg-muted px-1 rounded">https://your-app.vercel.app</code>). Update these in Vercel → Settings → Environment Variables:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li><strong>BETTER_AUTH_URL</strong> → your production URL (e.g. <code className="bg-muted px-1 rounded">https://your-app.vercel.app</code>)</li>
          <li><strong>CORS_ORIGIN</strong> → same as BETTER_AUTH_URL</li>
        </ul>
        <p>If you use a custom domain, use that instead. Redeploy after updating so the new values take effect.</p>
      </div>
    ),
  },
];

export default function AdminDeploymentPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Deployment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Step-by-step guide to deploy your app on Vercel
        </p>
      </div>

      <div className="space-y-4">
        {steps.map((step) => (
          <div
            key={step.number}
            className="border border-border bg-card shadow-elev-1 overflow-hidden rounded-xl"
          >
            <div className="px-4 py-3 border-b border-border flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <step.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">
                    STEP {step.number}
                  </span>
                </div>
                <p className="text-xs font-semibold mt-0.5">{step.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {step.description}
                </p>
              </div>
            </div>
            <div className="p-4 pt-3">{step.details}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
