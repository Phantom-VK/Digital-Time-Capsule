import { useState, useEffect } from 'react';
import { 
  Container, 
  TextField, 
  Button, 
  Card, 
  Typography, 
  Box,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  Snackbar
} from '@mui/material';
import axios from 'axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const CountdownTimer = ({ unlockDate }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const diff = new Date(unlockDate) - now;
      
      if (diff <= 0) {
        setTimeLeft('Unlocked!');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      setTimeLeft(`${days}d ${hours}h remaining`);
    }, 1000 * 60); // Update every minute instead of every second

    return () => clearInterval(timer);
  }, [unlockDate]);

  return <Typography variant="body2" color="text.secondary">{timeLeft}</Typography>;
};

export default function Dashboard() {
  const [capsules, setCapsules] = useState([]);
  const [content, setContent] = useState('');
  const [unlockDate, setUnlockDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const fetchCapsules = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:5000/api/capsules', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCapsules(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch capsules');
      } finally {
        setLoading(false);
      }
    };
    fetchCapsules();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content || !unlockDate) {
      setError('Please fill all fields');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/api/capsules', 
        { content, unlockDate }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Capsule created successfully!');
      setContent('');
      setUnlockDate('');
      // Refresh capsules list
      const res = await axios.get('http://localhost:5000/api/capsules', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCapsules(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create capsule');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAlert = () => {
    setError(null);
    setSuccess(null);
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
        Your Time Capsules
      </Typography>

      {/* Notification Alerts */}
      <Snackbar open={!!error} autoHideDuration={6000} onClose={handleCloseAlert}>
        <Alert severity="error" onClose={handleCloseAlert}>
          {error}
        </Alert>
      </Snackbar>
      <Snackbar open={!!success} autoHideDuration={6000} onClose={handleCloseAlert}>
        <Alert severity="success" onClose={handleCloseAlert}>
          {success}
        </Alert>
      </Snackbar>

      {/* Create Capsule Form */}
      <Card sx={{ p: 3, mb: 4 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Your Message"
            variant="outlined"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            type="datetime-local"
            label="Unlock Date & Time"
            InputLabelProps={{ shrink: true }}
            value={unlockDate}
            onChange={(e) => setUnlockDate(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Button 
            type="submit" 
            variant="contained" 
            size="large"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Capsule'}
          </Button>
        </Box>
      </Card>

      {/* Capsules List */}
      {loading && capsules.length === 0 ? (
        <Typography>Loading your capsules...</Typography>
      ) : (
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Your Saved Capsules ({capsules.length})
          </Typography>
          {capsules.length === 0 ? (
            <Typography variant="body1" color="text.secondary">
              You don't have any capsules yet. Create one above!
            </Typography>
          ) : (
            <List>
              {capsules.map((capsule) => (
                <Box key={capsule._id}>
                  <ListItem alignItems="flex-start">
                    <ListItemText
                      primary={capsule.content}
                      secondary={
                        <>
                          <CountdownTimer unlockDate={capsule.unlockDate} />
                          <Typography variant="caption" display="block">
                            Created: {dayjs(capsule.createdAt).format('MMM D, YYYY')}
                          </Typography>
                          {capsule.unlocked && (
                            <Typography variant="caption" color="success.main">
                              🔓 Unlocked
                            </Typography>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                  <Divider component="li" />
                </Box>
              ))}
            </List>
          )}
        </Card>
      )}
    </Container>
  );
}