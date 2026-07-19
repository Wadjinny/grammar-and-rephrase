import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { AnimatePresence } from "motion/react";
import { AlertCircle, History, Keyboard } from "lucide-react";
import LoginScreen from "../components/LoginScreen";
import ShortcutsCheatsheet from "../components/ShortcutsCheatsheet";
import { HistoryProvider } from "../context/history";
import { LanguageProvider, useLanguage } from "../context/language";
import { WorkspaceProvider } from "../context/workspace";
import {
  WorkspaceTabProvider,
  useWorkspaceTab,
} from "../context/workspace-tab";
import { SUPPORTED_LANGUAGES } from "../languages";
import { authHeaders, signOut, useAuth } from "../hooks/useAuth";
import { useAppShortcuts } from "../hooks/useAppShortcuts";

function AppShell() {
  const { user } = useAuth();
  const { selectedLanguage, selectLanguage } = useLanguage();
  const { activeTab, setActiveTab } = useWorkspaceTab();
  const location = useLocation();
  const navigate = useNavigate();
  const onHistory = location.pathname === "/history";

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchLangQuery, setSearchLangQuery] = useState("");
  const [isApiKeySet, setIsApiKeySet] = useState<boolean | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useAppShortcuts({ shortcutsOpen, setShortcutsOpen });

  useEffect(() => {
    fetch("/api/config", { headers: authHeaders() })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          signOut();
          return;
        }
        setIsApiKeySet(data.configOk);
      })
      .catch((err) => {
        console.error("Config check failed", err);
        setIsApiKeySet(false);
      });
  }, []);

  const goToEditorTab = (tab: "check" | "rephrase") => {
    setActiveTab(tab);
    if (onHistory) {
      navigate("/");
    }
  };

  const filteredLanguages = SUPPORTED_LANGUAGES.filter(
    (lang) =>
      lang.name.toLowerCase().includes(searchLangQuery.toLowerCase()) ||
      lang.nativeName.toLowerCase().includes(searchLangQuery.toLowerCase())
  );

  const editorTabClass = (tab: "check" | "rephrase") =>
    `px-5 py-2 rounded-full text-[13px] transition-all ${
      !onHistory && activeTab === tab
        ? "bg-indigo-600 text-white font-semibold"
        : "text-gray-500 hover:text-gray-900 font-medium"
    }`;

  const mobileEditorTabClass = (tab: "check" | "rephrase") =>
    `flex-1 text-center py-2 rounded-full text-[13px] font-medium transition-all ${
      !onHistory && activeTab === tab
        ? "bg-indigo-600 text-white font-semibold"
        : "text-gray-500"
    }`;

  return (
    <div
      className="flex flex-col min-h-screen bg-canvas font-sans antialiased text-gray-900"
      id="main-container"
    >
      <nav className="flex items-center justify-between gap-4 px-4 sm:px-6 py-4 sticky top-0 z-40 bg-canvas/90 backdrop-blur-sm">
        <NavLink to="/" className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 bg-indigo-600 rounded-ctrl flex items-center justify-center shadow-pop">
            <span className="text-white font-bold text-lg select-none">G</span>
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-gray-900 tracking-tight leading-tight">
              Grammar and Rephrase
            </h1>
            <p className="text-[11px] text-gray-400 font-medium">
              Linguistic assistant
            </p>
          </div>
        </NavLink>

        <div className="hidden md:flex items-center gap-1 bg-white p-[5px] rounded-full shadow-card">
          <button
            type="button"
            onClick={() => goToEditorTab("check")}
            className={editorTabClass("check")}
            id="nav-tab-check"
          >
            Grammar checker
          </button>
          <button
            type="button"
            onClick={() => goToEditorTab("rephrase")}
            className={editorTabClass("rephrase")}
            id="nav-tab-rephrase"
          >
            Multi-rephraser
          </button>
          <NavLink
            to="/history"
            className={({ isActive }) =>
              `px-5 py-2 rounded-full text-[13px] transition-all inline-flex items-center gap-1.5 ${
                isActive
                  ? "bg-indigo-600 text-white font-semibold"
                  : "text-gray-500 hover:text-gray-900 font-medium"
              }`
            }
            id="nav-tab-history"
          >
            <History className="h-3.5 w-3.5" />
            History
          </NavLink>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 pl-3.5 pr-3 py-2 rounded-full bg-white hover:shadow-hover cursor-pointer transition-all text-[13px] font-semibold text-gray-700 shadow-card max-w-44"
              title="Select target language"
              id="language-select-button"
              type="button"
            >
              <span className="text-base select-none shrink-0">
                {selectedLanguage.flag}
              </span>
              <span className="truncate">{selectedLanguage.name}</span>
              <svg
                className={`w-3.5 h-3.5 text-gray-400 ml-0.5 shrink-0 transition-transform ${
                  isDropdownOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            <AnimatePresence>
              {isDropdownOpen && (
                <div
                  className="absolute right-0 mt-2.5 w-64 bg-white rounded-card shadow-hover z-50 p-2 overflow-hidden"
                  id="language-dropdown-menu"
                >
                  <div className="p-1 mb-1.5">
                    <input
                      type="text"
                      className="w-full text-[12.5px] px-3 py-2 rounded-ctrl bg-white border-[1.5px] border-gray-200 outline-none focus:border-indigo-600 focus:ring-[3px] focus:ring-indigo-50 text-gray-900 transition"
                      placeholder="Search language..."
                      value={searchLangQuery}
                      onChange={(e) => setSearchLangQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-0.5">
                    {filteredLanguages.length === 0 ? (
                      <div className="text-[12px] text-gray-400 text-center py-4">
                        No matching language found
                      </div>
                    ) : (
                      filteredLanguages.map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => {
                            selectLanguage(lang);
                            setIsDropdownOpen(false);
                            setSearchLangQuery("");
                          }}
                          className={`w-full text-left px-3 py-2 rounded-ctrl text-[13px] font-semibold flex items-center justify-between transition-colors ${
                            selectedLanguage.code === lang.code
                              ? "bg-indigo-50 text-indigo-600"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-sm select-none">
                              {lang.flag}
                            </span>
                            <span>{lang.name}</span>
                          </span>
                          <span className="text-[11px] text-gray-400 font-normal">
                            {lang.nativeName}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-gray-500 hover:text-indigo-600 shadow-card hover:shadow-hover transition"
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            id="shortcuts-help-button"
          >
            <Keyboard className="h-4 w-4" />
          </button>

          <div className="hidden sm:flex items-center gap-2">
            <span className="max-w-[140px] truncate rounded-full bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-600">
              {(typeof user?.name === "string" && user.name) ||
                (typeof user?.email === "string" && user.email) ||
                "Signed in"}
            </span>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-full bg-white px-3.5 py-2 text-[12.5px] font-semibold text-gray-700 shadow-card transition hover:shadow-hover"
            >
              Sign out
            </button>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="sm:hidden rounded-full bg-white px-3.5 py-2 text-[12.5px] font-semibold text-gray-700 shadow-card"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="flex md:hidden mx-4 mb-1 items-center gap-1 bg-white p-[5px] rounded-full shadow-card">
        <button
          type="button"
          onClick={() => goToEditorTab("check")}
          className={mobileEditorTabClass("check")}
        >
          Checker
        </button>
        <button
          type="button"
          onClick={() => goToEditorTab("rephrase")}
          className={mobileEditorTabClass("rephrase")}
        >
          Rephraser
        </button>
        <NavLink
          to="/history"
          className={({ isActive }) =>
            `flex-1 text-center py-2 rounded-full text-[13px] font-medium transition-all ${
              isActive
                ? "bg-indigo-600 text-white font-semibold"
                : "text-gray-500"
            }`
          }
        >
          History
        </NavLink>
      </div>

      {isApiKeySet === false && (
        <div className="mx-4 sm:mx-6 mt-2 bg-amber-50 rounded-ctrl p-3.5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[12.5px] text-amber-700 leading-relaxed">
            <span className="font-bold">Missing Gemini API key:</span> AI actions
            may fail. Please ensure your
            <code className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md mx-1 font-mono text-[11px]">
              GEMINI_API_KEY
            </code>
            secret is populated in the AI Studio Secrets panel.
          </div>
        </div>
      )}

      <Outlet />

      <footer className="mt-auto h-16 px-6 flex items-center justify-between text-gray-400 select-none">
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[11px] italic">Powered by love ❤️</span>
        </div>
        <button
          type="button"
          onClick={() => setShortcutsOpen(true)}
          className="text-[11px] font-medium text-gray-400 hover:text-indigo-600 transition"
        >
          Shortcuts · ?
        </button>
      </footer>

      <ShortcutsCheatsheet
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}

export default function RootLayout() {
  const { isValid } = useAuth();

  if (!isValid) {
    return <LoginScreen />;
  }

  return (
    <HistoryProvider>
      <LanguageProvider>
        <WorkspaceTabProvider>
          <WorkspaceProvider>
            <AppShell />
          </WorkspaceProvider>
        </WorkspaceTabProvider>
      </LanguageProvider>
    </HistoryProvider>
  );
}
