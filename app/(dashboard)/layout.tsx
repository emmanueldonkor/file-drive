import SideBar from "./_components/SideBar";
import TopHeader from "./_components/TopHeader";

export default function layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div>
      <div className=" h-full md:w-64 flex-col fixed inset-y-0 z-50 md:flex hidden">
        <SideBar />
      </div>
      <div className="md:ml-64">
        <TopHeader />
        {children}
      </div>
    </div>
  );
}
