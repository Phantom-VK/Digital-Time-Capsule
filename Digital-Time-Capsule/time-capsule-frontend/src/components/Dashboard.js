import { useState, useEffect } from 'react';
import { 
  Container, 
  TextField, 
  Button, 
  Card, 
  Typography, 
  Box,
  IconButton,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  CardMedia,
  CardContent,
  CardActions,
  Paper,
  InputLabel,
  MenuItem,
  FormControl,
  Select,
  CircularProgress
} from '@mui/material';
import { 
  LockClock as LockClockIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CloudUpload as CloudUploadIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import axios from 'axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// API URL configuration
const API_URL = 'http://localhost:5000/api';

// Component to show countdown to unlock date
const CountdownTimer = ({ unlockDate }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    // Initial calculation
    calculateTimeLeft();
    
    const timer = setInterval(calculateTimeLeft, 60000); // Update every minute
    
    function calculateTimeLeft() {
      const now = new Date();
      const unlockTime = new Date(unlockDate);
      const diff = unlockTime - now;
      
      if (diff <= 0) {
        setTimeLeft('Unlocked!');
        clearInterval(timer);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      setTimeLeft(`${days}d ${hours}h ${minutes}m remaining`);
    }

    return () => clearInterval(timer);
  }, [unlockDate]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <LockClockIcon fontSize="small" color="action" />
      <Typography variant="body2" color="text.secondary">{timeLeft}</Typography>
    </Box>
  );
};

