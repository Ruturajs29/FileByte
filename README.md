# fileBucket - Enterprise FTP System

A full-stack enterprise-grade software distribution system with role-based access control, featuring a custom Python TCP-based FTP server, Node.js REST API backend, and React web interface.

## 🏗️ Architecture
k
```
┌─────────────┐          ┌────────────────┐          ┌─────────────┐
│   React     │  HTTP    │   Express.js   │   TCP    │   Python    │
│  Frontend   │◄────────►│    Backend     │◄────────►│ FTP Server  │
│  (Port 3000)│  REST    │  (Port 5000)   │  Socket  │ (Port 8888) │
└─────────────┘  API     └────────────────┘          └─────────────┘
                                │
                                ▼
                         ┌─────────────┐
                         │   MySQL     │
                         │  Database   |
                         |  port 3306  |
                         └─────────────┘
```

### Technology Stack

- **Frontend**: React 18 + Material-UI v5 + Framer Motion + Axios
- **Backend**: Node.js + Express.js + Sequelize ORM + JWT
- **FTP Server**: Python 3 + Socket Programming + Multithreading
- **Database**: MySQL 8.0

## 📚 Documentation

**Complete mdBook documentation available at: `docs/`**

View documentation:

```bash
cd docs
mdbook serve --open
# Access at http://localhost:3000
```

Or read: [Documentation README](docs/README.md)

### Documentation Contents:

- ✅ **FTP Server** - Custom Python TCP server (socket programming, multithreading, protocols)
- ✅ **Backend** - Express.js REST API (authentication, ORM, FTP integration)
- ✅ **Frontend** - React SPA (components, state management, routing)
- ✅ **Request Flow** - End-to-end traces (upload, download, authentication)
- ✅ **Appendix** - Setup guides, API reference, troubleshooting

[📖 Read Full Documentation](docs/README.md)

## 📋 Prerequisites

- Node.js (v14 or higher)
- Python 3+
- MySQL Server (v8.0)
- npm

## 🚀 Quick Start

### 1. Database Setup

Run the database schema in MySQL Workbench:

```sql
CREATE DATABASE ftp_manager;
USE ftp_manager;

CREATE TABLE user (
    username VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    pass VARCHAR(255) NOT NULL,
    role ENUM('Developer','Tester','HR') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE repository (
    repo_name VARCHAR(100) PRIMARY KEY,
    description TEXT,
    created_by_username VARCHAR(50),
    hasAccess VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_username) REFERENCES user(username) ON DELETE SET NULL
);

CREATE TABLE package (
    pkg_name VARCHAR(100) PRIMARY KEY,
    repo_for_pkg VARCHAR(100),
    created_by_username VARCHAR(50),
    version VARCHAR(20) NOT NULL,
    description TEXT,
    status ENUM('accepted','rejected','pending') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repo_for_pkg) REFERENCES repository(repo_name) ON DELETE CASCADE,
    FOREIGN KEY (created_by_username) REFERENCES user(username) ON DELETE SET NULL
);

CREATE TABLE upload (
    upload_id INT AUTO_INCREMENT PRIMARY KEY,
    pkg_name VARCHAR(100),
    repo_name VARCHAR(100),
    uploaded_by VARCHAR(50),
    file_path VARCHAR(500),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pkg_name) REFERENCES package(pkg_name) ON DELETE CASCADE,
    FOREIGN KEY (repo_name) REFERENCES repository(repo_name) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES user(username) ON DELETE SET NULL
);

-- Insert sample users
INSERT INTO user (username, email, pass, role) VALUES
('dev1', 'dev1@example.com', 'password123', 'Developer'),
('tester1', 'tester1@example.com', 'password123', 'Tester'),
('hr1', 'hr1@example.com', 'password123', 'HR');
```

### 2. Python TCP Server Setup

Navigate to the FTP_Server directory and start the TCP server:

```powershell
cd "FTP_Server"
python improved_tcp_server.py
```

The TCP server will start on `0.0.0.0:8888` and handle file operations (GET, PUT, DEL).

### 3. Backend Setup

Navigate to the backend directory:

```powershell
cd backend
```

Install dependencies:

```powershell
npm install
```

Configure environment variables in `.env`:

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_NAME=ftp_manager
DB_USER=root
DB_PASSWORD=your_mysql_password

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_EXPIRES_IN=30m

# TCP Server Configuration
TCP_HOST=localhost
TCP_PORT=8888


UPLOAD_DIR=uploads
MAX_FILE_SIZE=104857600
```

Start the backend server:

```powershell
npm start / nodemon npx start
```

The backend will run on `http://localhost:5000`.

### 4. Frontend Setup

Navigate to the frontend directory:

```powershell
cd frontend
```

Install dependencies:

```powershell
npm install
```

Configure environment variables in `.env`:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

Start the React development server:

```powershell
npm start
```

The frontend will run on `http://localhost:3000`.

## 👥 User Roles & Permissions

### Developer

- Create and manage repositories
- Create packages
- Upload files to packages
- Download files
- View all repositories with Developer access

### Tester

- View repositories with Tester access
- Update package status (Accept/Reject/Pending)
- Upload and download files
- Create packages

### HR

- View repositories with HR access
- Upload and download files
- Create packages

## 🔑 Sample Login Credentials

| Username | Password    | Role      |
| -------- | ----------- | --------- |
| dev1     | password123 | Developer |
| tester1  | password123 | Tester    |
| hr1      | password123 | HR        |

## 📡 API Endpoints

### Authentication

- `POST /api/auth/login` - Login user
- `POST /api/auth/register` - Register new user
- `GET /api/auth/me` - Get current user info (protected route)

