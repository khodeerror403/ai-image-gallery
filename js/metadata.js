// metadata.js - Handles metadata extraction and display

import { formatDuration, cleanPromptText, cleanModelName } from './utils.js';

// Display metadata in organized sections
export function displayOrganizedMetadata(metadata, isVideo = false) {
    const promptSection = document.getElementById('promptSection');
    const workflowSection = document.getElementById('workflowSection');
    const otherMetadataSection = document.getElementById('otherMetadataSection');
    const noMetadataMessage = document.getElementById('noMetadataMessage');
    
    const promptDisplay = document.getElementById('promptDisplay');
    const workflowDisplay = document.getElementById('workflowDisplay');
    const otherMetadataDisplay = document.getElementById('otherMetadataDisplay');
    
    // Reset all sections
    promptSection.style.display = 'none';
    workflowSection.style.display = 'none';
    otherMetadataSection.style.display = 'none';
    noMetadataMessage.style.display = 'block';
    
    if (!metadata || Object.keys(metadata).length === 0) {
        return;
    }
    
    let hasAnyMetadata = false;
    
    if (isVideo) {
        // Handle video metadata
        hasAnyMetadata = true;
        otherMetadataSection.style.display = 'block';
        
        let videoHtml = '<div style="color: #2c3e50; font-family: Arial, sans-serif;">';
        
        if (metadata.duration) {
            videoHtml += `<strong>Duration:</strong> ${formatDuration(metadata.duration)}<br>`;
        }
        if (metadata.videoWidth && metadata.videoHeight) {
            videoHtml += `<strong>Dimensions:</strong> ${metadata.videoWidth} × ${metadata.videoHeight}<br>`;
        }
        if (metadata.fileSize) {
            const sizeMB = (metadata.fileSize / (1024 * 1024)).toFixed(2);
            videoHtml += `<strong>File Size:</strong> ${sizeMB} MB<br>`;
        }
        if (metadata.creationDate) {
            videoHtml += `<strong>Creation Date:</strong> ${metadata.creationDate}<br>`;
        }
        if (metadata.fileType) {
            videoHtml += `<strong>File Type:</strong> ${metadata.fileType}<br>`;
        }
        if (metadata.fileName) {
            videoHtml += `<strong>Original Name:</strong> ${metadata.fileName}<br>`;
        }
        
        videoHtml += '</div>';
        otherMetadataDisplay.innerHTML = videoHtml;
    } else {
        // Handle image metadata (existing logic)
        // Handle Prompt Data - Updated to be collapsible like Workflow Data
        if (metadata.prompt) {
            hasAnyMetadata = true;
            promptSection.style.display = 'block';
            try {
                const promptData = JSON.parse(metadata.prompt);
                if (typeof promptData === 'object') {
                    // Check if this is ChatGPT data
                    const isChatGPTData = promptData.tool && promptData.tool.includes('ChatGPT');
                    
                    if (isChatGPTData) {
                        // Show ChatGPT-specific summary
                        promptDisplay.innerHTML = `
                            <div style="color: #2c3e50; margin-bottom: 8px;">
                                <strong>Tool:</strong> ${promptData.tool || 'Unknown'}<br>
                                <strong>Style:</strong> ${promptData.style || 'Unknown'}<br>
                                <strong>Resolution:</strong> ${promptData.resolution || 'Unknown'}<br>
                                <strong>Generated:</strong> ${promptData.date_generated || 'Unknown'}
                            </div>
                            <details style="margin-top: 8px;">
                                <summary style="cursor: pointer; color: #2c3e50; font-weight: bold;">View Full ChatGPT JSON</summary>
                                <pre style="margin: 8px 0 0 0; white-space: pre-wrap; font-size: 10px; max-height: 200px; overflow-y: auto; background: #fff; padding: 8px; border-radius: 4px;">${JSON.stringify(promptData, null, 2)}</pre>
                            </details>
                        `;
                    } else {
                        // Show regular prompt data summary
                        const promptKeys = Object.keys(promptData);
                        const promptSize = JSON.stringify(promptData).length;
                        
                        promptDisplay.innerHTML = `
                            <div style="color: #2c3e50; margin-bottom: 8px;">
                                <strong>Keys:</strong> ${promptKeys.join(', ')}<br>
                                <strong>Data Size:</strong> ${promptSize} characters
                            </div>
                            <details style="margin-top: 8px;">
                                <summary style="cursor: pointer; color: #2c3e50; font-weight: bold;">View Full Prompt JSON</summary>
                                <pre style="margin: 8px 0 0 0; white-space: pre-wrap; font-size: 10px; max-height: 200px; overflow-y: auto; background: #fff; padding: 8px; border-radius: 4px;">${JSON.stringify(promptData, null, 2)}</pre>
                            </details>
                        `;
                    }
                } else {
                    // If it's not an object (plain text), still make it collapsible
                    promptDisplay.innerHTML = `
                        <div style="color: #2c3e50; margin-bottom: 8px;">
                            <strong>Type:</strong> Plain Text<br>
                            <strong>Length:</strong> ${promptData.length} characters
                        </div>
                        <details style="margin-top: 8px;">
                            <summary style="cursor: pointer; color: #2c3e50; font-weight: bold;">View Full Prompt Data</summary>
                            <pre style="margin: 8px 0 0 0; white-space: pre-wrap; font-size: 11px; max-height: 200px; overflow-y: auto; background: #fff; padding: 8px; border-radius: 4px; color: #2c3e50;">${promptData}</pre>
                        </details>
                    `;
                }
            } catch (e) {
                // If not JSON, display as text with collapsible view
                const textLength = metadata.prompt.length;
                promptDisplay.innerHTML = `
                    <div style="color: #2c3e50; margin-bottom: 8px;">
                        <strong>Type:</strong> Raw Text<br>
                        <strong>Length:</strong> ${textLength} characters
                    </div>
                    <details style="margin-top: 8px;">
                        <summary style="cursor: pointer; color: #2c3e50; font-weight: bold;">View Full Prompt Data</summary>
                        <pre style="margin: 8px 0 0 0; white-space: pre-wrap; font-size: 11px; max-height: 200px; overflow-y: auto; background: #fff; padding: 8px; border-radius: 4px; color: #2c3e50;">${metadata.prompt}</pre>
                    </details>
                `;
            }
        }
        
        // Handle Workflow Data
        if (metadata.workflow) {
            hasAnyMetadata = true;
            workflowSection.style.display = 'block';
            try {
                const workflowData = JSON.parse(metadata.workflow);
                
                // Extract text from workflow data and populate AI Prompt field
                extractTextFromWorkflow(workflowData);
                
                // Extract model information and populate AI Model field
                extractModelFromWorkflow(workflowData);
                
                // Show a summary of the workflow
                const nodeCount = workflowData.nodes ? workflowData.nodes.length : 'Unknown';
                const workflowId = workflowData.id || 'Unknown';
                const lastNodeId = workflowData.last_node_id || 'Unknown';
                
                workflowDisplay.innerHTML = `
                    <div style="color: #856404; margin-bottom: 8px;">
                        <strong>Workflow ID:</strong> ${workflowId}<br>
                        <strong>Nodes:</strong> ${nodeCount}<br>
                        <strong>Last Node ID:</strong> ${lastNodeId}
                    </div>
                    <details style="margin-top: 8px;">
                        <summary style="cursor: pointer; color: #856404; font-weight: bold;">View Full Workflow JSON</summary>
                        <pre style="margin: 8px 0 0 0; white-space: pre-wrap; font-size: 10px; max-height: 200px; overflow-y: auto; background: #fff; padding: 8px; border-radius: 4px;">${JSON.stringify(workflowData, null, 2)}</pre>
                    </details>
                `;
            } catch (e) {
                workflowDisplay.innerHTML = `<div style="color: #856404;">Raw workflow data (${metadata.workflow.length} characters)</div>`;
            }
        }
        
        // Handle Other Metadata
        const otherMetadata = {};
        for (const [key, value] of Object.entries(metadata)) {
            if (key !== 'prompt' && key !== 'workflow' && value !== null && value !== undefined && value !== '') {
                otherMetadata[key] = value;
            }
        }
        
        if (Object.keys(otherMetadata).length > 0) {
            hasAnyMetadata = true;
            otherMetadataSection.style.display = 'block';
            let otherHtml = '';
            for (const [key, value] of Object.entries(otherMetadata)) {
                otherHtml += `<strong>${key}:</strong> ${value}<br>`;
            }
            otherMetadataDisplay.innerHTML = otherHtml;
        }
    }
    
    // Hide "no metadata" message if we have any metadata
    if (hasAnyMetadata) {
        noMetadataMessage.style.display = 'none';
    }
}

