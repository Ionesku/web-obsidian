// ============================================================================
// INDEXEDDB - Dexie wrapper for metadata indexes
// ============================================================================

import Dexie, { Table } from 'dexie';
import type {
  FileRecord,
  MetaRecord,
  TagIndexRecord,
  PropIndexRecord,
  LinkIndexRecord,
  BlockIndexRecord,
  TaskIndexRecord,
  MetaDoc,
  FileMeta,
} from './types';

export class SearchDatabase extends Dexie {
  files!: Table<FileRecord, string>;
  meta!: Table<MetaRecord, string>;
  tagIndex!: Table<TagIndexRecord, string>;
  propIndex!: Table<PropIndexRecord, string>;
  linkIndex!: Table<LinkIndexRecord, string>;
  blocks!: Table<BlockIndexRecord, string>;
  tasks!: Table<TaskIndexRecord, string>;

  constructor() {
    super('ObsidianSearchDB');
    
    this.version(1).stores({
      // Primary file records
      files: 'path, mtime, size, hash, name',
      
      // Metadata with multi-entry indexes
      meta: 'path, *tags, *headingTexts, *linkPaths',
      
      // Specialized indexes for fast lookups
      tagIndex: '[tag+path], tag, path',
      propIndex: '[key+value+path], key, path, value',
      linkIndex: '[dstPath+srcPath], dstPath, srcPath',
      blocks: '[path+blockId], path, blockId',
      tasks: '[path+line], path, done',
    });
  }

  // ============================================================================
  // UPSERT OPERATIONS
  // ============================================================================

  async upsertFile(file: FileMeta, meta: MetaDoc): Promise<void> {
    await this.transaction('rw', [this.files, this.meta, this.tagIndex, this.propIndex, this.linkIndex, this.blocks, this.tasks], async () => {
      // 1. Update file record
      await this.files.put({
        path: file.path,
        name: file.name,
        mtime: file.mtime,
        size: file.size,
        hash: file.hash,
      });

      // 2. Delete old indexes for this path
      await Promise.all([
        this.tagIndex.where('path').equals(file.path).delete(),
        this.propIndex.where('path').equals(file.path).delete(),
        this.linkIndex.where('srcPath').equals(file.path).delete(),
        this.blocks.where('path').equals(file.path).delete(),
        this.tasks.where('path').equals(file.path).delete(),
      ]);

      // 3. Update meta record
      await this.meta.put({
        path: file.path,
        tags: meta.tags,
        headingTexts: meta.headings.map(h => h.text),
        linkPaths: meta.links.map(l => l.target),
        meta,
      });

      // 4. Insert new tag indexes (deduplicate)
      if (meta.tags.length > 0) {
        const uniqueTags = Array.from(new Set(meta.tags));
        await this.tagIndex.bulkAdd(
          uniqueTags.map(tag => ({
            tag,
            path: file.path,
            id: `${tag}+${file.path}`,
          }))
        );
      }

      // 5. Insert property indexes
      const propRecords: PropIndexRecord[] = [];
      for (const [key, value] of Object.entries(meta.props)) {
        if (value !== null && value !== undefined) {
          propRecords.push({
            key,
            value: Array.isArray(value) ? value.join(',') : value,
            path: file.path,
            id: `${key}+${value}+${file.path}`,
          });
        }
      }
      if (propRecords.length > 0) {
        await this.propIndex.bulkAdd(propRecords);
      }

      // 6. Insert link indexes (deduplicate to avoid constraint errors)
      if (meta.links.length > 0) {
        const linkMap = new Map<string, { srcPath: string; dstPath: string; id: string }>();
        for (const link of meta.links) {
          const id = `${link.target}+${file.path}`;
          if (!linkMap.has(id)) {
            linkMap.set(id, {
              srcPath: file.path,
              dstPath: link.target,
              id,
            });
          }
        }
        const uniqueLinks = Array.from(linkMap.values());
        if (uniqueLinks.length > 0) {
          await this.linkIndex.bulkAdd(uniqueLinks);
        }
      }

      // 7. Insert block indexes
      if (meta.blocks.length > 0) {
        await this.blocks.bulkAdd(
          meta.blocks.map(block => ({
            path: file.path,
            blockId: block.id,
            line: block.line,
            id: `${file.path}+${block.id}`,
          }))
        );
      }

      // 8. Insert task indexes
      if (meta.tasks.length > 0) {
        await this.tasks.bulkAdd(
          meta.tasks.map(task => ({
            path: file.path,
            line: task.line,
            done: task.done,
            text: task.text,
            id: `${file.path}+${task.line}`,
          }))
        );
      }
    });
  }

  async deleteFile(path: string): Promise<void> {
    await this.transaction('rw', [this.files, this.meta, this.tagIndex, this.propIndex, this.linkIndex, this.blocks, this.tasks], async () => {
      await Promise.all([
        this.files.delete(path),
        this.meta.delete(path),
        this.tagIndex.where('path').equals(path).delete(),
        this.propIndex.where('path').equals(path).delete(),
        this.linkIndex.where('srcPath').equals(path).delete(),
        this.blocks.where('path').equals(path).delete(),
        this.tasks.where('path').equals(path).delete(),
      ]);
    });
  }

