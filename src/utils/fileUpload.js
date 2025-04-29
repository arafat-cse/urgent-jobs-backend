const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { ApiError } = require('../middlewares/errorHandler');

// Create upload directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Create subdirectories if they don't exist
const profilesDir = path.join(uploadDir, 'profiles');
const jobsDir = path.join(uploadDir, 'jobs');

if (!fs.existsSync(profilesDir)) {
  fs.mkdirSync(profilesDir);
}

if (!fs.existsSync(jobsDir)) {
  fs.mkdirSync(jobsDir);
}

// Configure storage for different types of uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = uploadDir;
    
    // Determine upload directory based on file type
    if (req.uploadType === 'profile') {
      uploadPath = profilesDir;
    } else if (req.uploadType === 'job') {
      uploadPath = jobsDir;
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const fileExt = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExt}`;
    cb(null, fileName);
  }
});

// Configure file filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = {
    'image/jpeg': true,
    'image/png': true,
    'image/jpg': true,
    'application/pdf': true
  };
  
  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Invalid file type. Only JPEG, PNG, and PDF are allowed'), false);
  }
};

// Create multer upload instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 // 5MB default
  },
  fileFilter: fileFilter
});

/**
 * Set upload type middleware
 * @param {String} type - Upload type (profile, job, etc.)
 */
const setUploadType = (type) => {
  return (req, res, next) => {
    req.uploadType = type;
    next();
  };
};

/**
 * Remove file from server
 * @param {String} filePath - Path to file
 */
const removeFile = (filePath) => {
  if (filePath && fs.existsSync(path.join(__dirname, '../../', filePath))) {
    fs.unlinkSync(path.join(__dirname, '../../', filePath));
  }
};

module.exports = {
  upload,
  setUploadType,
  removeFile
};