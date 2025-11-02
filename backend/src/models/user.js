const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const User = sequelize.define('user', {
  username: {
    type: DataTypes.STRING(50),
    primaryKey: true,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  pass: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('Developer', 'Tester', 'HR'),
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'user',
  timestamps: false
});

module.exports = User;
