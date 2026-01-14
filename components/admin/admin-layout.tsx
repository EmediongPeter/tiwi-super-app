"use client";

import { useState, ReactNode, createContext, useContext, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IoHomeOutline,
  IoChevronBackOutline,
  IoNotificationsOutline,
  IoWalletOutline,
  IoWaterOutline,
  IoAlertCircleOutline,
  IoDocumentTextOutline,
  IoSearchOutline,
  IoPersonOutline,
  IoChevronDownOutline,
  IoLogOutOutline,
} from "react-icons/io5";
import { HiOutlineBolt } from "react-icons/hi2";
import { TbCoins } from "react-icons/tb";
import { useAdminAuth } from "@/lib/frontend/contexts/admin-auth-context";

interface AdminLayoutProps {
  children: ReactNode;
  activeNavItem?: string;
}

// Create context for search state
const AdminSearchContext = createContext<{
  searchQuery: string;
  setSearchQuery: (query: string) => void;
} | null>(null);

export function useAdminSearch() {
  const context = useContext(AdminSearchContext);
  if (!context) {
    throw new Error("useAdminSearch must be used within AdminLayout");
  }
  return context;
}

export default function AdminLayout({
  children,
  activeNavItem,
}: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { user, signOut } = useAdminAuth();

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setIsUserMenuOpen(false);
  };

  // Format email for display
  const displayEmail = user?.email || 'Admin';
  const displayName = user?.email?.split('@')[0] || 'Admin';

  const navItems = [
    { icon: IoHomeOutline, label: "Dashboard", href: "/admin", key: "dashboard" },
    { icon: IoChevronBackOutline, label: "Collapse", action: true, key: "collapse" },
    { icon: HiOutlineBolt, label: "Quick Actions", href: "#", key: "quick-actions" },
    { icon: TbCoins, label: "Tokens", href: "/admin/tokens", key: "tokens" },
    { icon: IoNotificationsOutline, label: "Notifications", href: "/admin/notifications", key: "notifications" },
    { icon: IoWalletOutline, label: "Staking Pools", href: "/admin/staking-pools", key: "staking-pools" },
    { icon: IoWaterOutline, label: "Liquidity Pools", href: "/admin/liquidity-pools", key: "liquidity-pools" },
    { icon: IoAlertCircleOutline, label: "Create Adverts", href: "/admin/adverts", key: "create-adverts" },
    { icon: IoDocumentTextOutline, label: "Support Hub", href: "/admin/support-hub", key: "support-hub" },
  ];

  return (
    <div className="min-h-screen bg-[#010501] flex">
      {/* Sidebar - Hidden on mobile */}
      <aside
        className={`${
          sidebarCollapsed ? "w-20" : "w-64"
        } hidden lg:flex bg-[#0b0f0a] border-r border-[#1f261e] transition-all duration-300 flex-col shrink-0`}
      >
        {/* Logo */}
        <div className={`p-6 flex items-center ${sidebarCollapsed ? "justify-center" : "justify-start gap-3"}`}>
          <div className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 relative shrink-0">
            <Image
              src="/assets/logos/tiwi-logo.svg"
              alt="TIWI Logo"
              width={40}
              height={40}
              className="object-contain w-full h-full"
            />
          </div>
          {!sidebarCollapsed && (
            <div className="text-white font-bold text-sm sm:text-base leading-tight">
              <p className="m-0">TIWI</p>
              <p className="m-0">Protocol</p>
            </div>
          )}
        </div>

        

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeNavItem ? activeNavItem === item.key : (item.href && item.href !== "#" && pathname === item.href);
            const isCollapse = item.action;

            if (isCollapse) {
              return (
                <button
                  key={index}
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[#b5b5b5] hover:text-white hover:bg-[#121712] rounded-lg transition-colors"
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                </button>
              );
            }

            const content = (
              <>
                <Icon className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </>
            );

            if (item.href) {
              const isComingSoon = item.key === "liquidity-pools";
              
              return (
                <Link
                  key={index}
                  href={item.href}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative ${
                    isActive
                      ? "bg-[#121712] text-[#b1f128]"
                      : "text-[#b5b5b5] hover:text-white hover:bg-[#121712]"
                  }`}
                >
                  {content}
                  {isComingSoon && !sidebarCollapsed && (
                    <span className="ml-auto px-2 py-0.5 bg-[#081f02] border border-[#b1f128] rounded text-[#b1f128] text-xs font-medium whitespace-nowrap">
                      Soon
                    </span>
                  )}
                  {isComingSoon && sidebarCollapsed && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#b1f128] rounded-full"></span>
                  )}
                </Link>
              );
            }

            return (
              <button
                key={index}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-[#121712] text-[#b1f128]"
                    : "text-[#b5b5b5] hover:text-white hover:bg-[#121712]"
                }`}
              >
                {content}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="lg:hidden bg-[#010501] px-4 py-2 flex items-center justify-end border-b border-[#1f261e]">
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 bg-white rounded-full"></div>
            <div className="w-1 h-1 bg-white rounded-full"></div>
            <div className="w-1 h-1 bg-white rounded-full"></div>
          </div>
        </div>

        {/* Desktop Header */}
        <header className="bg-[#0b0f0a] border-b border-[#1f261e] px-4 lg:px-6 py-4 flex items-center gap-3 lg:gap-4">
          {/* Search */}
          <div className="relative hidden lg:block flex-1">
            <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7c7c7c]" />
            <input
              type="text"
              placeholder="Search Dashboard..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#121712] border border-[#1f261e] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-[#7c7c7c] focus:outline-none focus:border-[#b1f128] w-full"
            />
          </div>
          {/* User Profile Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-[#121712] border border-[#1f261e] rounded-lg hover:bg-[#1a1f1a] transition-colors"
            >
              <div className="flex flex-col items-end">
                <span className="text-white text-xs font-medium">{displayName}</span>
                <span className="text-[#b5b5b5] text-xs">Admin</span>
              </div>
              <IoChevronDownOutline className={`w-4 h-4 lg:w-5 lg:h-5 text-[#b1f128] transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-[#121712] border border-[#1f261e] rounded-lg shadow-lg z-50">
                <div className="p-3 border-b border-[#1f261e]">
                  <p className="text-white text-sm font-medium">{displayName}</p>
                  <p className="text-[#b5b5b5] text-xs truncate">{displayEmail}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[#b5b5b5] hover:text-white hover:bg-[#1a1f1a] transition-colors"
                >
                  <IoLogOutOutline className="w-5 h-5" />
                  <span className="text-sm font-medium">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <AdminSearchContext.Provider value={{ searchQuery, setSearchQuery }}>
          {children}
        </AdminSearchContext.Provider>
      </div>
    </div>
  );
}

