import { useState, useEffect, ChangeEvent } from "react";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import AlertMes from "./AlertMes";
import FilePreview from "./FilePreview";
import ProgressBar from "./ProgressBar";

interface UploadFormProps {
  fileUploadClick: (file: File) => void;
  progress: number;
  fileId: string;
}

export default function UploadForm({
  fileUploadClick,
  progress,
  fileId
}: UploadFormProps) {
  
  const [file, setFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploadComplete, setIsUploadComplete] = useState<boolean>(false);

  const onFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 200 * 1024 * 1024) {
        setErrorMessage("Maximum File Size (200MB) Exceeded!");
      } else {
        setErrorMessage(null);
        setFile(selectedFile);
      }
    }
  };

  useEffect(() => {
    if (progress === 100) {
      toast.success("File uploaded successfully!");
      setIsUploadComplete(true);
      setTimeout(() => {
        setFile(null);
        setIsUploadComplete(false);
      }, 2000);
    }
  }, [progress, fileId]);

  return (
    <div className="text-center">
      <ToastContainer />
      <div className="flex items-center justify-center w-full">
        <label
          htmlFor="dropzone-file"
          className="flex flex-col items-center justify-center w-full h-64 border-2 border-red-300 border-dashed rounded-lg cursor-pointer bg-red-50 hover:bg-gray-100"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg
              className="w-12 h-12 mb-4 text-red-500"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 20 16"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
              />
            </svg>
            <p className="mb-2 text-lg md:text-2xl text-gray-500">
              <span className="font-semibold">Click to upload</span> or{" "}
              <strong className="text-red-300">drag</strong> and
              <strong className="text-red-300">drop</strong>
            </p>
            <p className="text-xs text-gray-500">
              SVG, PNG, JPG, PDF or GIF (Max Size : 200MB)
            </p>
          </div>
          <input
            id="dropzone-file"
            type="file"
            className="hidden"
            onChange={onFileSelect}
          />
        </label>
      </div>
      {errorMessage && <AlertMes message={errorMessage} />}
      {file && <FilePreview file={file} removeFile={() => setFile(null)} />}
      {progress > 0 && progress < 100 ? (
        <ProgressBar progress={progress} />
      ) : (
        <button
          disabled={!file || isUploadComplete}
          className="p-2 bg-red-500 text-white w-[30%] rounded-full mt-5 disabled:bg-gray-500"
          onClick={() => {
            if (file) {
              fileUploadClick(file);
              setIsUploadComplete(false);
            }
          }}
        >
          Upload
        </button>
      )}
    </div>
  );
}



