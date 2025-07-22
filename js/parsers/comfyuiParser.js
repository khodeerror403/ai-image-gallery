// comfyuiParser.js - Version 1.0
// Parser for extracting metadata from ComfyUI and AUTOMATIC1111 images

/**
 * Extract ComfyUI-specific information from PNG text chunks
 * Handles workflow and prompt data from ComfyUI
 * @param {Object} chunks - PNG text chunks extracted from the image
 * @returns {Object} Extracted AI information
 */
export function extractComfyUIInfo(chunks) {
    const aiInfo = {
        title: '',
        prompt: '',
        model: '',
        tags: '',
        notes: ''
    };

    // ComfyUI typically stores workflow in 'workflow' and prompt info in 'prompt'
    if (chunks.workflow) {
        try {
            const workflow = JSON.parse(chunks.workflow);
            
            // Add generation info first
            aiInfo.notes += `📅 Generated: ${new Date().toLocaleDateString()}\n`;
            
            // Handle different workflow structures
            let nodeCount = 0;
            let nodeTypes = new Set();
            
            if (workflow.nodes && Array.isArray(workflow.nodes)) {
                // New workflow format with nodes array
                nodeCount = workflow.nodes.length;
                workflow.nodes.forEach(node => {
                    if (node.type) {
                        nodeTypes.add(node.type);
                    }
                });
            } else if (typeof workflow === 'object') {
                // Old workflow format with direct node objects
                nodeCount = Object.keys(workflow).length;
                for (const nodeId in workflow) {
                    const node = workflow[nodeId];
                    if (node.class_type) {
                        nodeTypes.add(node.class_type);
                    }
                }
            }
            
            aiInfo.notes += `🔧 ComfyUI Workflow detected (${nodeCount} nodes)\n`;
            
            // Add node types to notes if found
            if (nodeTypes.size > 0) {
                const sortedNodeTypes = Array.from(nodeTypes).sort();
                aiInfo.notes += `🔗 Node Types: ${sortedNodeTypes.join(', ')}\n`;
            }
            
            // Try to extract prompt from workflow nodes (new format)
            if (workflow.nodes && Array.isArray(workflow.nodes)) {
                for (const node of workflow.nodes) {
                    if (node.type === 'CLIPTextEncode' && node.widgets_values && node.widgets_values.length > 0) {
                        const text = node.widgets_values[0];
                        if (typeof text === 'string' && text.length > 10 && !aiInfo.prompt) {
                            aiInfo.prompt = text;
                            break;
                        }
                    }
                }
            } else {
                // Try to extract prompt from workflow nodes (old format)
                for (const nodeId in workflow) {
                    const node = workflow[nodeId];
                    if (node.inputs && node.inputs.text && typeof node.inputs.text === 'string') {
                        if (node.inputs.text.length > 10 && !aiInfo.prompt) {
                            aiInfo.prompt = node.inputs.text;
                            break;
                        }
                    }
                }
            }
        } catch (e) {
            aiInfo.notes += '🔧 ComfyUI Workflow data found (raw)\n';
        }
    }

    // Check for prompt data (might be from ComfyUI or other tools)
    if (chunks.prompt && !aiInfo.prompt) {
        try {
            const promptData = JSON.parse(chunks.prompt);
            if (typeof promptData === 'object') {
                // Extract useful info from prompt data
                for (const key in promptData) {
                    if (typeof promptData[key] === 'string' && promptData[key].length > 10 && !aiInfo.prompt) {
                        aiInfo.prompt = promptData[key];
                        break;
                    }
                }
            }
        } catch (e) {
            // If not JSON, treat as plain text
            if (chunks.prompt.length > 5 && !aiInfo.prompt) {
                aiInfo.prompt = chunks.prompt;
            }
        }
    }

    // Check for parameters (AUTOMATIC1111 style)
    if (chunks.parameters) {
        aiInfo.prompt = aiInfo.prompt || chunks.parameters;
        aiInfo.notes += '🤖 A1111 Parameters detected\n';
        aiInfo.tags = 'AUTOMATIC1111,AI-Generated';
    }

    // Check for Software/model info
    if (chunks.Software) {
        aiInfo.model = chunks.Software;
    }
    
    if (chunks.software) {
        aiInfo.model = chunks.software;
    }

    // Set tags if we have ComfyUI data
    if (chunks.workflow || (chunks.prompt && !chunks.parameters)) {
        aiInfo.tags = aiInfo.tags || 'ComfyUI,AI-Generated';
    }
    
    return aiInfo;
}

/**
 * Check if an image is from ComfyUI based on metadata
 * @param {Object} chunks - PNG text chunks
 * @returns {boolean} True if this appears to be a ComfyUI image
 */
export function isComfyUIImage(chunks) {
    return !!(chunks.workflow || chunks.prompt);
}

/**
 * Check if an image is from AUTOMATIC1111 based on metadata
 * @param {Object} chunks - PNG text chunks
 * @returns {boolean} True if this appears to be an A1111 image
 */
export function isA1111Image(chunks) {
    return !!chunks.parameters;
}