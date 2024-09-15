import { AlertCircle } from "lucide-react";

interface AlertMesProps {
  message: string;
}
export default function AlertMes({ message }: AlertMesProps) {
  return (
    <div className="p-4 bg-red-500 mt-5 text-white rounded-md flex gap-5 items-center">
      <AlertCircle />
      {message}
    </div>
  );
}