// Extract model information from workflow and populate AI Model field
export function extractModelFromWorkflow(workflowData) {
    const modelInput = document.getElementById('imageModel');
    
    // Only populate if the field is currently empty
    if (modelInput.value && modelInput.value.trim() !== '') {
        return; // Don't overwrite user's manual input
    }
    
    let modelNames = [];
    
    // Search through workflow nodes for model information
    if (workflowData.nodes && Array.isArray(workflowData.nodes)) {
        for (const node of workflowData.nodes) {
            
            // Look for CheckpointLoaderSimple nodes (most common)
            if (node.type === 'CheckpointLoaderSimple') {
                if (node.widgets_values && Array.isArray(node.widgets_values) && node.widgets_values.length > 0) {
                    const checkpointName = node.widgets_values[0];
                    if (typeof checkpointName === 'string' && checkpointName.length > 0) {
                        modelNames.push({
                            name: checkpointName,
                            type: 'Checkpoint',
                            priority: 1
                        });
                    }
                }
            }
            
            // Look for LoraLoader nodes
            if (node.type === 'LoraLoader') {
                if (node.widgets_values && Array.isArray(node.widgets_values) && node.widgets_values.length > 0) {
                    const loraName = node.widgets_values[0];
                    if (typeof loraName === 'string' && loraName.length > 0) {
                        modelNames.push({
                            name: loraName,
                            type: 'LoRA',
                            priority: 2
                        });
                    }
                }
            }
            
            // Look for other model loader nodes
            if (node.type && (node.type.includes('Loader') || node.type.includes('Model')) && 
                node.type !== 'ControlNetLoader' && node.type !== 'VAELoader') {
                if (node.widgets_values && Array.isArray(node.widgets_values)) {
                    for (const value of node.widgets_values) {
                        if (typeof value === 'string' && value.length > 0 && 
                            (value.includes('.safetensors') || value.includes('.ckpt') || value.includes('.pt'))) {
                            modelNames.push({
                                name: value,
                                type: 'Model',
                                priority: 3
                            });
                        }
                    }
                }
            }
        }
    }
    
    // Build the model information string
    if (modelNames.length > 0) {
        // Sort by priority (lower number = higher priority)
        modelNames.sort((a, b) => a.priority - b.priority);
        
        let modelText = '';
        
        if (modelNames.length === 1) {
            // Single model - just use the name, cleaned up
            modelText = cleanModelName(modelNames[0].name);
        } else {
            // Multiple models - show primary + additional info
            const primaryModel = cleanModelName(modelNames[0].name);
            const additionalModels = modelNames.slice(1);
            
            modelText = primaryModel;
            
            // Add LoRAs and other models as additional info
            const loras = additionalModels.filter(m => m.type === 'LoRA');
            if (loras.length > 0) {
                modelText += ` + ${loras.length} LoRA${loras.length > 1 ? 's' : ''}`;
            }
            
            const otherModels = additionalModels.filter(m => m.type !== 'LoRA');
            if (otherModels.length > 0) {
                modelText += ` + ${otherModels.length} additional model${otherModels.length > 1 ? 's' : ''}`;
            }
        }
        
        // Populate the input field
        modelInput.value = modelText;
        console.log(`Extracted model info: ${modelText}`);
    }
}

