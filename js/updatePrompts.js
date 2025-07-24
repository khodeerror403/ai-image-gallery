// updatePrompts.js - Script to update existing prompts in the database
import { database } from './database.js';
import { cleanPromptText } from './utils.js';

/**
 * Update all prompts in the database to clean them
 * @returns {Promise<Object>} Results object with processed and error counts
 */
export async function updateAllPrompts() {
    console.log('Starting prompt update for existing images...');
    
    try {
        const allMedia = await database.loadAllMedia();
        let processed = 0;
        let skipped = 0;
        let errors = 0;
        
        for (let i = 0; i < allMedia.length; i++) {
            const item = allMedia[i];
            
            // Skip if no prompt
            if (!item.prompt) {
                console.log(`Item ${item.id} has no prompt, skipping...`);
                skipped++;
                continue;
            }
            
            try {
                console.log(`Updating prompt for item ${item.id} (${i + 1}/${allMedia.length})...`);
                
                // Clean the prompt
                const cleanedPrompt = cleanPromptText(item.prompt);
                
                // Only update if the prompt actually changed and the cleaned prompt is meaningful
                if (cleanedPrompt !== item.prompt && cleanedPrompt.length > 1) {
                    await database.updateMedia(item.id, {
                        prompt: cleanedPrompt
                    });
                    
                    processed++;
                    console.log(`✅ Prompt updated for item ${item.id}`);
                } else if (cleanedPrompt.length <= 1) {
                    console.log(`⏭️ Cleaned prompt is too short for item ${item.id}, skipping...`);
                    skipped++;
                } else {
                    console.log(`⏭️ Prompt unchanged for item ${item.id}, skipping...`);
                    skipped++;
                }
                
            } catch (error) {
                console.error(`❌ Failed to update prompt for item ${item.id}:`, error);
                errors++;
            }
        }
        
        const results = { processed, skipped, errors, total: allMedia.length };
        console.log(`Prompt update complete:`, results);
        
        return results;
    } catch (error) {
        console.error('Error in prompt update process:', error);
        throw error;
    }
}
