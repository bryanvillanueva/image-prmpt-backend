'use strict';

const cloudinary = require('../config/cloudinary');

function uploadImage(buffer, { folder = 'prompts', publicId } = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
        format: 'webp',
        transformation: [{ quality: 'auto:good' }],
        overwrite: true,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

async function deleteImage(publicId) {
  if (!publicId) return null;
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    console.error('[cloudinary] error eliminando imagen', publicId, err.message);
    return null;
  }
}

module.exports = { uploadImage, deleteImage };
