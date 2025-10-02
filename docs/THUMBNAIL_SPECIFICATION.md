# Thumbnail Specification

This document defines the thumbnail image specifications for characters and skins in Akagaku.

## General Requirements

### File Format
- **Supported formats**: PNG, JPEG, WebP
- **Recommended format**: PNG (for transparency support)
- **File extension**: `.png`, `.jpg`, `.jpeg`, `.webp`

### Image Dimensions
- **Character Thumbnail**: 256x256 pixels (1:1 aspect ratio)
- **Skin Thumbnail**: 256x256 pixels (1:1 aspect ratio)
- **Maximum file size**: 500KB per thumbnail

### Quality Guidelines
- **Resolution**: 72 DPI minimum
- **Color space**: sRGB
- **Transparency**: Supported (PNG/WebP only)
- **Background**: Transparent or solid color recommended

## File Naming Convention

### Character Thumbnail
```
data/character/{character_id}/thumbnail.png
```

Example:
```
data/character/minkee/thumbnail.png
```

### Skin Thumbnail
```
data/character/{character_id}/skins/{skin_id}/thumbnail.png
```

Example:
```
data/character/minkee/skins/default/thumbnail.png
data/character/minkee/skins/casual/thumbnail.png
```

## Manifest Configuration

### Character Manifest
```yaml
manifest_version: "1.0"
character_id: "minkee"
character_name: "김민킈"
thumbnail: "thumbnail.png"  # Relative path from character directory
# ...
```

### Skin Manifest
```yaml
manifest_version: "1.0"
skin_id: "default"
skin_name: "Default Outfit"
thumbnail: "thumbnail.png"  # Relative path from skin directory
# ...
```

## Path Resolution Rules

1. **Character Thumbnail Path**:
   - Manifest field: `thumbnail: "thumbnail.png"`
   - Resolved to: `data/character/{character_id}/thumbnail.png`

2. **Skin Thumbnail Path**:
   - Manifest field: `thumbnail: "thumbnail.png"`
   - Resolved to: `data/character/{character_id}/skins/{skin_id}/thumbnail.png`

3. **Fallback Behavior**:
   - If thumbnail file not found: Use default placeholder
   - If thumbnail field missing in manifest: No thumbnail displayed

## Validation Rules

### File Existence
- Thumbnail file must exist at resolved path if specified in manifest
- Missing thumbnail file should log warning but not block character/skin loading

### Image Validation
- Must be valid image file (readable by image decoder)
- Must match supported format (PNG/JPEG/WebP)
- Should meet dimension requirements (256x256)
- Should not exceed file size limit (500KB)

### Manifest Validation
- `thumbnail` field must be relative path string (no absolute paths)
- Path must not contain `..` or other directory traversal patterns
- Path separators should use forward slash `/` (cross-platform compatibility)

## Design Guidelines

### Character Thumbnail
- **Content**: Character portrait or representative icon
- **Framing**: Head and shoulders or full body
- **Style**: Match character's visual design
- **Background**: Transparent or neutral solid color

### Skin Thumbnail
- **Content**: Character wearing the skin/outfit
- **Framing**: Same pose/angle as character thumbnail for consistency
- **Highlight**: Emphasize the outfit/appearance change
- **Background**: Transparent or neutral solid color

## Implementation Notes

### Loading Priority
1. Check manifest for `thumbnail` field
2. Resolve relative path to absolute path
3. Validate file existence and format
4. Load and cache thumbnail image
5. Fall back to placeholder if any step fails

### Caching Strategy
- Thumbnails should be cached after first load
- Cache invalidation on manifest version change
- Cache should persist across app restarts

### Error Handling
- Missing file: Log warning, use placeholder
- Invalid format: Log error, use placeholder
- Oversized file: Log warning, attempt to load anyway
- Path traversal attempt: Log security warning, reject

## Future Considerations

### Multiple Sizes
May support multiple thumbnail sizes in future:
- `thumbnail_small.png` (128x128)
- `thumbnail_medium.png` (256x256, current default)
- `thumbnail_large.png` (512x512)

### Animated Thumbnails
May support animated thumbnails in future:
- Format: WebP or APNG
- Frame count: Max 30 frames
- Duration: Max 3 seconds loop
- File size: Max 1MB

### Vector Thumbnails
May support vector thumbnails in future:
- Format: SVG
- Restrictions: No external resources, inline styles only
- Security: Sanitization required
