"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check token on mount and pathname change
    const checkAuth = () => {
      const token = localStorage.getItem("token");
      setIsLoggedIn(!!token);
    };

    checkAuth();

    // Listen for storage events (logout in another tab)
    window.addEventListener('storage', checkAuth);

    // Listen for custom auth event (login/logout in same tab)
    window.addEventListener('authStateChanged', checkAuth);

    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('authStateChanged', checkAuth);
    };
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setIsLoggedIn(false);
    window.dispatchEvent(new Event('authStateChanged'));
    router.push("/login");
  };

  const links = isLoggedIn
    ? [
        { href: "/", label: "Home" },
        { href: "/map", label: "Map" },
        { href: "/friends", label: "Friends" },
      ]
    : [
        { href: "/", label: "Home" },
        { href: "/login", label: "Login" },
        { href: "/register", label: "Register" },
      ];

  return (
    <nav className="bg-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold hover:text-gray-300">
              Mappico
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-gray-900 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {isLoggedIn && (
              <button
                onClick={handleLogout}
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-red-700 hover:text-white transition-colors"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
