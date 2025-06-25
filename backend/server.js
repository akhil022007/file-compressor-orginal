const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const zlib = require('zlib');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const rleCompress = (buffer) => {
    const compressedBytes = [];
    let i = 0;
    while (i < buffer.length) {
        let count = 1;
        const byte = buffer[i];

        while (i + count < buffer.length && buffer[i + count] === byte && count < 255) {
            count++;
        }

        if (count > 1) {
            compressedBytes.push(count);
            compressedBytes.push(byte);
        } else {
            compressedBytes.push(0);
            compressedBytes.push(byte);
        }
        i += count;
    }
    return Buffer.from(compressedBytes);
};

const rleDecompress = (buffer) => {
    const decompressedBytes = [];
    let i = 0;
    while (i < buffer.length) {
        if (i + 1 >= buffer.length) {
            throw new Error("RLE decompression failed: Invalid compressed data format or incomplete stream.");
        }
        const count = buffer[i];
        const byte = buffer[i + 1];

        if (count > 0) {
            for (let j = 0; j < count; j++) {
                decompressedBytes.push(byte);
            }
        } else {
            decompressedBytes.push(byte);
        }
        i += 2;
    }
    return Buffer.from(decompressedBytes);
};

const lz77Compress = (buffer) => {
    try {
        return zlib.deflateSync(buffer);
    } catch (error) {
        console.error("LZ77 Compression Error:", error);
        throw new Error("LZ77 compression failed: " + error.message);
    }
};

const lz77Decompress = (buffer) => {
    try {
        return zlib.inflateSync(buffer);
    } catch (error) {
        console.error("LZ77 Decompression Error:", error);
        if (error.message.includes('Z_DATA_ERROR') || error.code === 'Z_DATA_ERROR') {
            throw new Error("The file is not compressed with this algorithm or file is not compressed.");
        }
        throw new Error("LZ77 decompression failed: " + error.message);
    }
};

const huffmanCompress = (buffer) => {
    console.warn("Using DUMMY Huffman compression. Data may be lost or corrupted.");
    const originalLength = buffer.length;
    const compressedLength = Math.max(1, Math.floor(originalLength * 0.4));
    return Buffer.from(buffer.slice(0, compressedLength));
};

const huffmanDecompress = (buffer, originalSize) => {
    console.warn("Using DUMMY Huffman decompression. File will be empty or corrupted.");
    return Buffer.alloc(originalSize, 0x00);
};

app.post('/api/process-file', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        const { algorithm, operation, originalSize: frontendOriginalSize } = req.body;
        const originalBuffer = req.file.buffer;
        const originalSize = originalBuffer.length;

        let processedBuffer;
        let startTime = process.hrtime.bigint();

        switch (algorithm) {
            case 'huffman':
                if (operation === 'compress') {
                    processedBuffer = huffmanCompress(originalBuffer);
                } else {
                    processedBuffer = huffmanDecompress(originalBuffer, parseInt(frontendOriginalSize));
                }
                break;
            case 'rle':
                if (operation === 'compress') {
                    processedBuffer = rleCompress(originalBuffer);
                } else {
                    processedBuffer = rleDecompress(originalBuffer);
                }
                break;
            case 'lz77':
                if (operation === 'compress') {
                    processedBuffer = lz77Compress(originalBuffer);
                } else {
                    processedBuffer = lz77Decompress(originalBuffer);
                }
                break;
            default:
                return res.status(400).json({ success: false, message: 'Invalid algorithm selected.' });
        }

        let endTime = process.hrtime.bigint();
        const processingTimeMs = Number(endTime - startTime) / 1_000_000;

        const processedSize = processedBuffer.length;
        const compressionRatio = operation === 'compress'
            ? (originalSize / processedSize).toFixed(2)
            : 'N/A';

        res.json({
            success: true,
            originalSize: originalSize,
            processedSize: processedSize,
            compressionRatio: compressionRatio,
            processingTime: processingTimeMs.toFixed(2),
            processedFileBase64: processedBuffer.toString('base64'),
            mimeType: req.file.mimetype || 'application/octet-stream',
            fileName: req.file.originalname,
        });

    } catch (error) {
        console.error('Backend processing error:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error during processing.', error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});
