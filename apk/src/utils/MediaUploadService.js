// utils/MediaUploadService.js
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
// CRITICAL: Ensure this path is correct based on the directory structure. 
// Assuming firebaseConfig.jsx is in the same 'utils' folder:
import { storage } from './firebaseConfig'; // Changed to remove the .jsx extension since ES modules often resolve it.

/**
 * Uploads a file to Firebase Storage and returns the public download URL.
 * @param {File} file - The file to upload.
 * @param {string} folder - The folder path in Firebase Storage (e.g., 'stories/' or 'posts/').
 * @param {function} setProgress - State setter function (0-100) for tracking upload progress.
 * @returns {Promise<string>} The public URL of the uploaded file.
 */
export const uploadMediaToFirebase = (file, folder, setProgress) => {
    return new Promise((resolve, reject) => {
        if (!file) {
            return reject(new Error("No media file provided."));
        }
        // CRITICAL CHECK for null storage
        if (!storage) {
            console.error("FIREBASE STORAGE IS NOT INITIALIZED.");
            return reject(new Error("Firebase storage is not ready. Check firebaseConfig or import path."));
        }

        const fileExtension = file.name.split('.').pop();
        const uniqueName = `${folder}/${Date.now()}_${Math.round(Math.random() * 1E9)}.${fileExtension}`;

        const storageRef = ref(storage, uniqueName);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
            'state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setProgress(progress);
            },
            (error) => {
                console.error('Error uploading file to Firebase:', error);
                reject(new Error(`Firebase upload failed: ${error.message}`));
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
            }
        );
    });
};