// pngChunkExtractor.js - Version 1.0
// Shared utility for extracting PNG text chunks where AI tools store metadata

/**
 * Extract PNG text chunks (tEXt, iTXt, zTXt)
 * This is where ComfyUI, ChatGPT, and other tools store metadata
 * @param {Uint8Array} uint8Array - The PNG file as a Uint8Array
 * @returns {Object} Object containing extracted text chunks
 */
export function extractPNGTextChunks(uint8Array) {
    const chunks = {};
    
    // Check PNG signature
    if (uint8Array[0] !== 0x89 || uint8Array[1] !== 0x50 || 
        uint8Array[2] !== 0x4E || uint8Array[3] !== 0x47) {
        return chunks; // Not a PNG file
    }
    
    let offset = 8; // Skip PNG signature
    
    while (offset < uint8Array.length - 8) {
        // Read chunk length (4 bytes, big-endian)
        const length = (uint8Array[offset] << 24) | (uint8Array[offset + 1] << 16) | 
                      (uint8Array[offset + 2] << 8) | uint8Array[offset + 3];
        
        // Read chunk type (4 bytes)
        const type = String.fromCharCode(
            uint8Array[offset + 4], uint8Array[offset + 5], 
            uint8Array[offset + 6], uint8Array[offset + 7]
        );
        
        // Check if it's a text chunk
        if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') {
            const dataStart = offset + 8;
            const chunkData = uint8Array.slice(dataStart, dataStart + length);
            
            if (type === 'tEXt') {
                const nullIndex = chunkData.indexOf(0);
                if (nullIndex !== -1) {
                    const keyword = new TextDecoder().decode(chunkData.slice(0, nullIndex));
                    const text = new TextDecoder().decode(chunkData.slice(nullIndex + 1));
                    chunks[keyword] = text;
                }
            }
            // Note: iTXt and zTXt support could be added here for compressed text
        }
        
        // Move to next chunk
        offset += 8 + length + 4; // length + type + data + CRC
    }
    
    return chunks;
}

/**
 * Check if a file is a PNG by examining its header
 * @param {Uint8Array} uint8Array - File data
 * @returns {boolean} True if file is a PNG
 */
export function isPNGFile(uint8Array) {
    return uint8Array.length > 8 &&
           uint8Array[0] === 0x89 && 
           uint8Array[1] === 0x50 && 
           uint8Array[2] === 0x4E && 
           uint8Array[3] === 0x47;
}