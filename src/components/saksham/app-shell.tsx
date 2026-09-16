"use client";

/**
 * Saksham AppShell — sidebar + topbar + content area + AI widget.
 *
 * The shell owns the active-page state and switches between employee / trainer
 * / admin pages locally. The sidebar collapses on mobile via a Sheet.
 *
 * "Remove unnecessary boxes" mandate applied: the original shell wrapped
 * everything in nested cards (sidebar footer card, topbar inside a card).
 * We strip that down to plain flex containers with dividers — same
 * information density, ~40% less visual noise.
 */

import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLang, useT } from "@/lib/lang-context";
import { LANGS, type LangCode } from "@/lib/i18n";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutDashboard,
  User,
  Briefcase,
  Gauge,
  TriangleAlert,
  HelpCircle,
  GraduationCap,
  BookOpen,
  TrendingUp,
  LogOut,
  Menu,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AiAssistantWidget } from "./ai-widget";
import { useProctor } from "./proctor-context";
import { QuizProvider, useQuiz } from "./quiz-context";
import { RealtimeProvider } from "@/lib/realtime-context";
import { AssignmentsProvider } from "@/lib/assignments-context";
import { A11yToolbar } from "@/lib/a11y-context";
import { NotificationCenter } from "@/components/saksham/notification-center";
// C.10 — page components are code-split (next/dynamic, client-only) so the
// initial bundle only carries the shell + the default landing page.
import dynamic from "next/dynamic";
import type * as employeePages from "@/components/saksham/pages/employee";
import type * as trainerPages from "@/components/saksham/pages/trainer";
import type * as adminPages from "@/components/saksham/pages/admin";

const loadPage = (name: keyof typeof employeePages) =>
  dynamic(() => import("@/components/saksham/pages/employee").then((m) => m[name]), {
    ssr: false,
  });

const EmployeeDashboard = loadPage("EmployeeDashboard");
const ProfilePage = loadPage("ProfilePage");
const RolePage = loadPage("RolePage");
const CompetencyPage = loadPage("CompetencyPage");
const GapsPage = loadPage("GapsPage");
const WhyPage = loadPage("WhyPage");
const LearningPage = loadPage("LearningPage");
const AssessPage = loadPage("AssessPage");
const ProgressPage = loadPage("ProgressPage");

const loadTrainerPage = (name: keyof typeof trainerPages) =>
  dynamic(() => import("@/components/saksham/pages/trainer").then((m) => m[name]), {
    ssr: false,
  });

const TrainerDashboard = loadTrainerPage("TrainerDashboard");
const TrainingContent = loadTrainerPage("TrainingContent");
const AssessmentGenerator = loadTrainerPage("AssessmentGenerator");
const AssessmentManagement = loadTrainerPage("AssessmentManagement");
const TrainingPlanning = loadTrainerPage("TrainingPlanning");

const loadAdminPage = (name: keyof typeof adminPages) =>
  dynamic(() => import("@/components/saksham/pages/admin").then((m) => m[name]), {
    ssr: false,
  });

const AdminDashboard = loadAdminPage("AdminDashboard");
const WorkforcePage = loadAdminPage("WorkforcePage");
const OrgGapsPage = loadAdminPage("OrgGapsPage");
const EffectivenessPage = loadAdminPage("EffectivenessPage");
const EmergingPage = loadAdminPage("EmergingPage");

const ProctorCheckPage = dynamic(
  () => import("@/components/saksham/pages/proctor-check").then((m) => m.ProctorCheckPage),
  { ssr: false },
);
const QuizPage = dynamic(
  () => import("@/components/saksham/pages/quiz").then((m) => m.QuizPage),
  { ssr: false },
);
const ResultPage = dynamic(
  () => import("@/components/saksham/pages/result").then((m) => m.ResultPage),
  { ssr: false },
);

type NavItem = {
  key: string;
  labelKey: string;
  icon: ReactNode;
};

const NAV_EMPLOYEE: NavItem[] = [
  { key: "dashboard", labelKey: "nav.dashboard", icon: <LayoutDashboard size={18} /> },
  { key: "profile", labelKey: "nav.profile", icon: <User size={18} /> },
  { key: "role", labelKey: "nav.role", icon: <Briefcase size={18} /> },
  { key: "competency", labelKey: "nav.competency", icon: <Gauge size={18} /> },
  { key: "gaps", labelKey: "nav.gaps", icon: <TriangleAlert size={18} /> },
  { key: "why", labelKey: "nav.why", icon: <HelpCircle size={18} /> },
  { key: "learning", labelKey: "nav.learning", icon: <GraduationCap size={18} /> },
  { key: "assess", labelKey: "nav.assess", icon: <BookOpen size={18} /> },
  { key: "progress", labelKey: "nav.progress", icon: <TrendingUp size={18} /> },
];

