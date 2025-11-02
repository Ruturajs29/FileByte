import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  MenuItem,
  Divider
} from '@mui/material';
import { Login as LoginIcon, PersonAdd, CloudQueue } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSnackbar } from 'notistack';
import { authService } from '../services/auth';

const Login = () => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Developer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegisterMode) {
        // Register new user
        await authService.register({ username, email, password, role });
        enqueueSnackbar('Account created successfully! Please login.', { variant: 'success' });
        // Switch to login mode and clear fields
        setIsRegisterMode(false);
        setEmail('');
        setRole('Developer');
      } else {
        // Login existing user
        await login(username, password);
        enqueueSnackbar('Login successful!', { variant: 'success' });
        navigate('/dashboard');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 
        (isRegisterMode ? 'Registration failed. Please try again.' : 'Login failed. Please try again.');
      setError(errorMessage);
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setError('');
    setUsername('');
    setPassword('');
    setEmail('');
    setRole('Developer');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 4
      }}
    >
      <Container maxWidth="sm">
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Paper elevation={10} sx={{ p: 4, borderRadius: 3 }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, type: 'spring' }}
              >
                <CloudQueue 
                  sx={{ 
                    fontSize: 64,
                    background: 'linear-gradient(135deg, #ffd89b 0%, #19547b 100%)',
                    borderRadius: '50%',
                    padding: '16px',
                    color: '#fff',
                    mb: 2
                  }} 
                />
              </motion.div>
              <Typography 
                variant="h4" 
                component="h1" 
                sx={{ 
                  fontWeight: 'bold', 
                  mb: 1,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                FileByte
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Enterprise Software Distribution System
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                label="Username"
                variant="outlined"
                fullWidth
                margin="normal"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />

              {isRegisterMode && (
                <TextField
                  label="Email"
                  type="email"
                  variant="outlined"
                  fullWidth
                  margin="normal"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              )}
              
              <TextField
                label="Password"
                type="password"
                variant="outlined"
                fullWidth
                margin="normal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {isRegisterMode && (
                <TextField
                  label="Role"
                  variant="outlined"
                  fullWidth
                  margin="normal"
                  select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                >
                  <MenuItem value="Developer">Developer</MenuItem>
                  <MenuItem value="Tester">Tester</MenuItem>
                  <MenuItem value="HR">HR</MenuItem>
                </TextField>
              )}

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  startIcon={isRegisterMode ? <PersonAdd /> : <LoginIcon />}
                  disabled={loading}
                  sx={{ mt: 3, py: 1.5 }}
                >
                  {loading 
                    ? (isRegisterMode ? 'Creating Account...' : 'Logging in...') 
                    : (isRegisterMode ? 'Create Account' : 'Login')
                  }
                </Button>
              </motion.div>
            </form>

            <Divider sx={{ my: 3 }}>OR</Divider>

            <Button
              variant="outlined"
              fullWidth
              onClick={toggleMode}
              disabled={loading}
            >
              {isRegisterMode ? 'Already have an account? Login' : "Don't have an account? Create one"}
            </Button>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Role-Based Access Control System
              </Typography>
            </Box>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
};

export default Login;
