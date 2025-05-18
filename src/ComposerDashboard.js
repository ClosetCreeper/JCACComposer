// Composer's Dashboard - React + Firebase (with Comments + Both Play Option + File Input Labels)

import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, addDoc, doc, deleteDoc, updateDoc,
  onSnapshot, query, orderBy
} from 'firebase/firestore';
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from 'firebase/storage';
import {
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID,
  measurementId: process.env.REACT_APP_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export default function ComposerDashboard() {
  const [user, setUser] = useState(null);
  const [cues, setCues] = useState([]);
  const [title, setTitle] = useState('');
  const [play, setPlay] = useState('Julius Caesar');
  const [audioFile, setAudioFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [newComments, setNewComments] = useState({});

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Real-time fetch cues ordered by creation date
  useEffect(() => {
    const q = query(collection(db, 'cues'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setCues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleSignIn = () => signInWithPopup(auth, provider);
  const handleSignOut = () => signOut(auth);

  const handleAddCue = async () => {
    if (!title || !audioFile || !pdfFile) return;

    const audioRef = ref(storage, `audio/${Date.now()}-${audioFile.name}`);
    const pdfRef = ref(storage, `sheetmusic/${Date.now()}-${pdfFile.name}`);

    await uploadBytes(audioRef, audioFile);
    await uploadBytes(pdfRef, pdfFile);

    const audioURL = await getDownloadURL(audioRef);
    const pdfURL = await getDownloadURL(pdfRef);

    await addDoc(collection(db, 'cues'), {
      title,
      play,
      audioURL,
      pdfURL,
      createdAt: new Date(),
      comments: [],
    });

    setTitle('');
    setPlay('Julius Caesar');
    setAudioFile(null);
    setPdfFile(null);
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'cues', id));
  };

  // Handle comment input change per cue
  const handleCommentChange = (cueId, text) => {
    setNewComments(prev => ({ ...prev, [cueId]: text }));
  };

  // Add new comment to Firestore
  const handleAddComment = async (cueId) => {
    const commentText = newComments[cueId]?.trim();
    if (!commentText) return;

    const cueDocRef = doc(db, 'cues', cueId);
    const cue = cues.find(c => c.id === cueId);
    if (!cue) return;

    const updatedComments = cue.comments ? [...cue.comments, commentText] : [commentText];

    await updateDoc(cueDocRef, {
      comments: updatedComments,
    });

    setNewComments(prev => ({ ...prev, [cueId]: '' }));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto text-gray-900 font-sans">
      <header className="flex justify-between items-center mb-10 border-b pb-4">
        <h1 className="text-4xl font-extrabold tracking-tight">🎼 Composer's Dashboard</h1>
        {user ? (
          <button
            onClick={handleSignOut}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded shadow"
          >
            Sign Out
          </button>
        ) : (
          <button
            onClick={handleSignIn}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
          >
            Sign In with Google
          </button>
        )}
      </header>

      {user && (
        <div className="mb-12 bg-gray-100 p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Add a Cue</h2>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <input
              type="text"
              placeholder="Cue Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 border rounded p-2"
            />
            <select
              value={play}
              onChange={(e) => setPlay(e.target.value)}
              className="border p-2 rounded"
            >
              <option value="Julius Caesar">Julius Caesar</option>
              <option value="Antony and Cleopatra">Antony and Cleopatra</option>
              <option value="Both">Both</option>
            </select>

            <div className="flex flex-col">
              <label htmlFor="audioFile" className="text-sm font-medium mb-1">Upload Audio</label>
              <input
                id="audioFile"
                type="file"
                accept="audio/*"
                onChange={(e) => setAudioFile(e.target.files[0])}
                className="text-sm"
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="pdfFile" className="text-sm font-medium mb-1">Upload Sheet Music (PDF)</label>
              <input
                id="pdfFile"
                type="file"
                accept="application/pdf"
                onChange={(e) => setPdfFile(e.target.files[0])}
                className="text-sm"
              />
            </div>

            <button
              onClick={handleAddCue}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow"
            >
              Add Cue
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-6">
        {cues.map((cue) => (
          <li key={cue.id} className="bg-white p-6 rounded-lg shadow-md border">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold">{cue.title}</h2>
                <p className="text-sm italic text-gray-500">{cue.play}</p>
                <audio controls src={cue.audioURL} className="my-3 w-full" />
                <a
                  href={cue.pdfURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  View Sheet Music
                </a>
              </div>
              {user && (
                <button
                  onClick={() => handleDelete(cue.id)}
                  className="text-red-500 hover:text-red-700"
                  title="Delete Cue"
                >
                  🗑️
                </button>
              )}
            </div>

            <div className="mt-4">
              <h3 className="font-semibold mb-2">Comments</h3>
              <ul className="space-y-1 text-sm">
                {cue.comments && cue.comments.length > 0 ? (
                  cue.comments.map((comment, index) => (
                    <li key={index} className="bg-gray-100 p-2 rounded">
                      {comment}
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500 italic">No comments yet.</li>
                )}
              </ul>

              {/* Comment input and submit button */}
              <input
                type="text"
                placeholder="Add a comment"
                value={newComments[cue.id] || ''}
                onChange={(e) => handleCommentChange(cue.id, e.target.value)}
                className="border p-2 rounded w-full mt-2"
              />
              <button
                onClick={() => handleAddComment(cue.id)}
                className="mt-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
              >
                Submit
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
