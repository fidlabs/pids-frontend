import express from 'express';
import Dataset from '../models/Dataset.js';
import { authenticateToken, requireAdmin, optionalAuth } from '../middleware/auth.js';
import { parseManifest, validateManifest } from '../utils/manifestParser.js';
import {
  buildResolveQuery,
  isLikelyPieceCid,
  normalizePieceCid,
} from '../utils/datasetResolve.js';
import { uploadFile, getStorageClient } from '../utils/storage.js';
import multer from 'multer';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// POST /api/datasets/upload-manifest - Upload manifest file (unauthenticated)
router.post('/upload-manifest', upload.single('manifest'), async (req, res) => {
  try {
    console.log('📁 Manifest upload request received');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No manifest file provided'
      });
    }
    
    console.log('📄 File details:', {
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
    
    // Parse the manifest JSON
    let manifestData;
    try {
      const manifestText = req.file.buffer.toString('utf8');
      manifestData = JSON.parse(manifestText);
      console.log('✅ Manifest JSON parsed successfully');
    } catch (error) {
      console.error('❌ JSON parsing error:', error);
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON in manifest file'
      });
    }
    
    // Validate manifest structure
    try {
      validateManifest(manifestData);
      console.log('✅ Manifest validation passed');
    } catch (error) {
      console.error('❌ Manifest validation failed:', error);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    // Parse manifest to dataset format
    let datasetData;
    try {
      datasetData = parseManifest(manifestData);
      console.log('✅ Manifest converted to dataset format');
    } catch (error) {
      console.error('❌ Manifest parsing failed:', error);
      return res.status(400).json({
        success: false,
        error: `Failed to parse manifest: ${error.message}`
      });
    }
    
    // Save manifest file to MinIO
    let manifestFilePath;
    try {
      const manifestFileName = `manifests/${datasetData.uuid || Date.now()}_${req.file.originalname}`;
      const uploadResult = await uploadFile(req.file, manifestFileName);
      manifestFilePath = manifestFileName;
      console.log('✅ Manifest file saved to MinIO:', manifestFilePath);
    } catch (error) {
      console.error('❌ Failed to save manifest file:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to save manifest file'
      });
    }
    
    // Override network from query param if provided
    const { network } = req.query;
    if (network) {
      if (!['mainnet', 'calibration'].includes(network)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid network. Must be \"mainnet\" or \"calibration\"'
        });
      }
      datasetData.network = network;
    } else {
      datasetData.network = 'mainnet'; // Probably :)
    }

    // Add manifest file path to dataset
    datasetData.manifestFile = manifestFilePath;

    // Create dataset in database
    try {
      const dataset = new Dataset(datasetData);
      await dataset.save();
      console.log('✅ Dataset created in database:', dataset._id);
      
      res.status(201).json({
        success: true,
        data: {
          id: dataset._id,
          title: dataset.title,
          status: dataset.status,
          manifestFile: dataset.manifestFile,
          message: 'Manifest uploaded successfully and dataset created in quarantine'
        }
      });
    } catch (error) {
      console.error('❌ Failed to save dataset:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to save dataset to database'
      });
    }
    
  } catch (error) {
    console.error('❌ Error in manifest upload:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/datasets - Get datasets (filtered by authentication)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { search, format, tags, network, page = 1, limit = 20 } = req.query;
    
    console.log('🔍 GET /api/datasets - Auth state:', { 
      hasUser: !!req.user, 
      userRoles: req.user?.roles || [], 
      isAdmin: req.user?.roles?.includes('admin') || false 
    });
    
    // Build query - filter by status based on authentication
    let query = { isPublic: true };
    
    // If user is not authenticated or not admin, only return approved datasets
    if (!req.user || !req.user.roles.includes('admin')) {
      query.status = 'approved';
      console.log('🔒 Filtering to approved datasets only');
    } else {
      console.log('👑 Admin user - returning all datasets');
    }
    
    if (search) {
      query.$text = { $search: search };
    }
    
    if (format) {
      query.format = format;
    }
    
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }
    
    query.network = network || 'mainnet';
    
    console.log('🔍 Final query:', JSON.stringify(query, null, 2));
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const datasets = await Dataset.find(query)
      .sort({ dateCreated: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Dataset.countDocuments(query);
    
    console.log(`📊 Found ${datasets.length} datasets (total: ${total})`);
    
    res.json({
      success: true,
      data: datasets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error in GET /api/datasets:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/datasets/tags - Get top tags by frequency
router.get('/tags', async (req, res) => {
  try {
    console.log('🏷️ GET /api/datasets/tags - Fetching top tags');
    
    // Aggregate to get tag frequency
    const tagStats = await Dataset.aggregate([
      // Only include approved datasets for public tag stats
      { $match: { status: 'approved', isPublic: true } },
      // Unwind the tags array to create a document for each tag
      { $unwind: '$tags' },
      // Group by tag and count occurrences
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      // Sort by count descending
      { $sort: { count: -1 } },
      // Limit to top 20
      { $limit: 20 },
      // Project to clean format
      { $project: { tag: '$_id', count: 1, _id: 0 } }
    ]);
    
    console.log(`🏷️ Found ${tagStats.length} unique tags`);
    
    res.json({
      success: true,
      data: tagStats
    });
  } catch (error) {
    console.error('❌ Error in GET /api/datasets/tags:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/datasets/resolve?piece_cid=...&network=mainnet
// Resolve dataset UUID(s) for a Filecoin Piece CID (may return multiple matches).
router.get('/resolve', optionalAuth, async (req, res) => {
  try {
    const pieceCid = normalizePieceCid(req.query.piece_cid);
    const { network } = req.query;

    if (!pieceCid) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter piece_cid is required',
      });
    }

    if (!isLikelyPieceCid(pieceCid)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid piece_cid: expected a Filecoin Piece CID (baga...)',
      });
    }

    if (network && !['mainnet', 'calibration'].includes(network)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid network. Must be "mainnet" or "calibration"',
      });
    }

    const isAdmin = req.user?.roles?.includes('admin') ?? false;
    const publicOnly = !isAdmin;

    const query = buildResolveQuery({ pieceCid, network, publicOnly });
    const matches = await Dataset.find(query)
      .select('_id uuid')
      .lean();

    const uuids = matches.map((dataset) => dataset.uuid || dataset._id);

    console.log(`🔍 Resolved piece_cid ${pieceCid.slice(0, 16)}... → ${uuids.length} dataset(s)`);

    return res.json({
      success: true,
      data: uuids,
    });
  } catch (error) {
    console.error('❌ Error in GET /api/datasets/resolve:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/datasets/:id - Get dataset by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const dataset = await Dataset.findById(id).lean();
    
    if (!dataset) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found'
      });
    }
    
    res.json({
      success: true,
      data: dataset
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/datasets - Create new dataset (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const datasetData = {
      ...req.body,
      createdBy: req.user.id
    };
    
    const dataset = new Dataset(datasetData);
    await dataset.save();
    
    res.status(201).json({
      success: true,
      data: dataset
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/datasets/:id - Update dataset (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const dataset = await Dataset.findByIdAndUpdate(
      id,
      { ...updateData, dateUpdated: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!dataset) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found'
      });
    }
    
    res.json({
      success: true,
      data: dataset
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PATCH /api/datasets/:id/tags - Update dataset tags (admin only)
router.patch('/:id/tags', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      return res.status(400).json({
        success: false,
        error: 'Tags must be provided as an array of strings'
      });
    }

    // Normalize tags: trim, lowercase, remove empties, dedupe, cap count.
    const normalizedTags = [...new Set(
      tags
        .map((tag) => (typeof tag === 'string' ? tag.trim().toLowerCase() : ''))
        .filter((tag) => tag.length > 0)
    )].slice(0, 50);

    const dataset = await Dataset.findByIdAndUpdate(
      id,
      {
        tags: normalizedTags,
        dateUpdated: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!dataset) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found'
      });
    }

    return res.json({
      success: true,
      data: dataset
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/datasets/:id - Delete dataset (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Admin delete request for dataset: ${id}`);
    
    // Find the dataset first to get its details for MinIO cleanup
    const dataset = await Dataset.findById(id);
    
    if (!dataset) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found'
      });
    }
    
    console.log(`📁 Dataset found: ${dataset.title} (${dataset._id})`);
    
    // Delete from MinIO: remove the entire dataset directory and manifest file
    try {
      const client = getStorageClient();
      const bucketName = process.env.MINIO_BUCKET || 'pids-datasets';
      
      // Delete manifest file if it exists
      if (dataset.manifestFile) {
        try {
          await client.removeObject(bucketName, dataset.manifestFile);
          console.log(`🗑️ Deleted manifest file: ${dataset.manifestFile}`);
        } catch (error) {
          console.warn(`⚠️ Could not delete manifest file: ${error.message}`);
        }
      }
      
      // Delete the entire dataset directory and all its contents
      const datasetPath = `datasets/${dataset._id}`;
      try {
        // List all objects in the dataset directory
        const objects = client.listObjects(bucketName, datasetPath, true);
        const objectsToDelete = [];
        
        for await (const obj of objects) {
          objectsToDelete.push(obj.name);
        }
        
        // Delete all objects in the dataset directory
        if (objectsToDelete.length > 0) {
          await client.removeObjects(bucketName, objectsToDelete);
          console.log(`🗑️ Deleted ${objectsToDelete.length} files from MinIO:`, objectsToDelete);
        }
        
        console.log(`🗑️ Completed MinIO cleanup for dataset: ${dataset._id}`);
      } catch (error) {
        console.warn(`⚠️ Could not delete dataset files from MinIO: ${error.message}`);
      }
      
    } catch (error) {
      console.error(`❌ MinIO cleanup failed: ${error.message}`);
      // Continue with database deletion even if MinIO cleanup fails
    }
    
    // Delete from database
    await Dataset.findByIdAndDelete(id);
    console.log(`🗑️ Dataset deleted from database: ${id}`);
    
    res.json({
      success: true,
      message: 'Dataset and all associated files deleted successfully'
    });
    
  } catch (error) {
    console.error(`❌ Dataset deletion failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/datasets/:id/approve - Approve dataset (admin only)
router.put('/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const dataset = await Dataset.findByIdAndUpdate(
      id,
      { 
        status: 'approved',
        dateUpdated: new Date(),
        verifiedDate: new Date()
      },
      { new: true, runValidators: true }
    );
    
    if (!dataset) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found'
      });
    }
    
    res.json({
      success: true,
      data: dataset
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/datasets/:id/reject - Reject dataset (admin only)
router.put('/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const dataset = await Dataset.findByIdAndUpdate(
      id,
      { 
        status: 'rejected',
        dateUpdated: new Date()
      },
      { new: true, runValidators: true }
    );
    
    if (!dataset) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found'
      });
    }
    
    res.json({
      success: true,
      data: dataset
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});



export default router; 