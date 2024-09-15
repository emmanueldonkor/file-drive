'use client'
import { useState } from 'react';
import { UserButton } from "@clerk/nextjs";
import { AlignJustify, X } from "lucide-react";
import Image from 'next/image';
import Link from 'next/link';

export default function TopHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <div>
      <header className="flex p-5 border-b items-center justify-between md:justify-end">
        <AlignJustify
          className="md:hidden cursor-pointer"
          onClick={toggleMenu}
        />
        <UserButton />
        <Link href="/">
        <Image
          src='/logo.svg'
          width={30}
          height={30}
          alt="logo"
          className="md:hidden"
        />
        </Link>
      </header>

      {isMenuOpen && (
        <div className="fixed top-0 right-0 w-64 h-full bg-white shadow-lg md:hidden z-50">
          <div className="flex items-center justify-between p-4 border-b">
            <span className="text-lg font-bold">Menu</span>
            <X
              className="cursor-pointer"
              onClick={toggleMenu}
              size={24} 
            />
          </div>
          <nav className="flex flex-col p-4">
            <Link href="/upload" passHref className="py-2 border-b text-lg block cursor-pointer">
              Upload
            </Link>
            <Link href="/files" passHref className="py-2 border-b text-lg block cursor-pointer">
              Files
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}

