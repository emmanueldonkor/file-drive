'use client'
import { useEffect } from "react";
export default function FilePreview( {props}:any){
   useEffect(() =>{
    console.log(props?.id)
   }, []);

   return (
    <div>File Preview</div>
   )
}
