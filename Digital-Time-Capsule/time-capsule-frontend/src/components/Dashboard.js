import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Dashboard() {
  const [capsules, setCapsules] = useState([]);
  const [content, setContent] = useState('');
  const [unlockDate, setUnlockDate] = useState('');

  useEffect(() => {
    const fetchCapsules = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:5000/api/capsules', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCapsules(res.data);
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to fetch capsules');
      }
    };
    fetchCapsules();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/api/capsules', { content, unlockDate }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Capsule created!');
      setContent('');
      setUnlockDate('');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create capsule');
    }
  };

  return (
    <div>
      <h1>Your Time Capsules</h1>
      <form onSubmit={handleSubmit}>
        <textarea placeholder="Write your message..." value={content} onChange={(e) => setContent(e.target.value)} required />
        <input type="date" value={unlockDate} onChange={(e) => setUnlockDate(e.target.value)} required />
        <button type="submit">Create Capsule</button>
      </form>
      <div>
        {capsules.map((capsule) => (
          <div key={capsule._id}>
            <p>{capsule.content}</p>
            <p>Unlocks on: {new Date(capsule.unlockDate).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}