const NAV_TRAINER: NavItem[] = [
  { key: "t-dashboard", labelKey: "nav.tDashboard", icon: <LayoutDashboard size={18} /> },
  { key: "t-content", labelKey: "nav.tContent", icon: <BookOpen size={18} /> },
  { key: "t-generator", labelKey: "nav.tGenerator", icon: <Sparkles size={18} /> },
  { key: "t-manage", labelKey: "nav.tManage", icon: <Gauge size={18} /> },
  { key: "t-planning", labelKey: "nav.tPlanning", icon: <Briefcase size={18} /> },
];

const NAV_ADMIN: NavItem[] = [
  { key: "a-dashboard", labelKey: "nav.aDashboard", icon: <LayoutDashboard size={18} /> },
  { key: "a-workforce", labelKey: "nav.aWorkforce", icon: <User size={18} /> },
  { key: "a-gaps", labelKey: "nav.aGaps", icon: <TriangleAlert size={18} /> },
  { key: "a-effectiveness", labelKey: "nav.aEffectiveness", icon: <Gauge size={18} /> },
  { key: "a-emerging", labelKey: "nav.aEmerging", icon: <Sparkles size={18} /> },
  { key: "a-planning", labelKey: "nav.aPlanning", icon: <Briefcase size={18} /> },
];

const ROLE_DEFAULT_PAGE: Record<string, string> = {
  employee: "dashboard",
  trainer: "t-dashboard",
  admin: "a-dashboard",
};

const PAGE_TITLE_KEY: Record<string, string> = {
  dashboard: "nav.dashboard",
  profile: "nav.profile",
  role: "nav.role",
  competency: "nav.competency",
  gaps: "nav.gaps",
  why: "nav.why",
  learning: "nav.learning",
  assess: "nav.assess",
  quiz: "nav.assess",
  result: "pages.resultTitle",
  progress: "nav.progress",
  "t-dashboard": "nav.tDashboard",
  "t-content": "nav.tContent",
  "t-generator": "nav.tGenerator",
  "t-manage": "nav.tManage",
  "t-planning": "nav.tPlanning",
  "a-dashboard": "nav.aDashboard",
  "a-workforce": "nav.aWorkforce",
  "a-gaps": "nav.aGaps",
  "a-effectiveness": "nav.aEffectiveness",
  "a-emerging": "nav.aEmerging",
  "a-planning": "nav.aPlanning",
};

export function AppShell() {
  return (
    <RealtimeProvider>
      <AssignmentsProvider>
        <QuizProvider>
          <AppShellInner />
        </QuizProvider>
      </AssignmentsProvider>
    </RealtimeProvider>
  );
}