export default function Dashboard() {
  // State for capsules list and filtering
  const [capsules, setCapsules] = useState([]);
  const [filteredCapsules, setFilteredCapsules] = useState([]);
  const [filterType, setFilterType] = useState('all');
  
  // State for text capsule creation
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [unlockDate, setUnlockDate] = useState('');
  
  // State for media capsule creation
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaMessage, setMediaMessage] = useState('');
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaUnlockDate, setMediaUnlockDate] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // UI state
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Dialog state
  const [selectedCapsule, setSelectedCapsule] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  // Token state
  const [token, setToken] = useState('');

  // Get authorization token from local storage
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
    } else {
      setError('You are not logged in. Please log in to view your capsules.');
    }
  }, []);

  // Fetch capsules from API
  useEffect(() => {
    if (!token) return;
    
    const fetchCapsules = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/capsules`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCapsules(res.data);
        setFilteredCapsules(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch capsules');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCapsules();
  }, [token]);

  // Filter capsules
  useEffect(() => {
    if (filterType === 'all') {
      setFilteredCapsules(capsules);
    } else if (filterType === 'locked') {
      setFilteredCapsules(capsules.filter(capsule => !capsule.unlocked));
    } else if (filterType === 'unlocked') {
      setFilteredCapsules(capsules.filter(capsule => capsule.unlocked));
    } else if (filterType === 'media') {
      setFilteredCapsules(capsules.filter(capsule => capsule.mediaUrl));
    } else if (filterType === 'text') {
      setFilteredCapsules(capsules.filter(capsule => !capsule.mediaUrl));
    }
  }, [filterType, capsules]);

  // Create text capsule
  const handleCreateTextCapsule = async (e) => {
    e.preventDefault();
    if (!content || !unlockDate) {
      setError('Please fill all required fields');
      return;
    }

    try {
      setLoading(true);
      await axios.post(
        `${API_URL}/capsules`, 
        { content, unlockDate, title }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Capsule created successfully!');
      setContent('');
      setTitle('');
      setUnlockDate('');
      
      // Refresh capsules list
      const res = await axios.get(`${API_URL}/capsules`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCapsules(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create capsule');
    } finally {
      setLoading(false);
    }
  };

  // Upload media capsule
  const handleUploadMediaCapsule = async (e) => {
    e.preventDefault();
    if (!mediaFile || !mediaUnlockDate) {
      setError('Please select a file and set an unlock date');
      return;
    }

    const formData = new FormData();
    formData.append('media', mediaFile);
    formData.append('unlockDate', mediaUnlockDate);
    formData.append('title', mediaTitle);
    formData.append('message', mediaMessage);

    try {
      setLoading(true);
      await axios.post(
        `${API_URL}/capsules/upload`, 
        formData, 
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        }
      );
      setSuccess('Media capsule uploaded successfully!');
      setMediaFile(null);
      setMediaMessage('');
      setMediaTitle('');
      setMediaUnlockDate('');
      setUploadProgress(0);
      
      // Refresh capsules list
      const res = await axios.get(`${API_URL}/capsules`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCapsules(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload media capsule');
    } finally {
      setLoading(false);
    }
  };

  // Delete capsule
  const handleDeleteCapsule = async () => {
    if (!selectedCapsule) return;
    
    try {
      setLoading(true);
      await axios.delete(
        `${API_URL}/capsules/${selectedCapsule.id}`, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Capsule deleted successfully!');
      
      // Refresh capsules list
      const res = await axios.get(`${API_URL}/capsules`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCapsules(res.data);
      
      // Close dialog
      setConfirmDeleteOpen(false);
      setSelectedCapsule(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete capsule');
    } finally {
      setLoading(false);
    }
  };

  // Force unlock capsule
  const handleForceUnlock = async (capsuleId) => {
    try {
      setLoading(true);
      await axios.patch(
        `${API_URL}/capsules/${capsuleId}/unlock`, 
        {}, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Capsule unlocked successfully!');
      
      // Refresh capsules list
      const res = await axios.get(`${API_URL}/capsules`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCapsules(res.data);
      
      // If viewing this capsule, update it
      if (selectedCapsule && selectedCapsule.id === capsuleId) {
        const updatedCapsule = res.data.find(c => c.id === capsuleId);
        setSelectedCapsule(updatedCapsule);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to unlock capsule');
    } finally {
      setLoading(false);
    }
  };

  // Update capsule
  const handleUpdateCapsule = async (e) => {
    e.preventDefault();
    if (!selectedCapsule) return;
    
    const updatedData = {
      title: selectedCapsule.title,
      unlockDate: selectedCapsule.unlockDate,
      content: selectedCapsule.content
    };
    
    try {
      setLoading(true);
      await axios.patch(
        `${API_URL}/capsules/${selectedCapsule.id}`, 
        updatedData, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Capsule updated successfully!');
      
      // Refresh capsules list
      const res = await axios.get(`${API_URL}/capsules`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCapsules(res.data);
      
      // Close dialog
      setEditDialogOpen(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update capsule');
    } finally {
      setLoading(false);
    }
  };

  // View capsule details
  const handleViewCapsule = async (capsuleId) => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_URL}/capsules/${capsuleId}`, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedCapsule(res.data);
      setViewDialogOpen(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to retrieve capsule details');
    } finally {
      setLoading(false);
    }
  };

  // Handle dialog close
  const handleCloseDialog = () => {
    setViewDialogOpen(false);
    setConfirmDeleteOpen(false);
    setEditDialogOpen(false);
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Handle alert close
  const handleCloseAlert = () => {
    setError(null);
    setSuccess(null);
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
        Your Time Capsules
      </Typography>

      {/* Notifications */}
      <Snackbar open={!!error} autoHideDuration={6000} onClose={handleCloseAlert}>
        <Alert severity="error" onClose={handleCloseAlert} sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
      <Snackbar open={!!success} autoHideDuration={6000} onClose={handleCloseAlert}>
        <Alert severity="success" onClose={handleCloseAlert} sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>

      {/* Create Capsule Tabs */}
      <Card sx={{ mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="capsule creation tabs">
            <Tab label="Text Capsule" />
            <Tab label="Media Capsule" />
          </Tabs>
        </Box>
        
        {/* Text Capsule Form */}
        <Box hidden={activeTab !== 0} sx={{ p: 3 }}>
          <Box component="form" onSubmit={handleCreateTextCapsule}>
            <TextField
              fullWidth
              label="Title (Optional)"
              variant="outlined"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Your Message"
              variant="outlined"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              sx={{ mb: 2 }}
              required
            />
            <TextField
              fullWidth
              type="datetime-local"
              label="Unlock Date & Time"
              InputLabelProps={{ shrink: true }}
              value={unlockDate}
              onChange={(e) => setUnlockDate(e.target.value)}
              sx={{ mb: 2 }}
              required
            />
            <Button 
              type="submit" 
              variant="contained" 
              size="large"
              disabled={loading}
              startIcon={<LockIcon />}
            >
              {loading ? 'Creating...' : 'Create Time Capsule'}
            </Button>
          </Box>
        </Box>
        
        {/* Media Capsule Form */}
        <Box hidden={activeTab !== 1} sx={{ p: 3 }}>
          <Box component="form" onSubmit={handleUploadMediaCapsule}>
            <TextField
              fullWidth
              label="Title (Optional)"
              variant="outlined"
              value={mediaTitle}
              onChange={(e) => setMediaTitle(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Box sx={{ mb: 2 }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUploadIcon />}
                sx={{ mb: 1 }}
              >
                Select File
                <input
                  type="file"
                  hidden
                  onChange={(e) => setMediaFile(e.target.files[0])}
                />
              </Button>
              <Typography variant="body2" color="text.secondary">
                {mediaFile ? `Selected: ${mediaFile.name}` : 'No file selected'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Supported formats: Images, Videos, Audio, PDF, and Documents (max 10MB)
              </Typography>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Message (Optional)"
              variant="outlined"
              value={mediaMessage}
              onChange={(e) => setMediaMessage(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              type="datetime-local"
              label="Unlock Date & Time"
              InputLabelProps={{ shrink: true }}
              value={mediaUnlockDate}
              onChange={(e) => setMediaUnlockDate(e.target.value)}
              sx={{ mb: 2 }}
              required
            />
            {uploadProgress > 0 && uploadProgress < 100 && (
              <Box sx={{ mb: 2, width: '100%' }}>
                <CircularProgress 
                  variant="determinate" 
                  value={uploadProgress} 
                  size={24} 
                  sx={{ mr: 1 }} 
                />
                <Typography variant="body2" color="text.secondary" display="inline">
                  Uploading: {uploadProgress}%
                </Typography>
              </Box>
            )}
            <Button 
              type="submit" 
              variant="contained" 
              size="large"
              disabled={loading || !mediaFile}
              startIcon={<CloudUploadIcon />}
            >
              {loading ? 'Uploading...' : 'Upload Media Capsule'}
            </Button>
          </Box>
        </Box>
      </Card>

      {/* Capsules List */}
      <Card sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
          <Typography variant="h6">
            Your Saved Capsules ({capsules.length})
          </Typography>
          
          <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Filter</InputLabel>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              label="Filter"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="locked">Locked</MenuItem>
              <MenuItem value="unlocked">Unlocked</MenuItem>
              <MenuItem value="media">Media</MenuItem>
              <MenuItem value="text">Text Only</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {loading && capsules.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : filteredCapsules.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {capsules.length === 0 
                ? "You don't have any capsules yet. Create one above!" 
                : "No capsules match your filter criteria."}
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {filteredCapsules.map((capsule) => (
              <Grid item xs={12} sm={6} md={4} key={capsule.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {capsule.mediaUrl && capsule.mediaType === 'image' && capsule.unlocked && (
                    <CardMedia
                      component="img"
                      height="140"
                      image={capsule.mediaUrl}
                      alt={capsule.title || "Media capsule"}
                    />
                  )}
                  {capsule.mediaUrl && !capsule.unlocked && (
                    <Box 
                      sx={{ 
                        height: 140, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        bgcolor: 'grey.200' 
                      }}
                    >
                      <LockIcon sx={{ fontSize: 40, color: 'grey.500' }} />
                    </Box>
                  )}
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" gutterBottom noWrap>
                      {capsule.title || 'Time Capsule'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {capsule.unlocked ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <LockOpenIcon fontSize="small" color="success" />
                          <span>Unlocked</span>
                        </Box>
                      ) : (
                        <CountdownTimer unlockDate={capsule.unlockDate} />
                      )}
                    </Typography>
                    <Typography variant="body2" 
                      sx={{ 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {capsule.unlocked 
                        ? (capsule.content || 'Media capsule')
                        : '🔒 Content locked until ' + new Date(capsule.unlockDate).toLocaleDateString()
                      }
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button 
                      size="small" 
                      startIcon={<VisibilityIcon />}
                      onClick={() => handleViewCapsule(capsule.id)}
                    >
                      View
                    </Button>
                    {!capsule.unlocked && (
                      <Button 
                        size="small" 
                        color="primary"
                        startIcon={<LockOpenIcon />}
                        onClick={() => handleForceUnlock(capsule.id)}
                      >
                        Unlock
                      </Button>
                    )}
                    <IconButton 
                      size="small" 
                      color="error"
                      onClick={() => {
                        setSelectedCapsule(capsule);
                        setConfirmDeleteOpen(true);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Card>

      {/* View Capsule Dialog */}
      <Dialog 
        open={viewDialogOpen} 
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="sm"
      >
        {selectedCapsule && (
          <>
            <DialogTitle>
              {selectedCapsule.title || 'Time Capsule'}
            </DialogTitle>
            <DialogContent dividers>
              {selectedCapsule.mediaUrl && selectedCapsule.unlocked && (
                <Box sx={{ mb: 2, textAlign: 'center' }}>
                  {selectedCapsule.mediaType === 'image' ? (
                    <img 
                      src={selectedCapsule.mediaUrl} 
                      alt="Capsule media" 
                      style={{ maxWidth: '100%', maxHeight: '300px' }} 
                    />
                  ) : selectedCapsule.mediaType === 'video' ? (
                    <video 
                      controls 
                      src={selectedCapsule.mediaUrl} 
                      style={{ maxWidth: '100%', maxHeight: '300px' }} 
                    />
                  ) : selectedCapsule.mediaType === 'audio' ? (
                    <audio controls src={selectedCapsule.mediaUrl} style={{ width: '100%' }} />
                  ) : (
                    <Button 
                      variant="contained" 
                      href={selectedCapsule.mediaUrl} 
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download File
                    </Button>
                  )}
                </Box>
              )}
              <Typography variant="body1" paragraph>
                {selectedCapsule.unlocked 
                  ? selectedCapsule.content 
                  : '🔒 This content is locked until ' + new Date(selectedCapsule.unlockDate).toLocaleDateString()
                }
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" display="block" color="text.secondary">
                  Created: {dayjs(selectedCapsule.createdAt).format('MMMM D, YYYY [at] h:mm A')}
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary">
                  Unlock date: {dayjs(selectedCapsule.unlockDate).format('MMMM D, YYYY [at] h:mm A')}
                </Typography>
                {selectedCapsule.unlocked && (
                  <Typography variant="caption" display="block" color="success.main">
                    🔓 This capsule has been unlocked
                  </Typography>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              {!selectedCapsule.unlocked && (
                <Button 
                  onClick={() => handleForceUnlock(selectedCapsule.id)}
                  startIcon={<LockOpenIcon />}
                >
                  Unlock Now
                </Button>
              )}
              {!selectedCapsule.unlocked && (
                <Button 
                  onClick={() => {
                    setViewDialogOpen(false);
                    setEditDialogOpen(true);
                  }}
                  startIcon={<EditIcon />}
                >
                  Edit
                </Button>
              )}
              <Button 
                onClick={() => {
                  setViewDialogOpen(false);
                  setConfirmDeleteOpen(true);
                }}
                color="error"
                startIcon={<DeleteIcon />}
              >
                Delete
              </Button>
              <Button onClick={handleCloseDialog} autoFocus>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Edit Capsule Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="sm"
      >
        {selectedCapsule && (
          <>
            <DialogTitle>Edit Capsule</DialogTitle>
            <DialogContent dividers>
              <Box component="form" onSubmit={handleUpdateCapsule} sx={{ mt: 1 }}>
                <TextField
                  fullWidth
                  label="Title"
                  variant="outlined"
                  value={selectedCapsule.title || ''}
                  onChange={(e) => setSelectedCapsule({...selectedCapsule, title: e.target.value})}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Content"
                  variant="outlined"
                  value={selectedCapsule.content || ''}
                  onChange={(e) => setSelectedCapsule({...selectedCapsule, content: e.target.value})}
                  sx={{ mb: 2 }}
                  disabled={selectedCapsule.unlocked}
                />
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="Unlock Date & Time"
                  InputLabelProps={{ shrink: true }}
                  value={dayjs(selectedCapsule.unlockDate).format('YYYY-MM-DDTHH:mm')}
                  onChange={(e) => setSelectedCapsule({...selectedCapsule, unlockDate: e.target.value})}
                  sx={{ mb: 2 }}
                  disabled={selectedCapsule.unlocked}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>Cancel</Button>
              <Button 
                onClick={handleUpdateCapsule} 
                variant="contained"
                disabled={selectedCapsule.unlocked}
              >
                Save Changes
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={confirmDeleteOpen} onClose={handleCloseDialog}>
        <DialogTitle>Delete Capsule</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this time capsule? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleDeleteCapsule} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}