const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Repository = sequelize.define('repository', {
  repo_name: {
    type: DataTypes.STRING(100),
    primaryKey: true,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_by_username: {
    type: DataTypes.STRING(50),
    allowNull: true,
    references: {
      model: 'user',
      key: 'username'
    }
  },
  hasAccess: {
    type: DataTypes.STRING(255),
    allowNull: false,
    get() {
      const rawValue = this.getDataValue('hasAccess');
      return rawValue ? rawValue.split(',') : [];
    },
    set(value) {
      if (Array.isArray(value)) {
        this.setDataValue('hasAccess', value.join(','));
      } else {
        this.setDataValue('hasAccess', value);
      }
    }
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'repository',
  timestamps: false
});

module.exports = Repository;
