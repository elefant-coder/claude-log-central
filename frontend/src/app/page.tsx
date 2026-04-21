"use client";

import { useState, useSyncExternalStore } from "react";
import { DashboardView } from "@/components/dashboard-view";
import { LogsView } from "@/components/logs-view";
import { SessionsView } from "@/components/sessions-view";
import { SearchView } from "@/components/search-view";
import {
  Activity,
  FileText,
  Search,
  LayoutDashboard,
  Settings,
  Lock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const subscribe = () => () => {};
const getSnapshot = () => typeof window !== "undefined" ? localStorage.getItem("clc_api_key") : null;
const getServerSnapshot = () => null;

function AuthGate({ children }: { children: React.ReactNode }) {
  const storedKey = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");

  const isAuthed = authed || !!storedKey;

  if (isAuthed) return <>{children}</>;

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-sm space-y-4 p-8">
        <div className="text-center space-y-2">
          <Lock className="w-12 h-12 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold">Claude Log Central</h1>
          <p className="text-sm text-muted-foreground">
            Enter your admin API key to access the dashboard
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            localStorage.setItem("clc_api_key", input);
            setAuthed(true);
          }}
          className="space-y-3"
        >
          <Input
            type="password"
            placeholder="clc_admin_key_..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" className="w-full">
            Authenticate
          </Button>
        </form>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "logs", label: "Logs", icon: FileText },
  { id: "sessions", label: "Sessions", icon: Activity },
  { id: "search", label: "Search", icon: Search },
] as const;

type View = (typeof NAV_ITEMS)[number]["id"];

export default function Home() {
  const [view, setView] = useState<View>("dashboard");

  return (
    <AuthGate>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <nav className="w-60 border-r bg-card flex flex-col">
          <div className="p-4 border-b">
            <h1 className="text-lg font-bold tracking-tight">
              Claude Log Central
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Multi-client monitoring
            </p>
          </div>
          <div className="flex-1 p-2 space-y-1">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  view === id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          <div className="p-4 border-t">
            <button
              onClick={() => {
                localStorage.removeItem("clc_api_key");
                window.location.reload();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Settings className="w-4 h-4" />
              Logout
            </button>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 p-6 overflow-auto">
          {view === "dashboard" && <DashboardView />}
          {view === "logs" && <LogsView />}
          {view === "sessions" && <SessionsView />}
          {view === "search" && <SearchView />}
        </main>
      </div>
    </AuthGate>
  );
}
