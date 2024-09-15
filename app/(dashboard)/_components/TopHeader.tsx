import { UserButton } from "@clerk/nextjs";
import { AlignJustify } from "lucide-react";
import Image from "next/image";

export default function TopHeader(){
    return(
    <div className="flex p-5 border-b items-center justify-between md:justify-end">
    <AlignJustify className="md:hidden" />
     <UserButton />
     <Image 
     src='/logo.svg'
      width={60} height={100}  alt="logo" className="md:hidden"/>
    </div>
    );
}