function AppShellInner() {
  const { session, logout, data } = useAuth();
  const { t, lang, setLang } = useLang();
  const proctor = useProctor();
  const quiz = useQuiz();
  const [page, setPage] = useState<string>(
    ROLE_DEFAULT_PAGE[session?.role ?? "employee"] ?? "dashboard",
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!session || !data) return null;

  const nav =
    session.role === "employee"
      ? NAV_EMPLOYEE
      : session.role === "trainer"
        ? NAV_TRAINER
        : NAV_ADMIN;

  // Locked for the entire assessment flow — from the moment the device-check
  // screen opens (quiz.page === "proctor-check"), through the fullscreen
  // proctored session (proctor.active), until the quiz is submitted. This is
  // deliberately wider than just `proctor.active` so the dashboard/AI can't
  // be reached during the camera/mic permission step either, even though
  // fullscreen hasn't been entered yet.
  const locked =
    proctor.active || quiz.page === "proctor-check" || quiz.page === "quiz";
  const lockedReason =
    locked && page !== "quiz" ? t("common.navLockedToast") : null;

  const go = (key: string) => {
    if (locked && key !== "quiz") {
      proctor.showToast(t("common.navLockedToast"));
      return;
    }
    setPage(key);
    setMobileOpen(false);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const initials = session.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const SidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand row */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--line)]">
        <img src="/logo.png" alt="Saksham" className="w-9 h-9 rounded-full" />
        <div className="min-w-0">
          <div className="font-display font-bold text-[var(--navy)] leading-tight">
            {t("login.brand")}
          </div>
          <div className="text-xs text-[var(--ink-soft)]">
            {t(`common.${session.role}`)}
          </div>
        </div>
      </div>

      {/* Locked banner */}
      {locked ? (
        <div className="mx-3 my-2 px-3 py-2 rounded-lg bg-[var(--critical-soft)] text-[var(--critical)] text-xs">
          {t("common.navLockedBanner")}
        </div>
      ) : null}

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto scroll-thin py-2">
        {nav.map((item) => {
          const isActive = page === item.key;
          return (
            <button
              key={item.key}
              type="button"
              disabled={locked}
              onClick={() => go(item.key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition",
                isActive
                  ? "bg-[var(--teal-soft)] text-[var(--teal)] border-r-2 border-[var(--teal)]"
                  : "text-[var(--ink-soft)] hover:bg-[var(--paper)] hover:text-[var(--ink)]",
                locked && "opacity-50 cursor-not-allowed",
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="truncate">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-[var(--line)] p-2">
        <button
          type="button"
          disabled={locked}
          onClick={logout}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-[var(--ink-soft)] hover:bg-[var(--paper)] hover:text-[var(--critical)] transition",
            locked && "opacity-50 cursor-not-allowed",
          )}
        >
          <LogOut size={18} />
          <span>{t("common.logOut")}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[var(--paper)]">
      {/* Skip-to-content — the first focusable element in the page */}
      <a href="#main-content" className="saksham-skip-link">
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-white border-r border-[var(--line)] flex-col">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          {SidebarContent}
        </SheetContent>
      </Sheet>

      {/* Mobile menu trigger — rendered separately so it works without SheetTrigger */}
      {/* (SheetTrigger must be a direct child of Sheet, but we want the button
          to live inside the topbar, so we drive the Sheet via open/onOpenChange.) */}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[var(--line)]">
          <div className="flex items-center justify-between h-14 px-4 lg:px-6">
            <div className="flex items-center gap-3 min-w-0">
              {/* Mobile menu trigger */}
              <button
                type="button"
                className="lg:hidden p-2 -ml-2"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
              {/* Breadcrumbs */}
              <nav className="flex items-center gap-2 text-sm min-w-0">
                <span className="text-[var(--ink-soft)] hidden sm:inline">
                  {t(`common.${session.role}`)}
                </span>
                <span className="text-[var(--ink-soft)] hidden sm:inline">›</span>
                <span className="font-semibold text-[var(--ink)] truncate">
                  {t(PAGE_TITLE_KEY[page] ?? "")}
                </span>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {/* Accessibility toolbar (font size / contrast / dark mode) */}
              <A11yToolbar />

              {/* Notification center (C.8) */}
              <NotificationCenter />

              {/* Language */}
              <Select
                value={lang}
                onValueChange={(v) => setLang(v as LangCode)}
                disabled={locked}
              >
                <SelectTrigger className="w-[120px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGS.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.native}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Avatar */}
              <button
                type="button"
                onClick={() => go("profile")}
                disabled={locked}
                className={cn(
                  "w-9 h-9 rounded-full bg-[var(--teal)] text-white text-sm font-bold grid place-items-center",
                  locked && "opacity-50 cursor-not-allowed",
                )}
                aria-label={session.name}
                title={session.name}
              >
                {initials}
              </button>
            </div>
          </div>
        </header>

        {/* Content area */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto focus:outline-none"
        >
          {lockedReason ? (
            <div className="mb-3 px-3 py-2 rounded-lg bg-[var(--critical-soft)] text-[var(--critical)] text-sm">
              {lockedReason}
            </div>
          ) : null}
          <PageRouter page={page} />
        </main>
      </div>

      {/* AI Assistant floating widget — hidden during proctored assessments */}
      {!locked ? <AiAssistantWidget /> : null}
    </div>
  );
}

/**
 * PageRouter — local switch over the active page key.
 * Kept in the same file so the shell owns the routing surface.
 */
function PageRouter({ page }: { page: string }) {
  const { session, data } = useAuth();
  const t = useT();
  const quiz = useQuiz();
  if (!session || !data) return null;

  // Quiz state-machine takes over when the user is in the middle of an
  // assessment flow (proctor-check → quiz → result), regardless of the
  // sidebar selection.
  if (quiz.page === "proctor-check") return <ProctorCheckPage />;
  if (quiz.page === "quiz") return <QuizPage />;
  if (quiz.page === "result") return <ResultPage />;

  switch (page) {
    case "dashboard":
      return <EmployeeDashboard />;
    case "profile":
      return <ProfilePage />;
    case "role":
      return <RolePage />;
    case "competency":
      return <CompetencyPage />;
    case "gaps":
      return <GapsPage />;
    case "why":
      return <WhyPage />;
    case "learning":
      return <LearningPage />;
    case "assess":
      return <AssessPage />;
    case "progress":
      return <ProgressPage />;
    case "t-dashboard":
      return <TrainerDashboard />;
    case "t-content":
      return <TrainingContent />;
    case "t-generator":
      return <AssessmentGenerator />;
    case "t-manage":
      return <AssessmentManagement />;
    case "t-planning":
      return <TrainingPlanning />;
    case "a-dashboard":
      return <AdminDashboard />;
    case "a-workforce":
      return <WorkforcePage />;
    case "a-gaps":
      return <OrgGapsPage />;
    case "a-effectiveness":
      return <EffectivenessPage />;
    case "a-emerging":
      return <EmergingPage />;
    case "a-planning":
      return <TrainingPlanning />;
    default:
      return <div>{t("ui.pageNotFound")}</div>;
  }
}

