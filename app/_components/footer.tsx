'use client'

export default function Footer() {
  return (
    <footer className="bg-rose-600 text-white py-4 sticky bottom-0 pb-0">
      <div className="container mx-auto text-center">
        <p className="text-sm">
          &copy; {new Date().getFullYear()} File Drive. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
