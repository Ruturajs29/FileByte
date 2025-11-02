const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Upload = sequelize.define('upload', {
  upload_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  pkg_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    references: {
      model: 'package',
      key: 'pkg_name'
    }
  },
  repo_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    references: {
      model: 'repository',
      key: 'repo_name'
    }
  },
  uploaded_by: {
    type: DataTypes.STRING(50),
    allowNull: true,
    references: {
      model: 'user',
      key: 'username'
    }
  },
  file_path: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  uploaded_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'upload',
  timestamps: false
});

module.exports = Upload;
