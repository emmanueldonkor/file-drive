'use client'
import { File, Upload } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
export default function SideBar() {
  const menuList = [
    {
      id: 1,
      name: 'upload',
      icon: Upload,
      path: '/upload',
    },
    {
      id: 2,
      name: 'files',
      icon: File,
      path: '/files',
    },
  ]
  const [activeIndex, setActiveIndex] = useState(0)
  return (
    <div className="shadow-sm border-r h-full">
      <div className="p-5 border-b">
        <Link href="/">
          <Image src="/logo.svg" width={30} height={30} alt="logo" />
        </Link>
      </div>
      <div className="flex flex-col float-left w-full">
        {menuList.map((item) => (
          <Link
            href={item.path}
            key={item.id}
            className={`flex gap-2 p-4 px-6 hover:bg-gray-100 w-full text-gray-500 ${activeIndex === item.id ? 'bg-blue-50 text-blue-500' : null}`}
            onClick={() => setActiveIndex(item.id)}
          >
            <item.icon />
            <h2>{item.name}</h2>
          </Link>
        ))}
      </div>
    </div>
  )
}