### Dashboard

- `GET /api/dashboard` - Get dashboard statistics

### Repositories

- `GET /api/repos` - Get all repositories (filtered by role)
- `GET /api/repos/:repo_name` - Get repository details
- `POST /api/repos` - Create new repository
- `PUT /api/repos/:repo_name` - Update repository
- `DELETE /api/repos/:repo_name` - Delete repository

### Packages

- `GET /api/repos/:repo_name/packages` - Get packages by repository
- `GET /api/packages/:pkg_name` - Get package details
- `POST /api/repos/:repo_name/packages` - Create package
- `PATCH /api/packages/:pkg_name/status` - Update package status
- `DELETE /api/packages/:pkg_name` - Delete package

### File Operations

- `POST /api/packages/:pkg_name/upload` - Upload file
- `GET /api/packages/:pkg_name/download/:filename` - Download file
- `DELETE /api/packages/:pkg_name/file/:filename` - Delete file

## 🎨 Frontend Features

- **Material-UI Components**: Modern, responsive UI
- **Framer Motion**: Smooth animations and transitions
- **Role-Based UI**: Conditional rendering based on user role
- **File Upload**: Progress tracking with LinearProgress
- **Notifications**: Notistack for user feedback
- **Dashboard**: Statistics with Recharts pie chart
- **Protected Routes**: JWT-based authentication

## 🔧 TCP Server Commands

The Python TCP server supports:

- `LIST` - List files on server
- `GET <filename>` - Download file
- `PUT <filename>` - Upload file
- `DEL <filename>` - Delete file
- `STAT` - Server statistics
- `QUIT` - Close connection

## 📁 Project Structure

```
FileByte/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js
│   │   │   └── tcpConfig.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── dashboardController.js
│   │   │   ├── packageController.js
│   │   │   └── repoController.js
│   │   ├── middleware/
│   │   │   └── authMiddleware.js
│   │   ├── models/
│   │   │   ├── index.js
│   │   │   ├── package.js
│   │   │   ├── repository.js
│   │   │   ├── upload.js
│   │   │   └── user.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── dashboard.js
│   │   │   ├── package.js
│   │   │   └── repo.js
│   │   ├── services/
│   │   │   └── tcpClient.js
│   │   ├── utils/
│   │   │   └── fileUtils.js
│   │   └── app.js
│   ├── .env
│   └── package.json
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── ConfirmDialog.jsx
│   │   │   ├── FileUploadDialog.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── PackageCard.jsx
│   │   │   └── RepoCard.jsx
│   │   ├── context/
│   │   │   └── AuthContext.js
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── RepoDetail.jsx
│   │   │   └── RepoList.jsx
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── auth.js
│   │   │   └── repo.js
│   │   ├── App.js
│   │   ├── index.css
│   │   └── index.js
│   ├── .env
│   └── package.json
└── FTP_Server/
    ├── improved_tcp_server.py
    └── improved_tcp_client.py
```

## 🔄 Workflow

1. **User Authentication**: Users login via React frontend
2. **JWT Token**: Backend generates JWT token with username and role
3. **Role-Based Access**: Frontend and backend enforce role-based permissions
4. **Repository Management**: Users create/view repositories based on role
5. **Package Management**: Users create packages within repositories
6. **File Operations**:
   - Frontend uploads file to Express backend (multipart/form-data)
   - Backend saves file temporarily
   - Backend connects to Python TCP server using `tcpClient.js`
   - TCP server stores file and confirms
   - Backend logs upload in MySQL database
   - Frontend shows success notification

## 🐛 Troubleshooting

### TCP Server Connection Issues

- Ensure Python TCP server is running on port 8888
- Check firewall settings
- Verify TCP_HOST and TCP_PORT in backend `.env`

### Database Connection Issues

- Verify MySQL server is running
- Check database credentials in backend `.env`
- Ensure database `ftp_manager` exists

### CORS Issues

- Backend is configured with CORS enabled
- Ensure frontend API_URL matches backend address

## 🎯 Key Features

### Multi-Role Access Control

- **Repositories support multiple roles** - Assign Developer, Tester, and HR access simultaneously
- Role-based permissions for create, read, update, delete operations
- Per-repository access configuration

### Session Management

- **JWT authentication** with 30-minute token expiry
- **Inactivity timeout** - Auto-logout after 15 minutes of no activity
- Activity tracking across mousedown, keydown, scroll, touchstart, click events

### File Management

- **Binary file transfers** via custom FTP protocol
- Chunked upload/download (8KB chunks)
- File deletion with FTP server cleanup
- Progress tracking during uploads

### Custom FTP Server

- **Pure Python socket implementation**
- Multithreaded client handling
- File operations: LIST, GET, PUT, DEL, STAT
- Session timeout detection (5-minute idle timeout)
- Comprehensive logging and statistics

### Dashboard Analytics

- Real-time repository count
- Package status breakdown (Accepted/Rejected/Pending)
- Role-based filtering
- Recent package listings

## � Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Authentication**: Secure token-based auth
- **SQL Injection Prevention**: Sequelize parameterized queries
- **Role-Based Access Control**: Middleware enforcement
- **File Upload Limits**: Configurable size restrictions
- **Activity Timeout**: Automatic session termination
- **CORS Protection**: Configured origin restrictions

## 📝 License

This project is for educational purposes as part of Computer Networks course project.

---

**Project Status:** ✅ Complete with full documentation  
**Last Updated:** January 2024  
**Course:** Computer Networks (CN)  
**Semester:** TY Core 1
