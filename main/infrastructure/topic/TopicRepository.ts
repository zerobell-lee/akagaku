import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { Topic, TopicMetadata } from '../../domain/entities/Topic';
import Store from 'electron-store';

/**
 * TopicRepository - Infrastructure layer for topic data persistence
 *
 * Responsibilities:
 * - Load topics from markdown files with YAML frontmatter
 * - Track topic usage timestamps
 * - Persist topic metadata
 */

interface TopicUsageRecord {
  [characterId: string]: {
    [topicId: string]: string; // ISO timestamp of last use
  };
}

const getDataDirectory = () => path.join(app.getAppPath(), 'data');

export class TopicRepository {
  private store: Store;
  private readonly usageKey = 'topic_usage';

  constructor() {
    this.store = new Store({
      name: 'topic-usage'
    });
  }

  /**
   * Load all topics for a character from filesystem
   */
  loadTopicsForCharacter(characterId: string): Topic[] {
    const topicsDir = path.join(getDataDirectory(), 'character', characterId, 'topics');

    // Check if topics directory exists
    if (!fs.existsSync(topicsDir)) {
      console.log(`[TopicRepository] No topics directory for ${characterId}`);
      return [];
    }

    const topicFiles = fs.readdirSync(topicsDir).filter(file => file.endsWith('.md'));
    const topics: Topic[] = [];

    // Load usage data
    const usageData = this.store.get(this.usageKey, {}) as TopicUsageRecord;
    const characterUsage = usageData[characterId] || {};

    for (const filename of topicFiles) {
      try {
        const topicId = filename.replace('.md', '');
        const filePath = path.join(topicsDir, filename);
        const fileContent = fs.readFileSync(filePath, 'utf-8');

        // Parse YAML frontmatter and content
        const parsed = this.parseTopicFile(fileContent);
        if (!parsed) {
          console.warn(`[TopicRepository] Failed to parse topic: ${filename}`);
          continue;
        }

        const { metadata, content } = parsed;

        // Get last used timestamp if exists
        const lastUsedStr = characterUsage[topicId];
        const lastUsed = lastUsedStr ? new Date(lastUsedStr) : undefined;

        topics.push({
          id: topicId,
          characterId,
          metadata,
          content,
          lastUsed
        });
      } catch (error) {
        console.error(`[TopicRepository] Error loading topic ${filename}:`, error);
      }
    }

    console.log(`[TopicRepository] Loaded ${topics.length} topics for ${characterId}`);
    return topics;
  }

  /**
   * Parse topic markdown file with YAML frontmatter
   */
  private parseTopicFile(fileContent: string): { metadata: TopicMetadata; content: string } | null {
    // Match YAML frontmatter between --- markers
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = fileContent.match(frontmatterRegex);

    if (!match) {
      return null;
    }

    const [, frontmatterStr, content] = match;

    // Parse YAML frontmatter manually (simple key-value parsing)
    const metadata: Partial<TopicMetadata> = {};
    const lines = frontmatterStr.split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      if (key === 'type') {
        metadata.type = value as TopicMetadata['type'];
      } else if (key === 'category') {
        metadata.category = value;
      } else if (key === 'weight') {
        metadata.weight = parseFloat(value);
      } else if (key === 'requires_affection') {
        metadata.requires_affection = parseInt(value, 10);
      } else if (key === 'cooldown_days') {
        metadata.cooldown_days = parseInt(value, 10);
      } else if (key === 'tags') {
        // Parse array format: [tag1, tag2] or comma-separated
        const tagsStr = value.replace(/[\[\]]/g, '').trim();
        metadata.tags = tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0);
      }
    }

    // Validate required fields
    if (!metadata.type || !metadata.category || metadata.weight === undefined) {
      console.error('[TopicRepository] Missing required metadata fields');
      return null;
    }

    return {
      metadata: metadata as TopicMetadata,
      content: content.trim()
    };
  }

  /**
   * Save topic usage timestamp
   */
  saveTopicUsage(characterId: string, topicId: string, timestamp: Date = new Date()): void {
    const usageData = this.store.get(this.usageKey, {}) as TopicUsageRecord;

    if (!usageData[characterId]) {
      usageData[characterId] = {};
    }

    usageData[characterId][topicId] = timestamp.toISOString();
    this.store.set(this.usageKey, usageData);

    console.log(`[TopicRepository] Saved usage for ${characterId}/${topicId}`);
  }

  /**
   * Get topic usage timestamp
   */
  getTopicUsage(characterId: string, topicId: string): Date | null {
    const usageData = this.store.get(this.usageKey, {}) as TopicUsageRecord;
    const timestamp = usageData[characterId]?.[topicId];

    return timestamp ? new Date(timestamp) : null;
  }

  /**
   * Clear all topic usage for a character (for testing)
   */
  clearTopicUsage(characterId: string): void {
    const usageData = this.store.get(this.usageKey, {}) as TopicUsageRecord;
    delete usageData[characterId];
    this.store.set(this.usageKey, usageData);

    console.log(`[TopicRepository] Cleared usage for ${characterId}`);
  }

  /**
   * Reset all topic usage (for testing)
   */
  resetAllUsage(): void {
    this.store.delete(this.usageKey);
    console.log('[TopicRepository] Reset all topic usage');
  }
}

// Singleton instance
export const topicRepository = new TopicRepository();
