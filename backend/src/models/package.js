const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Package = sequelize.define('package', {
  pkg_name: {
    type: DataTypes.STRING(100),
    primaryKey: true,
    allowNull: false
  },
  repo_for_pkg: {
    type: DataTypes.STRING(100),
    allowNull: true,
    references: {
      model: 'repository',
      key: 'repo_name'
    }
  },
  created_by_username: {
    type: DataTypes.STRING(50),
    allowNull: true,
    references: {
      model: 'user',
      key: 'username'
    }
  },
  version: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('accepted', 'rejected', 'pending'),
    defaultValue: 'pending'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'package',
  timestamps: false
});

module.exports = Package;