  // ============================================================================
  // QUERY OPERATIONS (primitives for execute-local)
  // ============================================================================

  async pathsByTag(tag: string): Promise<Set<string>> {
    const normalizedTag = normalizeTag(tag);
    const records = await this.tagIndex
      .where('tag')
      .equals(normalizedTag)
      .toArray();
    return new Set(records.map(r => r.path));
  }

  async pathsByTagPrefix(prefix: string): Promise<Set<string>> {
    const normalizedPrefix = normalizeTag(prefix);
    const records = await this.tagIndex
      .where('tag')
      .startsWith(normalizedPrefix)
      .toArray();
    return new Set(records.map(r => r.path));
  }

  async pathsByProp(key: string, value?: string | number | boolean): Promise<Set<string>> {
    const normalizedKey = key.toLowerCase();
    
    if (value === undefined) {
      // Any file with this property key
      const records = await this.propIndex
        .where('key')
        .equals(normalizedKey)
        .toArray();
      return new Set(records.map(r => r.path));
    }
    
    // Specific key-value pair
    const records = await this.propIndex
      .where('[key+value]')
      .equals([normalizedKey, value])
      .toArray();
    return new Set(records.map(r => r.path));
  }

  async pathsByFileName(name: string): Promise<Set<string>> {
    const pattern = name.toLowerCase();
    const records = await this.files
      .filter(f => f.name.toLowerCase().includes(pattern))
      .toArray();
    return new Set(records.map(r => r.path));
  }

  async pathsByPathPrefix(prefix: string): Promise<Set<string>> {
    const normalizedPrefix = prefix.toLowerCase();
    const records = await this.files
      .filter(f => f.path.toLowerCase().startsWith(normalizedPrefix))
      .toArray();
    return new Set(records.map(r => r.path));
  }

  async pathsByBlockId(blockId: string): Promise<Set<string>> {
    const records = await this.blocks
      .where('blockId')
      .equals(blockId)
      .toArray();
    return new Set(records.map(r => r.path));
  }

  async linksFrom(path: string): Promise<Set<string>> {
    const records = await this.linkIndex
      .where('srcPath')
      .equals(path)
      .toArray();
    return new Set(records.map(r => r.dstPath));
  }

  async linksTo(path: string): Promise<Set<string>> {
    const records = await this.linkIndex
      .where('dstPath')
      .equals(path)
      .toArray();
    return new Set(records.map(r => r.srcPath));
  }

  async pathsByHeading(heading: string): Promise<Set<string>> {
    const pattern = heading.toLowerCase();
    const records = await this.meta
      .filter(m => m.headingTexts.some(h => h.toLowerCase().includes(pattern)))
      .toArray();
    return new Set(records.map(r => r.path));
  }

  async pathsWithTasks(done?: boolean): Promise<Set<string>> {
    if (done === undefined) {
      const records = await this.tasks.toArray();
      return new Set(records.map(r => r.path));
    }
    
    const records = await this.tasks
      .where('done')
      .equals(done)
      .toArray();
    return new Set(records.map(r => r.path));
  }

  async getAllPaths(): Promise<Set<string>> {
    const records = await this.files.toArray();
    return new Set(records.map(r => r.path));
  }

  async getMetaDoc(path: string): Promise<MetaDoc | undefined> {
    const record = await this.meta.get(path);
    return record?.meta;
  }

  async getFileRecord(path: string): Promise<FileRecord | undefined> {
    return await this.files.get(path);
  }

  // ============================================================================
  // BACKLINK GRAPH REBUILD
  // ============================================================================

  async rebuildBacklinks(): Promise<{ files: number; links: number }> {
    let linkCount = 0;
    
    await this.transaction('rw', this.meta, async () => {
      const allMeta = await this.meta.toArray();
      
      // Build backlink map
      const backlinkMap = new Map<string, Set<string>>();
      
      for (const record of allMeta) {
        for (const link of record.meta.links) {
          if (!backlinkMap.has(link.target)) {
            backlinkMap.set(link.target, new Set());
          }
          backlinkMap.get(link.target)!.add(record.path);
          linkCount++;
        }
      }
      
      // Update all meta records with backlinks
      for (const record of allMeta) {
        const backlinks = Array.from(backlinkMap.get(record.path) || []);
        record.meta.backlinks = backlinks;
        await this.meta.put(record);
      }
    });
    
    return {
      files: await this.meta.count(),
      links: linkCount,
    };
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  async getStats() {
    return {
      files: await this.files.count(),
      tags: await this.tagIndex.count(),
      props: await this.propIndex.count(),
      links: await this.linkIndex.count(),
      blocks: await this.blocks.count(),
      tasks: await this.tasks.count(),
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function normalizeTag(tag: string): string {
  return tag.toLowerCase().replace(/^#/, '');
}

// Singleton instance
export const db = new SearchDatabase();

