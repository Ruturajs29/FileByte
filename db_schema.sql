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
