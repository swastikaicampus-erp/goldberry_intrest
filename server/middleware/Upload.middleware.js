const multer = require("multer");
const path = require("path");
const fs = require("fs");

// =========================
// Upload Folder Create
// =========================
const uploadDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// =========================
// Storage Config
// =========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);

    const uniqueName = `${file.fieldname}-${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${ext}`;

    cb(null, uniqueName);
  },
});

// =========================
// File Filter
// =========================
const fileFilter = (req, file, cb) => {
  console.log("================================");
  console.log("Uploading File:", file.originalname);
  console.log("Mime Type:", file.mimetype);
  console.log("Field Name:", file.fieldname);
  console.log("================================");

  // Allowed Extensions
  const allowedExt = /jpeg|jpg|png|webp|heic/;

  // Check Extension
  const extname = allowedExt.test(
    path.extname(file.originalname).toLowerCase()
  );

  // Check Mime Type
  const mimetype =
    /image\/jpeg|image\/jpg|image\/png|image\/webp|image\/heic/.test(
      file.mimetype
    );

  if (extname && mimetype) {
    return cb(null, true);
  }

  cb(
    new Error(
      `Only image files are allowed! Received: ${file.mimetype}`
    ),
    false
  );
};

// =========================
// Multer Upload Instance
// =========================
const upload = multer({
  storage,

  fileFilter,

  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// =========================
// Customer Upload Fields
// =========================
const customerUpload = upload.fields([
  { name: "photo", maxCount: 1 },
  { name: "signature", maxCount: 1 },
  { name: "aadharFront", maxCount: 1 },
  { name: "aadharBack", maxCount: 1 },
  { name: "panFront", maxCount: 1 },
  { name: "panBack", maxCount: 1 },
]);

// =========================
// Girvi Upload Fields
// photos_0 to photos_9
// =========================
const girviFields = Array.from({ length: 10 }, (_, i) => ({
  name: `photos_${i}`,
  maxCount: 4,
}));

const girviUpload = upload.fields(girviFields);

// =========================
// Export
// =========================
module.exports = {
  customerUpload,
  girviUpload,
};