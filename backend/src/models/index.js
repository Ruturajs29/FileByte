const { sequelize } = require('../config/db');
const User = require('./user');
const Repository = require('./repository');
const Package = require('./package');
const Upload = require('./upload');

// Define associations
User.hasMany(Repository, { foreignKey: 'created_by_username', as: 'repositories' });
Repository.belongsTo(User, { foreignKey: 'created_by_username', as: 'creator' });

Repository.hasMany(Package, { foreignKey: 'repo_for_pkg', as: 'packages' });
Package.belongsTo(Repository, { foreignKey: 'repo_for_pkg', as: 'repository' });

User.hasMany(Package, { foreignKey: 'created_by_username', as: 'packages' });
Package.belongsTo(User, { foreignKey: 'created_by_username', as: 'creator' });

Package.hasMany(Upload, { foreignKey: 'pkg_name', as: 'uploads' });
Upload.belongsTo(Package, { foreignKey: 'pkg_name', as: 'package' });

Repository.hasMany(Upload, { foreignKey: 'repo_name', as: 'uploads' });
Upload.belongsTo(Repository, { foreignKey: 'repo_name', as: 'repository' });

User.hasMany(Upload, { foreignKey: 'uploaded_by', as: 'uploads' });
Upload.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });

module.exports = {
  sequelize,
  User,
  Repository,
  Package,
  Upload
};
