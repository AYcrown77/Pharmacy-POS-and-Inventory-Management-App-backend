import pkg from 'cloudinary';
const { v2: cloudinary } = pkg;
import multer from 'multer';
import fs from 'fs';
import path from 'path';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer for memory storage
const uploadManager = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
        // Check for authorization
        if (!req.get('Authorization')) {
            return cb(new Error('No authorization header'));
        }

        // Validate file types
        const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        const allowedDocTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ];

        if (allowedImageTypes.includes(file.mimetype) || allowedDocTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Add error handling middleware
const handleUploadErrors = (err: any, req: any, res: any, next: any) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            result: {
                success: false,
                message: `Upload error: ${err.message}`,
                statusCode: 400
            }
        });
    }
    if (err) {
        return res.status(400).json({
            result: {
                success: false,
                message: err.message,
                statusCode: 400
            }
        });
    }
    next();
};

const uploadToCloudinary = async (file: Express.Multer.File, folder: string) => {
    try {
        const resourceType = file.mimetype.startsWith('image/') ? 'image' : 'raw';
        const timestamp = Date.now();
        const uniqueId = Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        const fieldname = path.basename(file.fieldname, extension);

        const base64Data = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

        const result = await cloudinary.uploader.upload(base64Data, {
            folder: folder || 'Vyntra',
            resource_type: resourceType,
            access_mode: 'public',
            public_id: file.mimetype.startsWith('image/') 
                ? `${fieldname}-${timestamp}-${uniqueId}`
                : `${fieldname}-${timestamp}-${uniqueId}${extension}`,
            transformation: file.mimetype.startsWith('image/') ? [
                { quality: 'auto:best' },
                { fetch_format: 'auto' }
            ] : []
        });


        return result.secure_url;
    } catch (error: any) {
        throw new Error(`Failed to upload to Cloudinary: ${error.message}`);
    }
};

export { uploadManager, handleUploadErrors, uploadToCloudinary };