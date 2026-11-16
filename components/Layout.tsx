import React, { ReactNode, useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAppContext } from "../context/AppContext";
import {
  LayoutDashboard,
  CheckSquare,
  MessageSquare,
  FileText,
  Mic,
  Users,
  LogOut,
  Rocket,
  Menu,
  X,
} from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const router = useRouter();
  const { logout, currentUser } = useAppContext();

  const [isLoading, setIsLoading] = useState(true);
  const [isLocallyAuthenticated, setIsLocallyAuthenticated] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const authStatus = localStorage.getItem("isAuthenticated") === "true";
      setIsLocallyAuthenticated(authStatus);
      setIsLoading(false);
    };

    checkAuth();
    window.addEventListener("storage", checkAuth);
    return () => window.removeEventListener("storage", checkAuth);
  }, []);

  useEffect(() => {
    if (!isLoading && !isLocallyAuthenticated) {
      router.push("/auth");
    }
  }, [isLocallyAuthenticated, router, isLoading]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [router.pathname]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Tasks", href: "/tasks", icon: CheckSquare },
    { name: "Chat", href: "/chat", icon: MessageSquare },
    { name: "Files", href: "/files", icon: FileText },
    { name: "Pitch", href: "/pitch", icon: Mic },
    { name: "Team", href: "/team", icon: Users },
  ];

  const handleLogout = () => {
    logout();
    if (typeof window !== "undefined") {
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("token");
    }
    router.push("/auth");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#312e81] text-white">
        <div className="loader"></div>
      </div>
    );
  }

  if (!isLocallyAuthenticated) return null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-[#0f172a] to-[#312e81] text-white">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0f172a]/90 backdrop-blur-md border-b border-gray-700/80 sticky top-0 z-30">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-lg flex items-center justify-center shadow">
            <Rocket className="text-white w-4 h-4" />
          </div>
          <span className="font-semibold text-lg tracking-tight">HackHub</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-gray-800/80 text-gray-200 hover:text-white hover:bg-gray-700/80 focus:outline-none transition-colors"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Drawer Backdrop & Menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            className="w-72 max-w-[85vw] h-full bg-[#0f172a] border-r border-gray-700 p-5 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center shadow">
                  <Rocket className="text-white w-4 h-4" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold leading-tight">HackHub</h1>
                  <p className="text-[11px] text-zinc-400">Collaborative Platform</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto">
              <ul className="space-y-1.5">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = router.pathname === item.href;
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          isActive
                            ? "bg-gradient-to-r from-cyan-600 to-purple-600 text-white shadow-md"
                            : "text-gray-300 hover:bg-gray-800/60 hover:text-white"
                        }`}
                      >
                        <Icon className="mr-3 w-4 h-4" />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="mt-auto pt-4 border-t border-gray-800">
              <div className="flex items-center mb-3 px-1">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-xs font-semibold">
                  {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "👤"}
                </div>
                <div className="ml-3 truncate">
                  <p className="font-medium text-sm truncate">{currentUser?.name || "User"}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {currentUser?.role || "Team Member"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-start px-3.5 py-2.5 rounded-lg text-sm text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-colors"
              >
                <LogOut className="mr-3 w-4 h-4 text-red-400" />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 h-screen bg-[#0f172a]/70 backdrop-blur-md border-r border-gray-700/80 p-4 flex-col shrink-0 sticky top-0">
        <div className="mb-6 text-center">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl mx-auto mb-2 flex items-center justify-center shadow-lg">
            <Rocket className="text-white w-5 h-5" />
          </div>
          <h1 className="text-2xl font-semibold">HackHub</h1>
          <p className="text-xs text-zinc-300 mt-1">Innovate. Collaborate. Launch.</p>
        </div>

        <nav className="flex-1">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = router.pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-cyan-600 to-purple-600 text-white shadow"
                        : "text-gray-300 hover:bg-gray-800/50 hover:text-white"
                    }`}
                  >
                    <Icon className="mr-3 w-5 h-5" />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto pt-4 border-t border-gray-700">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-xs font-bold">
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "👤"}
            </div>
            <div className="ml-3 truncate">
              <p className="font-medium text-sm truncate">{currentUser?.name || "User"}</p>
              <p className="text-xs text-gray-400 truncate">
                {currentUser?.role || "Team Member"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-start px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800/50 hover:text-white transition-all"
          >
            <LogOut className="mr-3 w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Responsive Content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 min-w-0">{children}</main>
    </div>
  );
};

export default Layout;
