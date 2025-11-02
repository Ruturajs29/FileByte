import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Chip, Avatar } from '@mui/material';
import { 
  Logout, 
  SpaceDashboard, 
  AccountTree, 
  Widgets,
  CloudQueue,
  PersonOutline
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Accessible color mapping for role chips
  const getRoleColor = (role) => {
    switch (role) {
      case 'Developer':
        return { bg: '#3b82f6', text: '#ffffff' }; // blue
      case 'Tester':
        return { bg: '#059669', text: '#ffffff' }; // green
      case 'HR':
        return { bg: '#dc2626', text: '#ffffff' }; // red
      default:
        return { bg: '#6c757d', text: '#ffffff' };
    }
  };

  return (
    <AppBar
      position="sticky"
      elevation={3}
      sx={{
        background: 'linear-gradient(90deg, #0f172a 0%, #1e3a8a 100%)',
        color: '#fff',
        boxShadow: '0 2px 12px rgba(2,6,23,0.4)'
      }}
    >
      <Toolbar>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          style={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: '12px' }}
        >
          <CloudQueue
            sx={{
              fontSize: 34,
              bgcolor: 'rgba(255,255,255,0.06)',
              borderRadius: '50%',
              padding: '8px',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.08)'
            }}
          />
          <Typography
            variant="h5"
            component="div"
            sx={{
              fontWeight: 700,
              letterSpacing: '0.5px',
              color: '#ffffff',
              textShadow: '0 1px 0 rgba(0,0,0,0.2)'
            }}
          >
            FileByte
          </Typography>
        </motion.div>

        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              color="inherit"
              startIcon={<SpaceDashboard sx={{ color: location.pathname === '/dashboard' ? '#ffd89b' : '#e6eef8' }} />}
              onClick={() => navigate('/dashboard')}
              sx={{
                fontWeight: location.pathname === '/dashboard' ? '700' : '500',
                borderRadius: '10px',
                px: 2,
                color: '#e6eef8',
                backgroundColor: location.pathname === '/dashboard' ? 'rgba(230,238,248,0.06)' : 'transparent',
                '&:hover': {
                  backgroundColor: 'rgba(230,238,248,0.08)',
                  transform: 'translateY(-2px)',
                  transition: 'all 0.18s ease'
                }
              }}
            >
              Dashboard
            </Button>
            
            <Button
              color="inherit"
              startIcon={<AccountTree sx={{ color: location.pathname.startsWith('/repos') ? '#ffd89b' : '#e6eef8' }} />}
              onClick={() => navigate('/repos')}
              sx={{
                fontWeight: location.pathname.startsWith('/repos') ? '700' : '500',
                borderRadius: '10px',
                px: 2,
                color: '#e6eef8',
                backgroundColor: location.pathname.startsWith('/repos') ? 'rgba(230,238,248,0.06)' : 'transparent',
                '&:hover': {
                  backgroundColor: 'rgba(230,238,248,0.08)',
                  transform: 'translateY(-2px)',
                  transition: 'all 0.18s ease'
                }
              }}
            >
              Repositories
            </Button>

            <Button
              color="inherit"
              startIcon={<Widgets sx={{ color: location.pathname.startsWith('/packages') ? '#ffd89b' : '#e6eef8' }} />}
              onClick={() => navigate('/packages')}
              sx={{
                fontWeight: location.pathname.startsWith('/packages') ? '700' : '500',
                borderRadius: '10px',
                px: 2,
                color: '#e6eef8',
                backgroundColor: location.pathname.startsWith('/packages') ? 'rgba(230,238,248,0.06)' : 'transparent',
                '&:hover': {
                  backgroundColor: 'rgba(230,238,248,0.08)',
                  transform: 'translateY(-2px)',
                  transition: 'all 0.18s ease'
                }
              }}
            >
              Packages
            </Button>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                ml: 3,
                px: 1.5,
                py: 0.5,
                borderRadius: '10px'
              }}
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: '#0ea5a4',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '14px',
                  border: '1px solid rgba(255,255,255,0.12)'
                }}
              >
                {user.username.charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ color: '#e6eef8' }}>
                <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                  {user.username}
                </Typography>
                <Chip
                  label={user.role}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    fontSize: '11px',
                    height: '22px',
                    mt: 0.5,
                    backgroundColor: getRoleColor(user.role).bg,
                    color: getRoleColor(user.role).text,
                    borderRadius: '6px'
                  }}
                />
              </Box>
            </Box>

            <Button
              color="inherit"
              startIcon={<Logout sx={{ color: '#ff6b6b' }} />}
              onClick={handleLogout}
              sx={{ 
                ml: 2,
                borderRadius: '12px',
                px: 2,
                background: 'rgba(255, 107, 107, 0.1)',
                border: '1px solid rgba(255, 107, 107, 0.3)',
                '&:hover': { 
                  background: 'rgba(255, 107, 107, 0.2)',
                  transform: 'translateY(-2px)',
                  transition: 'all 0.3s ease'
                }
              }}
            >
              Logout
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
