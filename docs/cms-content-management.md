# CMS & Content Management

Marvéo includes comprehensive content management capabilities that replace WordPress admin for daily content operations.

## Content Types Supported

### 1. Blog Posts

Full blog post management within Marvéo:

- ✅ Create new blog posts
- ✅ Edit existing posts
- ✅ Delete posts
- ✅ Manage post status (draft, pending, published)
- ✅ Add featured images
- ✅ Set post categories
- ✅ Add post tags
- ✅ Manage post metadata
- ✅ SEO-friendly slug editing
- ✅ Rich text editing

### 2. Pages

Standard WordPress pages with content editing:

- ✅ Create and edit pages
- ✅ Update page title and slug
- ✅ Edit page body content
- ✅ Set featured images
- ✅ Manage page metadata
- ✅ Control publication status
- ⚠️ **Page Builder Pages:** See limitations below

### 3. Media

Media library access and management:

- ✅ Browse media library
- ✅ Upload new images and files
- ✅ Organize by date
- ✅ Search media
- ✅ Select for posts and pages
- ✅ View media details and metadata

---

## Rich Text Editor

Marvéo includes a modern rich text editor with:

### Formatting

- **Bold** `Ctrl+B`
- **Italic** `Ctrl+I`
- **Underline** `Ctrl+U`

### Structure

- Headings (H1–H6)
- Paragraphs
- Code blocks
- Block quotes

### Lists

- Unordered lists
- Ordered lists
- List nesting

### Advanced

- Links and link editing
- Image embedding
- Text alignment
- HTML-safe content handling

### Editor Philosophy

The editor is built to be:

- **Intuitive** — Designed for business users, not developers
- **Safe** — Automatically sanitizes HTML to prevent XSS
- **Flexible** — Supports standard WordPress content
- **Familiar** — Similar to WordPress TinyMCE editor

---

## Page Builder Limitation

### Important

Marvéo is designed for **standard WordPress content** and does not replace page builders.

Pages built with the following builders should be edited in WordPress admin:

- Elementor
- Avada
- WPBakery
- Divi
- Beaver Builder
- Brizy
- Gutenberg blocks (complex layouts)

### Detection

When viewing a page in Marvéo, if it was built with a page builder:

1. You'll see a notice: "This page uses a page builder"
2. An "Edit in WordPress" button will appear
3. The body content will be read-only in Marvéo

### Why?

Page builders store their data in custom meta fields and use complex serialized data. Marvéo focuses on standard WordPress content (post_content) and won't attempt to decode builder data.

### When to Use What

| Task | Tool |
|------|------|
| Edit blog post | Marvéo |
| Create new blog post | Marvéo |
| Edit standard page | Marvéo |
| Build landing page with Elementor | WordPress |
| Customize theme | WordPress |
| Manage plugins | WordPress |
| Edit builder-based page | WordPress |

---

## Content Workflow

### Creating a Blog Post

1. Go to **Blog** → **New Post**
2. Enter post title
3. Write content using rich text editor
4. Add featured image
5. Set categories and tags
6. Choose status (Draft or Published)
7. Click **Save**

### Editing a Blog Post

1. Go to **Blog** → Find post
2. Click post to edit
3. Modify title, content, or metadata
4. Update featured image if needed
5. Click **Save**

### Publishing Content

Marvéo supports standard WordPress publish states:

- **Draft** — Work in progress, not visible to public
- **Pending** — Awaiting review by admin
- **Published** — Live on website
- **Scheduled** — Publish at future date (when supported)

### Bulk Operations

Coming in future versions:

- Bulk publish/unpublish
- Bulk delete posts
- Bulk category assignment
- Bulk export

---

## Media Management

### Uploading Media

1. Go to **Media**
2. Click **Upload**
3. Select images or files
4. Files appear in library
5. Use in posts/pages immediately

### Organizing Media

