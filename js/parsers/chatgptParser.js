// chatgptParser.js - Version 1.0
// Parser for extracting metadata from ChatGPT-generated images

/**
 * Extract ChatGPT-specific information from PNG text chunks
 * Handles the special JSON format that ChatGPT images use
 * @param {Object} chunks - PNG text chunks extracted from the image
 * @returns {Object} Extracted AI information
 */
export function extractChatGPTInfo(chunks) {
    const aiInfo = {
        title: '',
        prompt: '',
        model: '',
        tags: '',
        notes: ''
    };

    // Look for the "prompt" key that contains ChatGPT JSON data
    if (chunks.prompt) {
        try {
            const chatGPTData = JSON.parse(chunks.prompt);
            console.log('ChatGPT data found:', chatGPTData);
            
            // Extract prompt and internal_prompt and combine them
            let combinedPrompt = '';
            
            if (chatGPTData.prompt) {
                combinedPrompt += `USER PROMPT:\n${chatGPTData.prompt}\n\n`;
            }
            
            if (chatGPTData.internal_prompt) {
                combinedPrompt += `INTERNAL PROMPT:\n${chatGPTData.internal_prompt}`;
            }
            
            aiInfo.prompt = combinedPrompt.trim();
            
            // Extract tool information for AI Model
            if (chatGPTData.tool) {
                aiInfo.model = chatGPTData.tool;
            }
            
            // Build detailed notes from ChatGPT metadata
            aiInfo.notes += `🤖 ChatGPT Image Generation\n`;
            aiInfo.notes += `📅 Generated: ${chatGPTData.date_generated || 'Unknown'}\n`;
            
            if (chatGPTData.filename) {
                aiInfo.notes += `📄 Original filename: ${chatGPTData.filename}\n`;
            }
            
            if (chatGPTData.style) {
                aiInfo.notes += `🎨 Style: ${chatGPTData.style}\n`;
            }
            
            if (chatGPTData.aspect_ratio) {
                aiInfo.notes += `📐 Aspect ratio: ${chatGPTData.aspect_ratio}\n`;
            }
            
            if (chatGPTData.resolution) {
                aiInfo.notes += `🔍 Resolution: ${chatGPTData.resolution}\n`;
            }
            
            if (chatGPTData.file_size_mb) {
                aiInfo.notes += `💾 File size: ${chatGPTData.file_size_mb} MB\n`;
            }
            
            if (chatGPTData.source_image) {
                aiInfo.notes += `🖼️ Source image: ${chatGPTData.source_image}\n`;
            }
            
            // Set appropriate tags
            aiInfo.tags = 'ChatGPT,AI-Generated,Image-Gen';
            
            console.log('Extracted ChatGPT info:', aiInfo);
            
        } catch (e) {
            console.error('Error parsing ChatGPT data:', e);
            aiInfo.notes += '🤖 ChatGPT data found but could not parse JSON\n';
            aiInfo.tags = 'ChatGPT,AI-Generated';
        }
    }
    
    return aiInfo;
}

/**
 * Check if an image is from ChatGPT based on filename or metadata
 * @param {string} filename - The image filename
 * @param {Object} chunks - PNG text chunks
 * @returns {boolean} True if this appears to be a ChatGPT image
 */
export function isChatGPTImage(filename, chunks) {
    // Check filename
    if (filename.toLowerCase().startsWith('chatgpt')) {
        return true;
    }
    
    // Check if chunks contain ChatGPT-style JSON
    if (chunks.prompt) {
        try {
            const data = JSON.parse(chunks.prompt);
            return data.tool && data.tool.includes('ChatGPT');
        } catch (e) {
            // Not valid JSON or doesn't have expected structure
        }
    }
    
    return false;
}
