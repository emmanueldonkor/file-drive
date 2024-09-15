'use client';

import { useEffect, useState } from "react";
import { getFirestore, collection, query, where, getDocs, limit, startAfter, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { app } from "@/firebaseConfig";
import { useUser } from "@clerk/nextjs";
import { ToastContainer, toast } from 'react-toastify'; 
import 'react-toastify/dist/ReactToastify.css'; 

export default function Files() {
  const { user, isSignedIn } = useUser();
  const db = getFirestore(app);
  const storage = getStorage(app);
  const [files, setFiles] = useState<any[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');

  const fileTypeMapping = (fileType: string) => {
    if (fileType.startsWith('image/')) return 'Image';
    if (fileType.startsWith('video/')) return 'Video';
    if (fileType === 'application/pdf') return 'PDF';
    if (fileType.includes('document')) return 'Doc';
    return 'Other';
  };

  const getFileName = (fileName: string) => {
    return fileName.split('.').slice(0, -1).join('.');
  };

  const fetchFiles = async () => {
    if (!hasMore) return;
    setLoading(true);
    try {
      const userEmail = user?.primaryEmailAddress?.emailAddress || '';
      if (!userEmail) {
        setError('Unable to identify user.');
        setLoading(false);
        return;
      }

      let q = query(
        collection(db, "uploadedFile"),
        where("userEmail", "==", userEmail),
        limit(10)
      );

      if (lastDoc) {
        q = query(
          collection(db, "uploadedFile"),
          where("userEmail", "==", userEmail),
          startAfter(lastDoc),
          limit(10)
        );
      }

      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setHasMore(false);
      } else {
        const fileList = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setFiles((prevFiles) => [...prevFiles, ...fileList]);
        setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
        if (querySnapshot.size < 10) setHasMore(false);
      }
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch files');
      setLoading(false);
    }
  };

  const generateShareLink = async (file:any) => {
    try {
      if (!file.fileUrl) {
        throw new Error('File URL is missing or invalid.');
      }
      const shareLink = file.fileUrl; 
      if (typeof window !== "undefined") {
        
        await navigator.clipboard.writeText(shareLink);
        toast.success(`Share link for "${getFileName(file.fileName)}" copied to clipboard!`);
      }
    } catch (err) {
      toast.error('Failed to generate share link. Error: ' + err);
    }
  };
  
  useEffect(() => {
    if (isSignedIn) {
      fetchFiles();
    }
  }, [isSignedIn, user]);

  if (loading && files.length === 0) {
    return <p>Loading files...</p>;
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  return (
    <div className="p-6">
      <h3 className="text-center text-3xl font-bold mb-6 text-black-800">Your Uploaded Files</h3>
      {files.length > 0 ? (
        <>
          <div className="overflow-x-auto shadow rounded-lg border border-gray-200 mb-4">
            <table className="min-w-full bg-white border-collapse">
              <thead className="bg-orange-400 text-white">
                <tr>
                  <th className="py-3 px-6 text-left">File Name</th>
                  <th className="py-3 px-6 text-left">File Size</th>
                  <th className="py-3 px-6 text-left">File Type</th>
                  <th className="py-3 px-6 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {files.map((file, index) => (
                  <tr key={index} className="border-t hover:bg-gray-100">
                    <td className="py-3 px-6">{getFileName(file.fileName)}</td>
                    <td className="py-3 px-6">{(file.fileSize / (1024 * 1024)).toFixed(2)} MB</td>
                    <td className="py-3 px-6">{fileTypeMapping(file.fileType)}</td>
                    <td className="py-3 px-6 flex space-x-3">
                      <a
                        href={file.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 transition-colors duration-300"
                      >
                        Preview
                      </a>
                      <a
                        href={file.fileUrl}
                        download={file.fileName}
                        className="text-green-600 hover:text-green-800 transition-colors duration-300"
                      >
                        Download
                      </a>
                      <button
                        className="text-yellow-600 hover:text-yellow-800 transition-colors duration-300"
                        onClick={() => generateShareLink(file)}
                      >
                        Share
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="flex justify-center">
              <button
                onClick={fetchFiles}
                className="p-3 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors duration-300"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More Files'}
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-center text-gray-700">No files uploaded yet.</p>
      )}
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
    </div>
  );
}
