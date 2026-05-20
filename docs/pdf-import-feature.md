# PDF Slide Import Feature

## Overview
Users can now upload existing PDF slides to QuizWorld Presentations. Each PDF page becomes a slide with an image.

## Implementation

### Files Created
- `app/api/present/import-pdf/route.ts` — API endpoint for PDF upload
- `components/present/edit/pdf-upload-panel.tsx` — Upload UI with progress
- `styles/components/present-pdf.css` — Styling

### Files Modified
- `components/present/edit/add-slide-modal.tsx` — Added "Import PDF" option
- `components/present/edit/slide-editor-panel.tsx` — Added image upload for "content" slides
- `components/present/live/live-slide-stage.tsx` — Added image rendering in content slides
- `app/present/[code]/edit/page.tsx` — Integrated PDF import flow
- `app/globals.css` — Imported PDF styles

### How It Works

1. **User opens presentation editor** → `/present/[code]/edit`
2. **Clicks "Add Slide"** → Modal shows "Import PDF" option (highlighted)
3. **Selects PDF** → Client uploads to Supabase Storage
4. **Client renders pages** → PDF.js converts each page to PNG canvas
5. **Uploads page images** → Each page image stored in `quiz-images` bucket
6. **Creates slides** → Each page becomes a `content` slide with `image_url`

### Architecture

```
PDF Upload Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. User drops PDF file                                       │
│ 2. POST /api/present/import-pdf                              │
│ 3. Upload PDF to Supabase Storage                           │
│ 4. Return public URL                                         │
│ 5. Client loads PDF.js                                       │
│ 6. Render each page to canvas                                │
│ 7. canvas.toDataURL() → blob                                 │
│ 8. Upload each blob to Supabase Storage                      │
│ 9. Create slides with image_url                              │
└─────────────────────────────────────────────────────────────┘
```

### Limits
- Max PDF size: 50MB
- Max pages: 50 (enforced client-side during render loop)
- Files stored in: `quiz-images` bucket under `{userId}/slides/`

### Storage Path Convention
```
quiz-images/
  {userId}/
    pdf-imports/{timestamp}-{filename}.pdf  ← Original PDF
    slides/{timestamp}-page-{n}.png          ← Rendered page images
```

### Future Enhancements
- Server-side PDF processing (avoid client memory pressure)
- PowerPoint import (pptx → PDF → slides)
- Google Slides API integration
- Image optimization/compression
- OCR for text extraction from rendered slides

### Testing
```bash
# Build
npm run build

# Type check
npm run typecheck

# Manual test
1. Create presentation at /present
2. Click "Add Slide"
3. Click "Import PDF"
4. Upload multi-page PDF
5. Verify slides appear in editor
6. Present and verify images render
```

### Dependencies
- `pdfjs-dist` — PDF rendering (already installed)

### Browser Compatibility
- Modern browsers with Canvas support
- Uses `canvas.toDataURL()` for image conversion
- Fallback to data URLs if Supabase Storage fails
