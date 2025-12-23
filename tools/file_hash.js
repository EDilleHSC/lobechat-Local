const fs = require('fs');
const crypto = require('crypto');

/**
 * Compute SHA-256 hash of a file (streamed).
 * @param {string} filePath
 * @returns {Promise<string>} hex-encoded sha256
 */
function computeFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const rs = fs.createReadStream(filePath);
    rs.on('error', err => reject(err));
    rs.on('data', chunk => hash.update(chunk));
    rs.on('end', () => resolve(hash.digest('hex')));
  });
}

module.exports = { computeFileHash };
