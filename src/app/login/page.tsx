"use client";

import React, { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="min-h-screen flex flex-col justify-between p-6 md:p-12 relative bg-[#02040d] text-white font-sans">

            {/* Top Left Logo */}


            {/* Main Content Centered */}
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto z-10">

                {/* Centered Logo */}
                <img src="/logo-full.png" alt="Zuperior" className="h-22 mb-8" />

                {/* Header */}
                <h1 className="text-[28px] font-bold mb-2 text-center">Welcome to Zuperior</h1>
                <p className="text-gray-400 text-sm mb-8 text-center">Login to your trading terminal</p>

                {/* Form Fields */}
                <div className="w-full space-y-5">

                    {/* Email Input */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 ml-1">Your email address</label>
                        <input
                            type="email"
                            placeholder="Enter your email"
                            className="w-full bg-[#0b0c10] border border-gray-800 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#6366f1] transition-colors"
                        />
                    </div>

                    {/* Password Input */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 ml-1">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                className="w-full bg-[#0b0c10] border border-gray-800 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#6366f1] transition-colors pr-10"
                            />
                            <button
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                            >
                                {showPassword ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Continue Button */}
                    <button className="w-full bg-[#8257ff] hover:bg-[#7140fd] text-white font-semibold py-3 rounded-lg transition-colors mt-2">
                        Continue
                    </button>

                    {/* Forgot Password */}
                    <div className="text-center pt-2">
                        <a href="#" className="text-xs text-[#8257ff] hover:text-[#9e7cff] font-medium transition-colors">
                            I forgot my password
                        </a>
                    </div>

                </div>

            </div>

            {/* Footer */}
            <div className="w-full max-w-6xl mx-auto pt-10 border-t border-gray-900/50 flex flex-col md:flex-row justify-between items-start md:items-center text-xs text-gray-500 gap-6 z-10">

                {/* Legal Text */}
                <div className="flex-1 max-w-3xl space-y-2">
                    <p>
                        Zuperior does not offer services to residents of certain jurisdictions, including the USA, Iran, North Korea, the European Union, the United Kingdom and others. The content of the website including translations should not be construed as meaning for solicitation. Investors make their own and independent decisions.
                    </p>
                    <p>
                        Trading in CFDs and generally leveraged products involves substantial risk of loss and you may lose all of your invested capital.
                    </p>
                    <p>
                        Zuperior (SC) Ltd is a Securities Dealer registered in Seychelles with registration number 8423606-1 and authorised by the Financial Services Authority (FSA) with licence number SD025. The registered office of Zuperior (SC) Ltd is at 9A CT House, 2nd floor, Providence, Mahe, Seychelles.
                    </p>
                </div>

                {/* Links & Copyright */}
                <div className="flex flex-col gap-4 items-end">
                    <div className="flex gap-4 flex-wrap justify-end text-[#8257ff]">
                        <Link href="#" className="hover:underline">Privacy Agreement</Link>
                        <Link href="#" className="hover:underline">Risk disclosure</Link>
                        <Link href="#" className="hover:underline">Preventing money laundering</Link>
                        <Link href="#" className="hover:underline">Security instructions</Link>
                        <Link href="#" className="hover:underline">Legal documents</Link>
                    </div>
                    <div className="flex gap-4 flex-wrap justify-end text-[#8257ff]">
                        <Link href="#" className="hover:underline">Complaints Handling Policy</Link>
                    </div>
                    <div className="text-right mt-2">
                        © 2008-2025, Zuperior
                    </div>
                </div>

            </div>
        </div>
    );
}
