"use client"

import React from 'react'
import { User, LifeBuoy, Lightbulb, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Separator } from '../ui/separator'
import { LoadingWave } from '../ui/loading-wave'
import { useState } from 'react'

const maskEmail = (email: string) => {
  if (!email) return '***';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  if (!local || local.length === 0) return `***@${domain}`;
  const first = local[0];
  const last = local.length > 1 ? local[local.length - 1] : '';
  const maskLength = Math.max(local.length - 2, 4);
  const masked = '*'.repeat(maskLength);
  return `${first}${masked}${last ? last : ''}@${domain}`;
};

export default function ProfileDropdown({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (!isOpen) return null

  const maskedEmail = user?.email ? maskEmail(user.email) : 'Loading...';

  const handleSignOut = async () => {
    setIsSigningOut(true);

    // Call logout (now optimistic and fast)
    logout();

    // Redirect immediately to login page
    if (typeof window !== 'undefined') {
      // Use a tiny timeout to let the state update (isSigningOut) reflect 
      // though redirected immediately is also fine
      setTimeout(() => {
        window.location.href = '/login';
      }, 500); // 500ms is enough for the user to see the "Signing out" toast
    }
  };

  const handleSuggestFeature = () => {
    // TODO: Implement suggestion modal
    window.open('https://dashboard.zuperior.com/support', '_blank');
    onClose();
  };


  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Signing Out Toast */}
      {isSigningOut && (
        <div className="fixed top-6 right-6 z-[100] flex items-center gap-4 px-5 py-3.5 bg-background border border-foreground/10 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
          <LoadingWave />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">Signing out</span>
            <span className="text-[11px] text-foreground/40">Please wait a moment...</span>
          </div>
        </div>
      )}

      {/* Dropdown Container */}
      <div className="absolute top-full right-0 mt-2 w-64 bg-background border border-foreground/10 rounded-md shadow-xl z-50 overflow-visible">
        <div className="p-2 space-y-1 relative">
          {/* Header - User Info */}
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm text-foreground/80">
              <User className="h-4 w-4" />
              <span className="font-mono">{maskedEmail}</span>
            </div>
          </div>

          <Separator className="bg-white/10" />

          {/* Support */}
          <a
            href="https://dashboard.zuperior.com/support"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left hover:bg-white/5 rounded group"
            onClick={onClose}
          >
            <LifeBuoy className="h-4 w-4 text-foreground/60 group-hover:text-foreground" />
            <span className="text-foreground/80 group-hover:text-foreground">Support</span>
          </a>

          {/* Suggest a feature */}
          <button
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left hover:bg-white/5 rounded group"
            onClick={handleSuggestFeature}
          >
            <Lightbulb className="h-4 w-4 text-foreground/60 group-hover:text-foreground" />
            <span className="text-foreground/80 group-hover:text-foreground">Suggest a feature</span>
          </button>

          <Separator className="bg-white/10" />

          {/* Sign Out */}
          <button
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left hover:bg-white/5 rounded text-danger group"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </>
  )
}
