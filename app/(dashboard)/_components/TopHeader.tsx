'use client'

import { useState } from 'react'
import { UserButton } from '@clerk/nextjs'
import { AlignJustify, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

export default function TopHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen)

  const handleLinkClick = () => {
    if (isMenuOpen) {
      setIsMenuOpen(false)
    }
  }

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
            src="/logo.svg"
            width={30}
            height={30}
            alt="logo"
            className="md:hidden"
          />
        </Link>
      </header>

      {isMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu overlay"
            className="fixed inset-0 bg-black opacity-50 z-40"
            onClick={handleLinkClick}
          />
          <div
            className={`fixed top-0 left-0 w-64 h-full bg-white shadow-lg md:hidden z-50 transition-transform transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <span className="text-lg font-bold">Menu</span>
              <X
                className="cursor-pointer"
                onClick={handleLinkClick}
                size={24}
              />
            </div>
            <nav className="flex flex-col p-4 space-y-2">
              <Link
                href="/upload"
                passHref
                className="py-2 border-b text-lg block cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={handleLinkClick}
              >
                Upload
              </Link>
              <Link
                href="/files"
                passHref
                className="py-2 border-b text-lg block cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={handleLinkClick}
              >
                Files
              </Link>
            </nav>
          </div>
        </>
      )}
    </div>
  )
}
