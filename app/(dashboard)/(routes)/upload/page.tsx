'use client';
import { useState, useCallback, useEffect } from "react";
import { app } from "@/firebaseConfig";
import UploadForm from "./_components/UploadForm";
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from "firebase/storage";
import { doc, getFirestore, setDoc } from "firebase/firestore";
import { useUser } from "@clerk/nextjs";
import { generateRandomString } from "@/GenerateRandomString";
import { useRouter } from "next/navigation";

export default function Upload() {
  const { user, isSignedIn } = useUser();
  const storage = getStorage(app);
  const db = getFirestore(app);
  const router = useRouter();
  const [id, setId] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const saveInfo = useCallback(async (file: File, fileUrl: string) => {
    const userEmail = user?.primaryEmailAddress?.emailAddress || '';
    const userName = user?.fullName || '';
    const docId = generateRandomString();
    console.log(`Generated docId: ${docId}`);

    try {
      await setDoc(doc(db, "uploadedFile", docId), {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileUrl: fileUrl,
        userEmail: userEmail,
        userName: userName,
        password: '',
        id: docId,
        shortUrl: `${process.env.NEXT_PUBLIC_BASE_URL}${docId}`
      });
      setId(docId);
      console.log(`filePreviewId set to: ${docId}`); // Debug log
    } catch (error) {
      console.error('Error setting document in Firestore', error);
      setError('Error setting document in Firestore. Please try again.');
    }
  }, [db, user]);

  // The updated uploadFile function with error handling for root reference issue
  const uploadFile = useCallback((file: File) => {
    if (!isSignedIn) {
      setError('You must be signed in to upload files.');
      return;
    }

    if (!file || !file.name) {
      setError('Invalid file. Please select a file.');
      return;
    }

    const metadata = {
      contentType: file.type,
    };
    
    // Create a non-root reference using the file name
    const storageRef = ref(storage, `file-upload/${file.name}`);

    const uploadTask = uploadBytesResumable(storageRef, file, metadata);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log('Upload is ' + progress + '% done');
        setProgress(progress);
      },
      (error) => {
        console.error('Upload failed', error);
        setError('Upload failed. Please try again.');
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          console.log("File is available at", downloadURL);
          await saveInfo(file, downloadURL);
        } catch (error) {
          console.error('Error saving file info', error);
          setError('Error saving file info. Please try again.');
        }
      }
    );
  }, [isSignedIn, saveInfo, storage]);

  useEffect(() => {
    if (id) {
      router.push(`/file-preview/${id}`);
    }
  }, [id, router]);

  return (
    <div className="p-5 px-8 md:px-28">
      <h2 className="text-[20px] text-center m-5">
        Start <strong className="text-red-300">Uploading</strong> Files and <strong className="text-red-300">Share</strong>
      </h2>
      {error && <p className="text-red-500 text-center">{error}</p>}
      <UploadForm fileUploadClick={uploadFile} progress={progress} fileId={id} />
    </div>
  );
}


