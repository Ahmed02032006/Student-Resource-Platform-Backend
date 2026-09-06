import { v2 as cloudinary } from 'cloudinary';
import Resource from '../Models/resourceModel.js';
import { logActivity } from '../Middleware/activityLogger.js';

/**
 * Ensure Cloudinary is configured dynamically with process.env variables.
 */
const configureCloudinary = () => {
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
};

// ── GET /api/courses/:id/resources ────────────────────────────────────────────
// Returns metadata only — no URLs. Gated by checkEnrollment middleware.
export const listCourseResources = async (req, res, next) => {
  try {
    const resources = await Resource.find({ courseId: req.params.id })
      .select('-cloudinaryPublicId') // Don't expose internal Cloudinary IDs in list view
      .populate('uploadedBy', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: 'success',
      count:  resources.length,
      data:   resources,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/resources/:id/access ─────────────────────────────────────────────
// Returns a valid accessible signed URL. Gated by checkEnrollment middleware.
export const getResourceAccess = async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({
        status:  'error',
        code:    'NOT_FOUND',
        message: 'Resource not found.',
      });
    }

    configureCloudinary();

    let signedUrl = resource.cloudinaryUrl || resource.fileUrl;

    if (resource.cloudinaryPublicId && process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        const urlStr = resource.cloudinaryUrl || resource.fileUrl || '';

        // Detect delivery type ('upload' vs 'authenticated' vs 'private') from stored URL
        let deliveryType = 'upload';
        if (urlStr.includes('/authenticated/')) {
          deliveryType = 'authenticated';
        } else if (urlStr.includes('/private/')) {
          deliveryType = 'private';
        }

        let resourceType = 'raw';
        if (urlStr.includes('/image/')) resourceType = 'image';
        else if (urlStr.includes('/video/')) resourceType = 'video';
        else if (resource.type === 'image' || resource.type === 'pdf') resourceType = 'image';
        else if (resource.type === 'video') resourceType = 'video';

        let format;
        if (urlStr.endsWith('.pdf') || resource.type === 'pdf') format = 'pdf';
        else if (urlStr.endsWith('.png')) format = 'png';
        else if (urlStr.endsWith('.jpg') || urlStr.endsWith('.jpeg')) format = 'jpg';

        if (deliveryType === 'authenticated' || deliveryType === 'private') {
          // Use private_download_url for authenticated assets — returns HTTP 200 signed URL
          signedUrl = cloudinary.utils.private_download_url(resource.cloudinaryPublicId, format || '', {
            resource_type: resourceType,
            type:          deliveryType,
            expires_at:    Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
            attachment:    false, // Inline viewing in browser
          });
        } else {
          // Standard public upload delivery
          signedUrl = resource.cloudinaryUrl || resource.fileUrl;
        }
      } catch (cErr) {
        console.warn('Cloudinary URL resolution warning:', cErr.message);
        signedUrl = resource.cloudinaryUrl || resource.fileUrl;
      }
    }

    const action = req.query.download === 'true' ? 'resource_download' : 'resource_view';

    logActivity({
      userId:   req.user._id,
      action,
      metadata: {
        resourceId: resource._id,
        courseId:   resource.courseId,
        title:      resource.title,
        type:       resource.type,
      },
    });

    return res.status(200).json({
      status:    'success',
      expiresIn: 3600,
      signedUrl,
      data: {
        id:    resource._id,
        title: resource.title,
        type:  resource.type,
      },
    });
  } catch (err) {
    next(err);
  }
};