- Filter by upload date
- Search by filename
- View thumbnail previews
- Check file size and dimensions

### Using in Posts

1. While editing post content
2. Click media icon in editor
3. Select from library or upload
4. Image appears in post
5. Click to add alt text and captions

---

## SEO & Metadata

### Post Metadata

When editing a post, you can set:

- **Title** — Post title (appears in browser tab)
- **Slug** — URL-friendly identifier (`/blog/my-post-title`)
- **Excerpt** — Summary displayed in post lists
- **Featured Image** — Main image for the post

### WordPress Search Optimization

Marvéo works with standard WordPress SEO practices:

- Use descriptive titles
- Create unique slugs
- Write meaningful excerpts
- Add featured images
- Use categories and tags

### SEO Plugins

If using WordPress SEO plugins (Yoast, RankMath, etc.):

- Marvéo respects their meta fields
- SEO data is preserved
- Plugin-specific features available in WordPress admin

---

## Content Versioning & History

### Draft Management

WordPress tracks revisions automatically:

- Save drafts before publishing
- Revert to previous versions (in WordPress)
- Schedule posts for future publication

### Backup

Always recommended:

- Export content regularly
- Use WordPress backup plugins
- Keep database backups

---

## API Integration

### For Developers

Services for content management:

```typescript
// WordPress posts
import { getPosts, createPost, updatePost, deletePost } from '@/src/services/wordpress';

// Get all posts
const { posts, total } = await getPosts(1, 20);

// Create post
await createPost({ 
  title: 'New Post',
  content: '<p>Post content</p>',
  status: 'draft'
});

// Update post
await updatePost(123, { 
  title: 'Updated Title',
  status: 'publish'
});
```

See [src/services/wordpress.ts](../src/services/wordpress.ts) for full API documentation.

---

## Limitations & Roadmap

### Current Limitations

- Page builders not supported in Marvéo
- Custom post types require development
- Advanced taxonomy management in WordPress admin
- Scheduled posts managed in WordPress admin (future support planned)

### Planned Features

- [ ] Scheduled post publishing
- [ ] Content calendar view
- [ ] Bulk operations
- [ ] Version history viewer
- [ ] Content templates
- [ ] Multi-language support
- [ ] Advanced publishing workflows

---

## Best Practices

### Content Editing

1. ✅ Write drafts first, review, then publish
2. ✅ Use clear, descriptive post titles
3. ✅ Add featured images to all posts
4. ✅ Organize with categories and tags
5. ✅ Use headings to structure content
6. ❌ Avoid copying styled text from Word (paste as plain text)
7. ❌ Don't embed suspicious code or widgets

### Media Management

1. ✅ Use descriptive filenames
2. ✅ Add alt text for images
3. ✅ Optimize images before uploading
4. ✅ Delete unused media
5. ❌ Don't upload extremely large files
6. ❌ Avoid formats not supported by web browsers

### Collaboration

1. ✅ Use draft status for work in progress
2. ✅ Assign categories clearly
3. ✅ Document special instructions
4. ✅ Review before publishing
5. ❌ Don't edit live posts without coordination

---

## Troubleshooting

### Editor not loading

- Check browser compatibility (Chrome, Firefox, Safari, Edge)
- Clear browser cache and reload
- Check internet connection
- Try different browser

### Changes not saving

- Check connection to WordPress API
- Verify WooCommerce credentials in `.env.local`
- Check server logs for errors
- Try again in a few moments

### Media not uploading

- Check file size (usually limited to 100MB)
- Verify file format is supported
- Check WordPress media folder permissions
- Check available server storage

### Featured image not showing

- Ensure image was successfully uploaded
- Check image file path in media library
- Verify WordPress is serving images correctly
- Check browser cache

---

## Support

For issues or feature requests:

1. Check this documentation
2. Review error messages in browser console
3. Contact your Marvéo administrator
4. Submit issue to Avario Digital Products support team
