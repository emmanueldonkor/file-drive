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
      width={40} height={40}  alt="logo" className="md:hidden"/>
    </div>
    );
}