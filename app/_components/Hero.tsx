
import Link from "next/link";
export default function Hero(){
    return(
        <section
        className="relative bg-[url('https://images.unsplash.com/photo-1557752281-de0f47de1ab9?q=80&w=1780&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')] bg-cover bg-center bg-no-repeat"
      >
        <div className="absolute inset-0 bg-white/75 sm:bg-transparent sm:from-white/95 sm:to-white/25 sm:bg-gradient-to-r"></div>
        <div className="relative mx-auto max-w-screen-xl px-4 py-32 sm:px-6 lg:flex lg:h-screen lg:items-center lg:px-8">
          <div className="max-w-xl text-center sm:text-left">
            <h1 className="text-3xl font-extrabold sm:text-5xl">
              Upload, Save and Share 
              <strong className="block font-extrabold text-rose-700"> In one place. </strong>
            </h1>
  
            <p className="mt-4 max-w-lg sm:text-xl/relaxed">
              Store and share your files with ease. File Drive is a simple, secure, and free file storage service. 
            </p>
  
            <div className="mt-8 flex flex-wrap gap-4 text-center">
              <Link href="/upload" className="block w-full rounded bg-rose-600 px-12 py-3 text-sm font-medium text-white shadow hover:bg-rose-700 focus:outline-none focus:ring active:bg-rose-500 sm:w-auto">
                  Get Started
              </Link>
              <Link href="/" className="block w-full rounded bg-white px-12 py-3 text-sm font-medium text-rose-600 shadow hover:text-rose-700 focus:outline-none focus:ring active:text-rose-500 sm:w-auto">
                  Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
}