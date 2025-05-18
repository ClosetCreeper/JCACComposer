import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, addDoc, doc, deleteDoc,
  onSnapshot, query, orderBy, updateDoc, arrayUnion
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

function AudioPlayer({ src, cueId }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const savedTime = localStorage.getItem(`audioTime-${cueId}`);
    if (savedTime) setCurrentTime(parseFloat(savedTime));
  }, [cueId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const timeUpdateHandler = () => {
      setCurrentTime(audio.currentTime);
      localStorage.setItem(`audioTime-${cueId}`, audio.currentTime);
    };

    audio.addEventListener('timeupdate', timeUpdateHandler);
    return () => audio.removeEventListener('timeupdate', timeUpdateHandler);
  }, [cueId]);

  useEffect(() => {
    if (audioRef.current && Math.abs(audioRef.current.currentTime - currentTime) > 1) {
      audioRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      if (currentTime > 0) {
        audioRef.current.currentTime = currentTime;
      }
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const skipTime = (seconds) => {
    if (!audioRef.current) return;

    let newTime = audioRef.current.currentTime + seconds;
    if (newTime < 0) newTime = 0;
    if (newTime > duration) newTime = duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const backupPosition = () => {
    localStorage.setItem(`audioBackup-${cueId}`, currentTime);
    alert('Audio position backed up!');
  };

  const restorePosition = () => {
    const backup = localStorage.getItem(`audioBackup-${cueId}`);
    if (backup) {
      setCurrentTime(parseFloat(backup));
      if (audioRef.current) {
        audioRef.current.currentTime = parseFloat(backup);
      }
      alert('Audio position restored!');
    } else {
      alert('No backup found for this audio.');
    }
  };

  return (
    <div className="flex flex-col space-y-1 my-3">
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      <div className="flex items-center space-x-2">
        <button onClick={() => skipTime(-10)} className="px-2 py-1 bg-gray-300 rounded hover:bg-gray-400">⏪ 10s</button>
        <button onClick={togglePlayPause} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
          {isPlaying ? '⏸ Pause' : '▶️ Play'}
        </button>
        <button onClick={() => skipTime(10)} className="px-2 py-1 bg-gray-300 rounded hover:bg-gray-400">10s ⏩</button>
        <button onClick={backupPosition} className="px-3 py-1 bg-yellow-400 rounded hover:bg-yellow-500 text-black">💾 Backup</button>
        <button onClick={restorePosition} className="px-3 py-1 bg-green-400 rounded hover:bg-green-500 text-black">🔄 Restore</button>
      </div>
      <div className="text-sm text-gray-600">
        {new Date(currentTime * 1000).toISOString().substr(14, 5)} / {duration ? new Date(duration * 1000).toISOString().substr(14, 5) : '00:00'}
      </div>
    </div>
  );
}

export default function ComposerDashboard() {
  const [user, setUser] = useState(null);
  const [cues, setCues] = useState([]);
  const [title, setTitle] = useState('');
  const [play, setPlay] = useState('Julius Caesar');
  const [audioFile, setAudioFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [commentingCueId, setCommentingCueId] = useState(null);
  const [editingCueId, setEditingCueId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPlay, setEditPlay] = useState('Julius Caesar');
  const [editAudioFile, setEditAudioFile] = useState(null);
  const [editPdfFile, setEditPdfFile] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'cues'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setCues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleSignIn = () => signInWithPopup(auth, provider);
  const handleSignOut = () => signOut(auth);

  const uploadFile = async (file, folder) => {
    const fileRef = ref(storage, `${folder}/${Date.now()}-${file.name}`);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  };

  const handleAddCue = async () => {
    if (!title || !audioFile || !pdfFile) {
      alert("Please fill all fields and upload files.");
      return;
    }
    try {
      const audioURL = await uploadFile(audioFile, 'audio');
      const pdfURL = await uploadFile(pdfFile, 'sheetmusic');

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
    } catch (e) {
      alert("Error uploading cue: " + e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this cue? This action cannot be undone.')) return;
    await deleteDoc(doc(db, 'cues', id));
  };

  const handleAddComment = async (cueId) => {
    if (!commentText.trim()) return;
    if (!user) return alert('Please sign in to comment.');

    const cueRef = doc(db, 'cues', cueId);
    const newComment = {
      username: user.displayName || user.email || 'Anonymous',
      text: commentText.trim(),
      id: Date.now().toString(),
    };

    await updateDoc(cueRef, {
      comments: arrayUnion(newComment),
    });

    setCommentText('');
    setCommentingCueId(null);
  };

  const handleDeleteComment = async (cueId, comment) => {
    if (!window.confirm('Delete this comment?')) return;
    const cueRef = doc(db, 'cues', cueId);
    await updateDoc(cueRef, {
      comments: arrayRemove(comment),
    });
  };

  const startEditingCue = (cue) => {
    setEditingCueId(cue.id);
    setEditTitle(cue.title);
    setEditPlay(cue.play);
    setEditAudioFile(null);
    setEditPdfFile(null);
  };

  const handleEditCue = async () => {
    if (!editingCueId) return;

    try {
      const cueRef = doc(db, 'cues', editingCueId);
      const updates = { title: editTitle, play: editPlay };

      if (editAudioFile) {
        const audioURL = await uploadFile(editAudioFile, 'audio');
        updates.audioURL = audioURL;
      }

      if (editPdfFile) {
        const pdfURL = await uploadFile(editPdfFile, 'sheetmusic');
        updates.pdfURL = pdfURL;
      }

      await updateDoc(cueRef, updates);

      setEditingCueId(null);
      setEditAudioFile(null);
      setEditPdfFile(null);
    } catch (e) {
      alert('Error updating cue: ' + e.message);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto font-sans text-gray-900">
      <header className="flex justify-between items-center mb-10 border-b pb-4">
        <h1 className="text-4xl font-extrabold tracking-tight">🎼 Composer's Dashboard</h1>
        {user ? (
          <div className="flex items-center space-x-4">
            <span className="font-semibold">Hi, {user.displayName || user.email}</span>
            <button
              onClick={handleSignOut}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded shadow"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <button
            onClick={handleSignIn}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
          >
            Sign In with Google
          </button>
        )}
      </header>

      {user && !editingCueId && (
        <section className="mb-12 bg-gray-100 p-6 rounded-lg shadow">
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
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-4 mt-4">
            <label className="flex-1 flex flex-col">
              Audio File
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setAudioFile(e.target.files[0])}
                className="mt-1"
              />
            </label>
            <label className="flex-1 flex flex-col">
              Sheet Music PDF
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setPdfFile(e.target.files[0])}
                className="mt-1"
              />
            </label>
          </div>
          <button
            onClick={handleAddCue}
            className="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded"
          >
            Add Cue
          </button>
        </section>
      )}

      {editingCueId && (
        <section className="mb-12 bg-yellow-50 p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Edit Cue</h2>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <input
              type="text"
              placeholder="Cue Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex-1 border rounded p-2"
            />
            <select
              value={editPlay}
              onChange={(e) => setEditPlay(e.target.value)}
              className="border p-2 rounded"
            >
              <option value="Julius Caesar">Julius Caesar</option>
              <option value="Antony and Cleopatra">Antony and Cleopatra</option>
              <option value="Both">Both</option>
            </select>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-4 mt-4">
            <label className="flex-1 flex flex-col">
              Replace Audio File (optional)
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setEditAudioFile(e.target
                                onChange={(e) => setEditAudioFile(e.target.files[0])}
                className="mt-1"
              />
            </label>
            <label className="flex-1 flex flex-col">
              Replace Sheet Music PDF (optional)
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setEditPdfFile(e.target.files[0])}
                className="mt-1"
              />
            </label>
          </div>
          <div className="mt-4 space-x-4">
            <button
              onClick={handleEditCue}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
            >
              Save Changes
            </button>
            <button
              onClick={() => setEditingCueId(null)}
              className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-3xl font-bold mb-6">Cues</h2>
        {cues.length === 0 && <p>No cues yet.</p>}
        {cues.map((cue) => (
          <div key={cue.id} className="border p-4 rounded-lg mb-6 bg-white shadow">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-semibold">{cue.title}</h3>
              {user && (
                <div className="space-x-2">
                  <button
                    onClick={() => startEditingCue(cue)}
                    className="bg-yellow-400 hover:bg-yellow-500 text-black px-3 py-1 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(cue.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
            <p className="italic mb-3">Play: <strong>{cue.play}</strong></p>

            {(cue.play === 'Julius Caesar' || cue.play === 'Both') && (
              <>
                <h4 className="font-semibold">Julius Caesar Audio</h4>
                <AudioPlayer src={cue.audioURL} cueId={cue.id + '-jc'} />
                <a
                  href={cue.pdfURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline block mb-4"
                >
                  View Sheet Music PDF
                </a>
              </>
            )}

            {(cue.play === 'Antony and Cleopatra' || cue.play === 'Both') && cue.play === 'Both' && (
              <>
                <h4 className="font-semibold">Antony and Cleopatra Audio</h4>
                <AudioPlayer src={cue.audioURL} cueId={cue.id + '-ac'} />
                <a
                  href={cue.pdfURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline block"
                >
                  View Sheet Music PDF
                </a>
              </>
            )}

            {/* Comments Section */}
            <div className="mt-6">
              <h4 className="font-semibold mb-2">Comments</h4>
              {cue.comments && cue.comments.length > 0 ? (
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {cue.comments.map((comment) => (
                    <li
                      key={comment.id}
                      className="border rounded p-2 bg-gray-50 flex justify-between items-start"
                    >
                      <div>
                        <p className="font-semibold">{comment.username}</p>
                        <p>{comment.text}</p>
                      </div>
                      {user && (user.displayName === comment.username || user.email === comment.username) && (
                        <button
                          onClick={async () => {
                            if (!window.confirm('Delete this comment?')) return;
                            const cueRef = doc(db, 'cues', cue.id);
                            await updateDoc(cueRef, {
                              comments: cue.comments.filter((c) => c.id !== comment.id)
                            });
                          }}
                          className="text-red-600 hover:text-red-800 font-bold ml-4"
                          title="Delete Comment"
                        >
                          &times;
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="italic text-gray-500">No comments yet.</p>
              )}

              {/* Add Comment */}
              {user && commentingCueId === cue.id && (
                <div className="mt-2 flex space-x-2">
                  <input
                    type="text"
                    placeholder="Write a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-1 border rounded px-3 py-2"
                  />
                  <button
                    onClick={() => handleAddComment(cue.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                  >
                    Post
                  </button>
                  <button
                    onClick={() => {
                      setCommentText('');
                      setCommentingCueId(null);
                    }}
                    className="bg-gray-300 hover:bg-gray-400 px-3 py-2 rounded"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {user && commentingCueId !== cue.id && (
                <button
                  onClick={() => setCommentingCueId(cue.id)}
                  className="mt-2 text-blue-600 hover:underline"
                >
                  Add Comment
                </button>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