// Extract text from workflow data and populate the AI Prompt field
export function extractTextFromWorkflow(workflowData) {
    const promptTextarea = document.getElementById('imagePrompt');
    
    // Only populate if the field is currently empty or contains default text
    if (promptTextarea.value && !promptTextarea.value.includes('aidma-niji, niji, anime style')) {
        return; // Don't overwrite user's manual input
    }
    
    let candidateTexts = [];
    
    // Search through workflow nodes for text
    if (workflowData.nodes && Array.isArray(workflowData.nodes)) {
        for (const node of workflowData.nodes) {
            
            // Priority 1: Look for custom prompt nodes
            if (node.type && node.type.includes('prompt')) {
                if (node.widgets_values && Array.isArray(node.widgets_values)) {
                    for (const value of node.widgets_values) {
                        if (typeof value === 'string' && value.length > 20) {
                            candidateTexts.push({ 
                                text: value, 
                                priority: 1, 
                                source: node.type,
                                label: 'Custom Prompt'
                            });
                        }
                    }
                }
            }
            
            // Priority 2: Look for ShowText nodes (often contain processed prompts)
            if (node.type === 'ShowText|pysssss') {
                if (node.widgets_values && Array.isArray(node.widgets_values)) {
                    for (const value of node.widgets_values) {
                        if (Array.isArray(value) && value.length > 0) {
                            // ShowText often stores text in nested arrays
                            for (const textItem of value) {
                                if (typeof textItem === 'string' && textItem.length > 20) {
                                    candidateTexts.push({ 
                                        text: textItem, 
                                        priority: 2, 
                                        source: node.type,
                                        label: 'Processed Text'
                                    });
                                }
                            }
                        } else if (typeof value === 'string' && value.length > 20) {
                            candidateTexts.push({ 
                                text: value, 
                                priority: 2, 
                                source: node.type,
                                label: 'Processed Text'
                            });
                        }
                    }
                }
            }
            
            // Priority 3: Look for Text Find and Replace nodes (often modify prompts)
            if (node.type === 'Text Find and Replace') {
                if (node.widgets_values && Array.isArray(node.widgets_values)) {
                    // Usually the "replace" text is more useful than "find"
                    if (node.widgets_values.length > 1 && typeof node.widgets_values[1] === 'string' && node.widgets_values[1].length > 20) {
                        candidateTexts.push({ 
                            text: node.widgets_values[1], 
                            priority: 3, 
                            source: node.type,
                            label: 'Replace Text'
                        });
                    }
                }
            }
            
            // Priority 4: Look for CLIPTextEncode nodes (traditional method)
            if (node.type === 'CLIPTextEncode') {
                if (node.widgets_values && Array.isArray(node.widgets_values)) {
                    for (const value of node.widgets_values) {
                        if (typeof value === 'string' && value.length > 10) {
                            // Skip very short/generic text but include embeddings if they're longer
                            if (!value.includes('embedding:') || value.length > 30) {
                                candidateTexts.push({ 
                                    text: value, 
                                    priority: 4, 
                                    source: node.type,
                                    label: value.includes('embedding:') ? 'Negative Prompt' : 'Positive Prompt'
                                });
                            }
                        }
                    }
                }
            }
            
            // Priority 5: Look for other text-related nodes
            if (node.type === 'Text' || node.type === 'TextBox' || (node.type && node.type.includes('Text'))) {
                if (node.widgets_values && Array.isArray(node.widgets_values)) {
                    for (const value of node.widgets_values) {
                        if (typeof value === 'string' && value.length > 20) {
                            candidateTexts.push({ 
                                text: value, 
                                priority: 5, 
                                source: node.type,
                                label: 'Text Node'
                            });
                        }
                    }
                }
            }
        }
    }
    
    // Remove duplicates and very similar text
    const uniqueTexts = [];
    for (const candidate of candidateTexts) {
        const isDuplicate = uniqueTexts.some(existing => 
            existing.text === candidate.text || 
            (existing.text.includes(candidate.text) || candidate.text.includes(existing.text))
        );
        if (!isDuplicate) {
            uniqueTexts.push(candidate);
        }
    }
    
    // Sort by priority (lower number = higher priority) and then by length
    uniqueTexts.sort((a, b) => {
        if (a.priority !== b.priority) {
            return a.priority - b.priority;
        }
        return b.text.length - a.text.length; // Longer text first within same priority
    });
    
    // Build the combined prompt text
    let combinedPrompt = '';
    
    if (uniqueTexts.length === 1) {
        // Single prompt - just use it directly
        combinedPrompt = cleanPromptText(uniqueTexts[0].text);
    } else if (uniqueTexts.length > 1) {
        // Multiple prompts - organize them with labels
        combinedPrompt = '=== MULTIPLE PROMPTS FOUND ===\n\n';
        
        uniqueTexts.forEach((prompt, index) => {
            combinedPrompt += `${index + 1}. ${prompt.label} (${prompt.source}):\n`;
            combinedPrompt += cleanPromptText(prompt.text) + '\n\n';
        });
        
        combinedPrompt += '=== END OF PROMPTS ===\n\n';
        combinedPrompt += `PRIMARY PROMPT:\n${cleanPromptText(uniqueTexts[0].text)}`;
    }
    
    // Populate the textarea if we found text
    if (combinedPrompt) {
        promptTextarea.value = combinedPrompt;
        console.log(`Extracted ${uniqueTexts.length} unique prompts from workflow`);
    }
}